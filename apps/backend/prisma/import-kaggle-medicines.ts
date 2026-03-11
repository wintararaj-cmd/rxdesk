/**
 * import-kaggle-medicines.ts
 *
 * Imports the "Indian Pharmaceutical Products" Kaggle dataset into the medicines table.
 * Dataset: https://www.kaggle.com/datasets/rishgeeky/indian-pharmaceutical-products
 *
 * CSV Columns used:
 *   brand_name, price_inr, is_discontinued, manufacturer,
 *   primary_ingredient, primary_strength, active_ingredients, dosage_form, therapeutic_class
 *
 * Steps:
 *   1. Place the downloaded CSV at: apps/backend/prisma/indian_medicines.csv
 *   2. Run: npx ts-node prisma/import-kaggle-medicines.ts
 *
 * What this script does:
 *   - Skips discontinued products
 *   - Filters to popular generics actually dispensed in Indian pharmacies
 *   - Maps medicine_form to Prisma MedicineForm enum
 *   - Deduplicates by (brand_name + form + strength)
 *   - Batch-inserts into the medicines table (does NOT purge existing data)
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CSV_PATH = process.argv[2] || path.join(__dirname, 'indian_medicines.csv');

// ── Popular generic ingredient keywords ──────────────────────────────────────
// Only medicines whose active_ingredient_1 contains one of these keywords
// will be imported. This filters ~250K → ~5K–8K relevant records.
const POPULAR_KEYWORDS = [
  // Analgesics / NSAIDs
  'paracetamol', 'ibuprofen', 'aspirin', 'diclofenac', 'nimesulide', 'naproxen',
  'aceclofenac', 'mefenamic', 'ketorolac', 'etoricoxib', 'celecoxib',
  'tramadol', 'tapentadol',
  // Antibiotics
  'amoxicillin', 'azithromycin', 'ciprofloxacin', 'metronidazole', 'doxycycline',
  'cefixime', 'cefpodoxime', 'cephalexin', 'cefalexin', 'cefuroxime', 'ceftriaxone',
  'ofloxacin', 'norfloxacin', 'levofloxacin', 'moxifloxacin',
  'erythromycin', 'clarithromycin', 'clindamycin', 'ampicillin', 'piperacillin',
  'cotrimoxazole', 'trimethoprim', 'sulfamethoxazole',
  'tinidazole', 'ornidazole', 'rifampicin', 'isoniazid', 'pyrazinamide', 'ethambutol',
  // Antidiabetics
  'metformin', 'glibenclamide', 'glimepiride', 'glipizide', 'gliclazide',
  'sitagliptin', 'voglibose', 'acarbose', 'repaglinide', 'nateglinide',
  'dapagliflozin', 'empagliflozin', 'canagliflozin', 'ertugliflozin',
  'teneligliptin', 'saxagliptin', 'alogliptin', 'linagliptin',
  'pioglitazone', 'rosiglitazone', 'insulin',
  // Antihypertensives
  'amlodipine', 'atenolol', 'enalapril', 'lisinopril', 'ramipril', 'perindopril',
  'losartan', 'telmisartan', 'olmesartan', 'valsartan', 'irbesartan', 'candesartan',
  'bisoprolol', 'nebivolol', 'carvedilol', 'metoprolol', 'propranolol', 'labetalol',
  'nifedipine', 'felodipine', 'diltiazem', 'verapamil',
  'hydrochlorothiazide', 'chlorthalidone', 'indapamide',
  'furosemide', 'torsemide', 'spironolactone', 'eplerenone',
  'clonidine', 'prazosin', 'doxazosin', 'minoxidil', 'hydralazine',
  // Lipid-lowering
  'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin',
  'pitavastatin', 'fenofibrate', 'gemfibrozil', 'ezetimibe',
  // GI
  'omeprazole', 'pantoprazole', 'rabeprazole', 'esomeprazole', 'lansoprazole',
  'domperidone', 'metoclopramide', 'ondansetron', 'granisetron',
  'ranitidine', 'famotidine', 'cimetidine', 'sucralfate', 'antacid',
  'lactulose', 'bisacodyl', 'senna',
  'dicyclomine', 'drotaverine', 'hyoscine', 'hyoscyamine', 'trimebutine',
  'mesalazine', 'sulfasalazine',
  // Respiratory / Allergy
  'salbutamol', 'levosalbutamol', 'terbutaline', 'formoterol', 'salmeterol', 'indacaterol',
  'budesonide', 'beclomethasone', 'fluticasone', 'ciclesonide', 'mometasone',
  'tiotropium', 'ipratropium', 'aclidinium', 'glycopyrronium',
  'theophylline', 'aminophylline', 'doxofylline',
  'montelukast', 'zafirlukast',
  'cetirizine', 'levocetirizine', 'fexofenadine', 'loratadine', 'desloratadine',
  'chlorpheniramine', 'diphenhydramine', 'promethazine', 'hydroxyzine',
  'ambroxol', 'bromhexine', 'guaifenesin', 'dextromethorphan', 'carbocisteine',
  'codeine', 'xylometazoline', 'oxymetazoline', 'fluticasone furoate',
  // Psychiatric / Neurological
  'alprazolam', 'clonazepam', 'diazepam', 'lorazepam', 'oxazepam',
  'zolpidem', 'zaleplon', 'eszopiclone', 'melatonin',
  'amitriptyline', 'nortriptyline', 'imipramine', 'clomipramine',
  'fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'citalopram', 'fluvoxamine',
  'venlafaxine', 'desvenlafaxine', 'duloxetine', 'mirtazapine', 'bupropion',
  'olanzapine', 'risperidone', 'quetiapine', 'aripiprazole', 'clozapine',
  'haloperidol', 'chlorpromazine', 'trifluoperazine', 'lithium',
  'gabapentin', 'pregabalin',
  'phenytoin', 'fosphenytoin', 'carbamazepine', 'oxcarbazepine',
  'valproate', 'valproic', 'levetiracetam', 'lamotrigine', 'topiramate', 'zonisamide',
  'donepezil', 'rivastigmine', 'memantine', 'galantamine',
  'methylphenidate', 'atomoxetine',
  'betahistine', 'cinnarizine',
  // Vitamins / Supplements
  'vitamin b12', 'vitamin b1', 'vitamin b6', 'vitamin c', 'vitamin d', 'vitamin e',
  'thiamine', 'riboflavin', 'pyridoxine', 'cyanocobalamin', 'methylcobalamin',
  'folic acid', 'ascorbic acid', 'cholecalciferol', 'ergocalciferol',
  'calcitriol', 'calcium carbonate', 'calcium citrate',
  'ferrous', 'ferric', 'iron sucrose', 'iron polymaltose',
  'zinc', 'magnesium', 'biotin', 'mecobalamin', 'benfotiamine',
  // Thyroid
  'levothyroxine', 'thyroxine', 'liothyronine', 'carbimazole', 'propylthiouracil',
  // Antifungals
  'fluconazole', 'itraconazole', 'ketoconazole', 'terbinafine', 'voriconazole',
  'clotrimazole', 'miconazole', 'nystatin', 'amphotericin',
  // Antivirals
  'acyclovir', 'valacyclovir', 'famciclovir', 'oseltamivir', 'zanamivir',
  'tenofovir', 'efavirenz', 'lamivudine', 'zidovudine', 'nevirapine',
  'entecavir', 'sofosbuvir', 'ribavirin',
  // Antimalarials / Antiparasitics
  'chloroquine', 'hydroxychloroquine', 'artemether', 'lumefantrine', 'primaquine', 'quinine',
  'albendazole', 'mebendazole', 'ivermectin', 'praziquantel', 'pyrantel',
  // Steroids / Immunosuppressants
  'prednisolone', 'prednisone', 'dexamethasone', 'methylprednisolone', 'betamethasone',
  'hydrocortisone', 'triamcinolone', 'fluocinolone',
  'azathioprine', 'methotrexate', 'hydroxychloroquine', 'leflunomide',
  'cyclosporine', 'tacrolimus', 'mycophenolate',
  // Urology
  'tamsulosin', 'silodosin', 'alfuzosin', 'finasteride', 'dutasteride',
  'solifenacin', 'oxybutynin', 'tolterodine', 'mirabegron',
  'tadalafil', 'sildenafil', 'vardenafil', 'avanafil',
  // Hormones
  'progesterone', 'estradiol', 'norethisterone', 'levonorgestrel', 'desogestrel',
  'medroxyprogesterone', 'clomiphene', 'letrozole', 'anastrozole',
  'misoprostol', 'dinoprostone', 'oxytocin',
  // Cardiovascular
  'digoxin', 'amiodarone', 'warfarin', 'dabigatran', 'rivaroxaban', 'apixaban',
  'clopidogrel', 'prasugrel', 'ticagrelor', 'heparin', 'enoxaparin',
  'nitroglycerine', 'isosorbide', 'ivabradine', 'ranolazine',
  'sacubitril', 'vericiguat',
  // Gout
  'colchicine', 'allopurinol', 'febuxostat', 'benzbromarone',
  // Liver
  'silymarin', 'ursodeoxycholic', 'ursodiol', 'n-acetylcysteine', 'acetylcysteine',
  // Musculoskeletal
  'thiocolchicoside', 'tizanidine', 'baclofen', 'methocarbamol', 'cyclobenzaprine',
  'alendronate', 'risedronate', 'zoledronic', 'denosumab',
  // Ophthalmic
  'timolol', 'latanoprost', 'bimatoprost', 'travoprost', 'tafluprost',
  'dorzolamide', 'brinzolamide', 'brimonidine', 'pilocarpine',
  'tobramycin', 'gentamicin', 'moxifloxacin', 'gatifloxacin',
  'carboxymethylcellulose', 'hydroxypropyl methylcellulose',
  // Dermatology
  'tretinoin', 'adapalene', 'benzoyl peroxide', 'azelaic acid',
  'permethrin', 'lindane', 'crotamiton',
  'silver sulfadiazine', 'framycetin', 'fusidic acid', 'mupirocin',
  'calcipotriol', 'urea', 'lactic acid',
  // Antiemetics / Vertigo
  'prochlorperazine', 'meclizine', 'dimenhydrinate',
];

// ── Form mapping: CSV medicine_form → Prisma MedicineForm enum ────────────────
const FORM_MAP: Record<string, string> = {
  'tablet':       'tablet',
  'tablets':      'tablet',
  'tab':          'tablet',
  'capsule':      'capsule',
  'capsules':     'capsule',
  'cap':          'capsule',
  'syrup':        'syrup',
  'suspension':   'syrup',
  'oral solution':'syrup',
  'solution':     'syrup',
  'liquid':       'syrup',
  'linctus':      'syrup',
  'elixir':       'syrup',
  'injection':    'injection',
  'inj':          'injection',
  'injectable':   'injection',
  'infusion':     'injection',
  'vial':         'injection',
  'ampoule':      'injection',
  'drops':        'drops',
  'eye drops':    'drops',
  'ear drops':    'drops',
  'nasal drops':  'drops',
  'nasal spray':  'drops',
  'inhaler':      'inhaler',
  'inhaler (mdi)':'inhaler',
  'rotacap':      'inhaler',
  'rotacaps':     'inhaler',
  'respule':      'inhaler',
  'cream':        'ointment',
  'ointment':     'ointment',
  'gel':          'ointment',
  'lotion':       'ointment',
  'paste':        'ointment',
  'powder':       'powder',
  'dusting powder':'powder',
  'sachet':       'powder',
  'granules':     'powder',
};

function mapForm(raw: string): string {
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(FORM_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'other';
}

// Simple CSV parser that handles quoted fields
function parseCSVLine(line: string): string[] {
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

// Extract strength from ingredient string e.g. "Paracetamol (500 mg)" → "500mg"
function extractStrength(ingredient: string): string {
  // Match patterns like "500 mg", "500mg", "0.5 g", "100 mcg", "10 IU", "10%"
  const match = ingredient.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|%|units?)/i);
  if (match) return `${match[1]}${match[2].toLowerCase()}`;
  return '';
}

// Extract clean generic name (strip dosage from ingredient string)
function extractGenericName(ingredient: string): string {
  if (!ingredient) return '';
  // Remove parenthesized dosage like "(500 mg)" or "500MG"
  return ingredient
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s+\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%|units?).*/i, '')
    .trim();
}

// Check if a record matches popular keywords
function isPopular(ingredient1: string, ingredient2: string): boolean {
  const combined = `${ingredient1} ${ingredient2}`.toLowerCase();
  return POPULAR_KEYWORDS.some(kw => combined.includes(kw));
}

// Assign HSN code based on form
function getHSN(form: string): string {
  if (form === 'injection') return '30021900';
  if (form === 'inhaler') return '30049031';
  return '30049099';
}

// Rough GST rate heuristic (most pharma products are 12%, some OTC vitamins are 5%)
function getGSTRate(genericName: string, ingredient: string): number {
  const lower = `${genericName} ${ingredient}`.toLowerCase();
  const fivePercent = ['vitamin', 'folic acid', 'ferrous', 'iron', 'zinc',
    'calcium', 'ascorbic acid', 'cholecalciferol', 'ispaghula', 'ors', 'glucose'];
  if (fivePercent.some(k => lower.includes(k))) return 5;
  return 12;
}

// Schedule H heuristic
function isScheduleH(genericName: string): boolean {
  const scheduleH = [
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
  const lower = genericName.toLowerCase();
  return scheduleH.some(k => lower.includes(k));
}

interface MedicineRow {
  name: string;
  price_inr: string;
  is_discontinued: string;
  manufacturer_name: string;
  pack_quantity: string;
  pack_unit: string;
  active_ingredient_1: string;
  active_ingredient_2: string;
  medicine_form: string;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n❌ CSV file not found at: ${CSV_PATH}`);
    console.error('   Place the downloaded Kaggle CSV at that path and retry.\n');
    process.exit(1);
  }

  console.log(`📂 Reading CSV: ${CSV_PATH}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let totalRows = 0;
  let skippedDiscontinued = 0;
  let skippedUnpopular = 0;
  const seen = new Set<string>();
  const medicines: any[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = parseCSVLine(line);

    // First line = headers
    if (headers.length === 0) {
      headers = cols.map(h => h.toLowerCase().replace(/\s+/g, '_'));
      console.log(`📋 Detected columns: ${headers.join(', ')}\n`);
      continue;
    }

    totalRows++;

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });

    // Skip discontinued
    const disc = (row['is_discontinued'] || '').toLowerCase();
    if (disc === 'true' || disc === '1' || disc === 'yes') {
      skippedDiscontinued++;
      continue;
    }

    const ing1 = row['primary_ingredient'] || '';
    const ing2 = row['active_ingredients'] || '';
    const therapeuticClass = row['therapeutic_class'] || '';

    // Skip if not popular (search only primary_ingredient)
    if (!isPopular(ing1, '')) {
      skippedUnpopular++;
      continue;
    }

    const brandName = (row['brand_name'] || '').trim();
    if (!brandName) continue;

    const rawForm = row['dosage_form'] || '';
    const form = mapForm(rawForm);

    const genericName = extractGenericName(ing1) || brandName;
    // Use primary_strength column directly if available
    const strength = (row['primary_strength'] || '').trim() || extractStrength(ing1) || extractStrength(brandName);

    // Deduplicate by generic + form + strength (one representative brand per molecule+form+dose)
    const dedupeKey = `${genericName.toLowerCase()}|${form}|${strength}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const manufacturer = (row['manufacturer'] || 'Unknown').trim().substring(0, 100);
    const mrp = parseFloat(row['price_inr']) || 0;

    medicines.push({
      name: brandName.substring(0, 200),
      generic_name: genericName.substring(0, 200),
      brand_name: brandName.substring(0, 200),
      form,
      strength: strength || 'N/A',
      manufacturer,
      hsn_code: getHSN(form),
      gst_rate: getGSTRate(genericName, ing1),
      is_schedule_h: isScheduleH(genericName),
      // Store mrp for reference (not in medicines table, just logged)
      _mrp: mrp,
    });
  }

  const { _mrp: _unused, ..._ } = medicines[0] || {};

  console.log(`📊 Parsing complete:`);
  console.log(`   Total rows read      : ${totalRows.toLocaleString()}`);
  console.log(`   Skipped discontinued : ${skippedDiscontinued.toLocaleString()}`);
  console.log(`   Skipped unpopular    : ${skippedUnpopular.toLocaleString()}`);
  console.log(`   Unique medicines     : ${medicines.length.toLocaleString()}`);
  console.log();

  if (medicines.length === 0) {
    console.error('❌ No medicines to import. Check that the CSV columns match expectations.');
    process.exit(1);
  }

  // Strip _mrp before inserting
  const toInsert = medicines.map(({ _mrp, ...m }) => m);

  console.log(`💊 Inserting ${toInsert.length} medicines into the catalog...`);

  // Insert in batches of 500 to avoid hitting DB limits
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const result = await prisma.medicine.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    process.stdout.write(`\r   Inserted ${inserted} / ${toInsert.length}...`);
  }

  console.log(`\n\n✅ Done! ${inserted} new medicines added to the catalog.`);
  console.log(`   (Existing duplicates were skipped)\n`);

  // Print a sample
  console.log('📋 Sample of imported medicines:');
  medicines.slice(0, 10).forEach(m => {
    console.log(`   ${m.name} (${m.generic_name}) [${m.form}] ${m.strength}`);
  });
}

main()
  .catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
