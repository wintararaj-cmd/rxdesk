/**
 * import-marg-medicines.ts
 *
 * Imports medicine data exported from Marg ERP / Marg billing software into
 * the global medicines catalog.
 *
 * Expected file format: Tab-separated (TSV) or comma-separated (CSV).
 * Headers (case-insensitive): code  name  unit  stock  deal  free
 *                              pur_deal  pur_free  cost  value  mrp
 *                              pur_rate  rate  company  manufact  rackno
 *
 * Usage:
 *   npx ts-node prisma/import-marg-medicines.ts <file.csv|file.tsv>
 *
 * What the script does:
 *   - Auto-detects tab vs comma delimiter
 *   - Infers medicine form, strength, generic name from the medicine name string
 *   - Assigns HSN code and GST rate heuristically
 *   - Deduplicates by normalised name (skips exact duplicates in the file)
 *   - Inserts new Medicine records, skips if already exists (safe to re-run)
 *   - Prints a detailed summary with warnings for any rows that could not be mapped
 *
 * NOTE: rackno, stock, mrp, pur_rate and deal/free columns are read but not stored —
 *       the global catalog holds medicine definitions only, not shop-specific pricing.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── CLI arguments ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('-')) {
  console.error('\n❌ Usage: npx ts-node prisma/import-marg-medicines.ts <file.csv|file.tsv>\n');
  process.exit(1);
}
const FILE_PATH = path.resolve(args[0]);

// ─── Form extraction: common Marg name suffixes → Prisma MedicineForm ─────────
const FORM_PATTERNS: Array<[RegExp, string]> = [
  [/\b(tab|tabs|tablet|tablets|t\.a\.b)\b/i,            'tablet'],
  [/\b(cap|caps|capsule|capsules|c\.a\.p)\b/i,          'capsule'],
  [/\b(syr|syrup|susp|suspension|liqd|liquid|linctus|elixir|oral sol)\b/i, 'syrup'],
  [/\b(inj|injection|vial|amp|ampoule|infusion|i\.v)\b/i, 'injection'],
  [/\b(drops?|eye drop|ear drop|nasal drop|ophthalmic)\b/i, 'drops'],
  [/\b(inhaler|inh|rotacap|respule|mdi|hfa|turbuhaler)\b/i, 'inhaler'],
  [/\b(cream|oint|ointment|gel|lotion|paste)\b/i,       'ointment'],
  [/\b(pwd|powder|sachet|granule)\b/i,                  'powder'],
];

function extractForm(name: string): string {
  for (const [re, form] of FORM_PATTERNS) {
    if (re.test(name)) return form;
  }
  return 'other';
}

// ─── Strength extraction ───────────────────────────────────────────────────────
function extractStrength(name: string): string {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|%|units?)\b/i);
  if (match) return `${match[1]}${match[2].toLowerCase()}`;
  return '';
}

// ─── Generic name extraction ───────────────────────────────────────────────────
// Strip form keywords, strength, and packs from the medicine name to get a clean
// generic / brand name for the catalog.
function extractGenericName(name: string): string {
  let s = name;
  // Remove strength like "500MG", "0.5G", "100ML"
  s = s.replace(/\b\d+(?:\.\d+)?\s*(mg|mcg|g|ml|iu|%|units?)\b/gi, '');
  // Remove form keywords
  for (const [re] of FORM_PATTERNS) {
    s = s.replace(re, '');
  }
  // Remove pack sizes like "10'S", "30S", "1X10"
  s = s.replace(/\b\d+\s*[xX]\s*\d+\b/g, '');
  s = s.replace(/\b\d+'\s*[sS]\b/g, '');
  s = s.replace(/\b\d+\s*[sS]\b/g, '');
  // Remove trailing punctuation and extra whitespace
  s = s.replace(/[-/|]+$/, '').replace(/\s{2,}/g, ' ').trim();
  return s || name.trim();
}

// ─── HSN code heuristic ────────────────────────────────────────────────────────
function getHSN(form: string): string {
  if (form === 'injection') return '30021900';
  if (form === 'inhaler')   return '30049031';
  return '30049099';
}

// ─── GST rate heuristic ────────────────────────────────────────────────────────
const GST_5_KEYWORDS = [
  'vitamin', 'folic acid', 'ferrous', 'iron', 'zinc', 'calcium',
  'ascorbic acid', 'cholecalciferol', 'ispaghula', 'ors', 'glucose',
];
function getGSTRate(name: string): number {
  const lower = name.toLowerCase();
  if (GST_5_KEYWORDS.some(k => lower.includes(k))) return 5;
  return 12;
}

// ─── Schedule-H heuristic ─────────────────────────────────────────────────────
const SCHEDULE_H_KEYWORDS = [
  'ciprofloxacin','amoxicillin','azithromycin','cefixime','cefpodoxime','cephalexin',
  'ofloxacin','norfloxacin','levofloxacin','moxifloxacin','doxycycline','erythromycin',
  'clarithromycin','rifampicin','isoniazid','metformin','glimepiride','sitagliptin',
  'dapagliflozin','empagliflozin','insulin','amlodipine','atenolol','enalapril',
  'losartan','telmisartan','ramipril','atorvastatin','rosuvastatin','simvastatin',
  'omeprazole','pantoprazole','rabeprazole','esomeprazole','ondansetron','domperidone',
  'salbutamol','budesonide','fluticasone','montelukast','levocetirizine','fexofenadine',
  'alprazolam','clonazepam','diazepam','zolpidem','amitriptyline','fluoxetine',
  'sertraline','escitalopram','olanzapine','risperidone','quetiapine','haloperidol',
  'phenytoin','carbamazepine','valproate','levetiracetam','gabapentin','pregabalin',
  'levothyroxine','carbimazole','fluconazole','itraconazole','terbinafine',
  'acyclovir','valacyclovir','hydroxychloroquine','chloroquine','prednisolone',
  'dexamethasone','methylprednisolone','azathioprine','methotrexate','tacrolimus',
  'tamsulosin','sildenafil','tadalafil','finasteride','solifenacin',
  'progesterone','levonorgestrel','letrozole','clomiphene','misoprostol',
  'warfarin','clopidogrel','amiodarone','digoxin','allopurinol','febuxostat',
  'colchicine','thiocolchicoside','tizanidine','baclofen','tramadol','ketorolac',
  'codeine','morphine','betahistine','silymarin','ursodeoxycholic',
];
function isScheduleH(name: string): boolean {
  const lower = name.toLowerCase();
  return SCHEDULE_H_KEYWORDS.some(k => lower.includes(k));
}

// ─── Delimiter auto-detect ────────────────────────────────────────────────────
function detectDelimiter(firstLine: string): string {
  const tabCount   = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g)  || []).length;
  return tabCount >= commaCount ? '\t' : ',';
}

// ─── CSV/TSV line parser ──────────────────────────────────────────────────────
function parseLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t') {
    // TSV: tabs are not escaped in Marg exports; just split
    return line.split('\t').map(f => f.trim());
  }
  // CSV with quoted-field support
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(FILE_PATH)) {
    console.error(`\n❌ File not found: ${FILE_PATH}\n`);
    process.exit(1);
  }

  console.log(`📂 Reading: ${FILE_PATH}\n`);

  const rl = readline.createInterface({
    input: fs.createReadStream(FILE_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let delimiter = ',';
  let totalRows = 0;
  let skippedBlank = 0;
  let warnings: string[] = [];

  // Normalised name → medicine id (built during processing to detect file-level dupes)
  const seenNames = new Set<string>();

  interface ParsedRow {
    code: string;
    name: string;
    company: string;
    manufact: string;
    // derived
    genericName: string;
    strength: string;
    form: string;
    hsnCode: string;
    gstRate: number;
    scheduleH: boolean;
  }

  const rows: ParsedRow[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (headers.length === 0) {
      delimiter = detectDelimiter(line);
      headers = parseLine(line, delimiter).map(h =>
        h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      );
      console.log(`📋 Detected delimiter : ${delimiter === '\t' ? 'TAB' : 'COMMA'}`);
      console.log(`📋 Columns found      : ${headers.join(', ')}\n`);

      // Validate required columns
      const required = ['name', 'mrp'];
      for (const col of required) {
        if (!headers.includes(col)) {
          console.error(`❌ Required column "${col}" not found in headers.`);
          console.error(`   Found: ${headers.join(', ')}`);
          process.exit(1);
        }
      }
      continue;
    }

    totalRows++;
    const cols = parseLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });

    const rawName = row['name'] || '';
    if (!rawName) { skippedBlank++; continue; }

    // Deduplicate within the file by normalised name
    const normName = rawName.toLowerCase().replace(/\s+/g, ' ');
    if (seenNames.has(normName)) continue;
    seenNames.add(normName);

    const form        = extractForm(rawName);
    const strength    = extractStrength(rawName);
    const genericName = extractGenericName(rawName);
    const gstRate     = getGSTRate(rawName);
    const hsnCode     = getHSN(form);
    const scheduleH   = isScheduleH(rawName);

    rows.push({
      code:        row['code'] ?? '',
      name:        rawName.substring(0, 200),
      company:     (row['company'] ?? '').substring(0, 100),
      manufact:    ((row['manufact'] || row['manufacturer'] || row['company'] || '').trimEnd()).substring(0, 100),
      genericName: genericName.substring(0, 200),
      strength:    strength || 'N/A',
      form,
      hsnCode,
      gstRate,
      scheduleH,
    });
  }

  console.log(`📊 Parse summary:`);
  console.log(`   Total rows read   : ${totalRows.toLocaleString()}`);
  console.log(`   Blank/empty rows  : ${skippedBlank.toLocaleString()}`);
  console.log(`   Duplicate names   : ${(totalRows - skippedBlank - rows.length).toLocaleString()}`);
  console.log(`   To import         : ${rows.length.toLocaleString()}`);
  if (warnings.length > 0) {
    console.log(`   Warnings          : ${warnings.length.toLocaleString()}`);
    warnings.slice(0, 10).forEach(w => console.log(`     ⚠️  ${w}`));
    if (warnings.length > 10) console.log(`     ... and ${warnings.length - 10} more`);
  }
  console.log();

  if (rows.length === 0) {
    console.error('❌ No valid rows to import.');
    process.exit(1);
  }

  // ── Upsert into medicines catalog ────────────────────────────────────────────
  console.log(`💊 Importing ${rows.length.toLocaleString()} medicines into catalog...`);

  // Build map of name → existing medicine id
  const existingMedicines = await prisma.medicine.findMany({
    where: { name: { in: rows.map(r => r.name) } },
    select: { id: true, name: true },
  });
  const existingMap = new Map(existingMedicines.map(m => [m.name, m.id]));

  const toCreate   = rows.filter(r => !existingMap.has(r.name));
  const toSkip     = rows.filter(r =>  existingMap.has(r.name));

  console.log(`   Already in catalog: ${toSkip.length.toLocaleString()}`);
  console.log(`   New medicines     : ${toCreate.length.toLocaleString()}`);

  let catalogInserted = 0;
  const BATCH = 500;

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    const result = await prisma.medicine.createMany({
      data: batch.map(r => ({
        name:          r.name,
        generic_name:  r.genericName,
        brand_name:    r.name,
        form:          r.form as any,
        strength:      r.strength,
        manufacturer:  r.manufact || r.company || null,
        hsn_code:      r.hsnCode,
        gst_rate:      r.gstRate,
        is_schedule_h: r.scheduleH,
        is_active:     true,
      })),
      skipDuplicates: true,
    });
    catalogInserted += result.count;
    process.stdout.write(`\r   Inserted ${catalogInserted + toSkip.length} / ${rows.length}...`);
  }

  console.log(`\n   ✅ Done. ${catalogInserted} new medicines added.\n`);
  printSummary(rows, catalogInserted);
}

function printSummary(rows: any[], catalogInserted: number) {
  console.log('─'.repeat(55));
  console.log('📋 Import complete!');
  console.log(`   Total records processed : ${rows.length.toLocaleString()}`);
  console.log(`   New medicines in catalog: ${catalogInserted.toLocaleString()}`);
  console.log(`   Already existed (skipped): ${(rows.length - catalogInserted).toLocaleString()}`);
  console.log();
  console.log('📋 Sample (first 10 rows):');
  rows.slice(0, 10).forEach((r: any) => {
    console.log(`   ${r.name.padEnd(40)} [${r.form.padEnd(9)}] ${r.strength}`);
  });
  console.log('─'.repeat(55));
}

main()
  .catch(e => {
    console.error('\n❌ Fatal error:', e.message);
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
