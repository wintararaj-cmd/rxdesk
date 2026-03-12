/**
 * seed-medicines.ts
 * ─────────────────
 * Imports the full medicine catalog into the database.
 * Run inside the backend container:
 *   npx ts-node prisma/seed-medicines.ts
 *
 * Uses Prisma createMany with skipDuplicates so it is safe to run multiple times.
 */

import { PrismaClient, MedicineForm } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseSqlValue(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.toUpperCase() === 'NULL') return null;
    // strip surrounding single-quotes and unescape ''
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    return trimmed;
}

function parseBoolean(raw: string): boolean {
    return raw.trim().toLowerCase() === 'true';
}

function parseDecimal(raw: string): number {
    return parseFloat(raw.trim());
}

function toMedicineForm(raw: string | null): MedicineForm | null {
    if (!raw) return null;
    const valid: Record<string, MedicineForm> = {
        tablet: 'tablet',
        capsule: 'capsule',
        syrup: 'syrup',
        injection: 'injection',
        ointment: 'ointment',
        drops: 'drops',
        inhaler: 'inhaler',
        powder: 'powder',
        other: 'other',
    };
    return valid[raw.toLowerCase()] ?? 'other';
}

// Parses one INSERT row from pg_dump --column-inserts output.
// Pattern: INSERT INTO public.medicines (col,...) VALUES (...);
const INSERT_RE =
    /INSERT INTO public\.medicines \([^)]+\) VALUES \((.+)\);$/;

function parseInsertLine(line: string): Record<string, any> | null {
    const m = INSERT_RE.exec(line.trim());
    if (!m) return null;

    // Split on "," but not inside single-quoted strings
    const values: string[] = [];
    let current = '';
    let inString = false;
    const raw = m[1];
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === "'" && raw[i + 1] === "'") {
            current += "''";
            i++;
        } else if (ch === "'") {
            inString = !inString;
            current += ch;
        } else if (ch === ',' && !inString) {
            values.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    values.push(current.trim());

    // column order from schema:
    // id, name, generic_name, brand_name, form, strength,
    // manufacturer, hsn_code, gst_rate, is_schedule_h, is_active, created_at
    const [id, name, generic_name, brand_name, form, strength,
        manufacturer, hsn_code, gst_rate, is_schedule_h, is_active, created_at] = values;

    return {
        id: parseSqlValue(id)!,
        name: parseSqlValue(name)!,
        generic_name: parseSqlValue(generic_name),
        brand_name: parseSqlValue(brand_name),
        form: toMedicineForm(parseSqlValue(form)),
        strength: parseSqlValue(strength),
        manufacturer: parseSqlValue(manufacturer),
        hsn_code: parseSqlValue(hsn_code),
        gst_rate: parseDecimal(gst_rate),
        is_schedule_h: parseBoolean(is_schedule_h),
        is_active: parseBoolean(is_active),
        created_at: new Date(parseSqlValue(created_at)!),
    };
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
    const sqlPath = path.resolve(__dirname, 'medicines_export.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error(`❌  File not found: ${sqlPath}`);
        console.error('   Copy medicines_export.sql next to this file first.');
        process.exit(1);
    }

    const lines = fs.readFileSync(sqlPath, 'utf8').split('\n');
    const records: any[] = [];

    for (const line of lines) {
        if (!line.startsWith('INSERT INTO public.medicines')) continue;
        const rec = parseInsertLine(line);
        if (rec) records.push(rec);
    }

    console.log(`📦  Parsed ${records.length} medicines from SQL file.`);

    const BATCH = 500;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const result = await prisma.medicine.createMany({
            data: batch,
            skipDuplicates: true,
        });
        inserted += result.count;
        skipped += batch.length - result.count;
        process.stdout.write(
            `\r  ✓ ${inserted} inserted, ${skipped} skipped (${Math.min(i + BATCH, records.length)}/${records.length})`
        );
    }

    console.log(`\n\n✅  Done! ${inserted} new medicines added, ${skipped} already existed.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
