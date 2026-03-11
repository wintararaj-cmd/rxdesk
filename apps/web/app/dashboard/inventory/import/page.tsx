'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { inventoryApi } from '../../../../lib/apiClient';

interface ParsedRow {
  medicine_name: string;
  mrp: string | number;
  stock_qty?: string | number;
  purchase_price?: string | number;
  batch_number?: string;
  expiry_date?: string;
  gst_rate?: string | number;
  reorder_level?: string | number;
  unit?: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  errors: { row: number; error: string }[];
}

// Strip non-alphanumeric noise for fuzzy matching (handles "price(₹,')" → "price")
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 _]/g, '').trim();
}

// Exact-only entries — short/ambiguous keys that must not do substring matching
// (e.g. "name" must NOT match "manufacturer_name" via contains)
const EXACT_MAP: [string, keyof ParsedRow][] = [
  ['name', 'medicine_name'],
  ['mrp', 'mrp'],
  ['unit', 'unit'],
  ['qty', 'stock_qty'],
  ['gst', 'gst_rate'],
  ['batch', 'batch_number'],
  ['expiry', 'expiry_date'],
  ['reorder', 'reorder_level'],
];

// General map — safe for starts-with and contains fuzzy matching
const FUZZY_MAP: [string, keyof ParsedRow][] = [
  ['medicine_name', 'medicine_name'], ['medicine name', 'medicine_name'],
  ['product name', 'medicine_name'], ['drug name', 'medicine_name'], ['item name', 'medicine_name'],
  ['selling price', 'mrp'], ['sale price', 'mrp'], ['retail price', 'mrp'], ['price', 'mrp'],
  ['purchase price', 'purchase_price'], ['purchase_price', 'purchase_price'], ['cost price', 'purchase_price'],
  ['stock_qty', 'stock_qty'], ['stock qty', 'stock_qty'], ['stock', 'stock_qty'], ['quantity', 'stock_qty'],
  ['batch_number', 'batch_number'], ['batch no', 'batch_number'],
  ['expiry_date', 'expiry_date'], ['exp date', 'expiry_date'], ['expiration', 'expiry_date'],
  ['gst_rate', 'gst_rate'], ['gst rate', 'gst_rate'],
  ['reorder_level', 'reorder_level'], ['reorder level', 'reorder_level'], ['min stock', 'reorder_level'],
  ['pack_size', 'unit'], ['pack', 'unit'],
];

function mapHeader(raw: string): keyof ParsedRow | undefined {
  const norm = normalizeHeader(raw);
  for (const [key, val] of [...EXACT_MAP, ...FUZZY_MAP]) {
    if (norm === key) return val;
  }
  for (const [key, val] of FUZZY_MAP) {
    if (norm.startsWith(key)) return val;
  }
  for (const [key, val] of FUZZY_MAP) {
    if (norm.includes(key)) return val;
  }
  return undefined;
}

// ─── GST Inference ──────────────────────────────────────────────────────────
// Based on India HSN / GST council classification for medicines & healthcare
// Priority: 0% exempted → 18% high → 12% Ayurveda/devices → 5% default Rx/OTC
function inferGSTRate(name: string, type?: string, composition?: string): number {
  const hay = ((name ?? '') + ' ' + (composition ?? '') + ' ' + (type ?? '')).toLowerCase();

  // 0% — Life-saving / exempted
  if (/\bvaccine|vaccination|antisera|antitoxin|toxoid|immunoglobulin|antivenom\b/.test(hay)) return 0;
  if (/\binsulin\b/.test(hay)) return 0;
  if (/\bcontraceptive|condom\b|oral contraceptive|\bOCP\b/i.test(hay)) return 0;
  if (/\bblood product|human plasma|human albumin\b/.test(hay)) return 0;
  if (/\bgland(s)? extract|organ extract\b/.test(hay)) return 0;

  // 18% — Sanitizers, disinfectants, nutraceuticals, cosmetic-medicinal
  if (/\bsanitizer|hand rub|hand sanitizer\b/.test(hay)) return 18;
  if (/\bdisinfectant\b/.test(hay)) return 18;
  if (/\bnutraceut|dietary supplement|protein powder|health food\b/.test(hay)) return 18;
  if (/\bmultivitamin\b/.test(hay) && !/\btablet|capsule|syrup\b/.test(hay)) return 18;
  if (/\bcosmetic|medicated shampoo|medicated cream\b/.test(hay)) return 18;

  // 12% — Ayurvedic / Homeopathic / Unani / ISM, medical devices, diagnostic kits, vet
  if (/\bayurved|homeopath|homoeopath|unani|siddha\b/.test(hay)) return 12;
  if (/\bsyringe|needle|catheter|stethoscope|bandage|dressing|plaster|gauze\b/.test(hay)) return 12;
  if (/\bdiagnostic kit|rapid test|pregnancy test|covid.*test|test.*kit\b/.test(hay)) return 12;
  if (/\bveterinary|animal health\b/.test(hay)) return 12;
  if (/\bphysiotherapy|orthopae|splint|prosthetic|hearing aid\b/.test(hay)) return 12;

  // 5% — All remaining Rx / OTC allopathy (most common retail medicines)
  return 5;
}

// Whether the GST rate was auto-inferred (not explicitly in the source data)
const GST_INFERRED = Symbol('gst_inferred');
type RowWithMeta = ParsedRow & { [GST_INFERRED]?: boolean };

function applyGSTInference(row: ParsedRow, type?: string, composition?: string): RowWithMeta {
  const hasGST = row.gst_rate !== undefined && row.gst_rate !== '' && Number(row.gst_rate) >= 0;
  if (hasGST) return row;
  const inferred = inferGSTRate(String(row.medicine_name), type, composition);
  return { ...row, gst_rate: inferred, [GST_INFERRED]: true };
}
// ────────────────────────────────────────────────────────────────────────────

// Extra Kaggle columns we capture but don't import — used only for GST inference
const KAGGLE_TYPE_HEADERS = ['type', 'medicine type', 'category'];
const KAGGLE_COMP_HEADERS = ['short_composition1', 'short_composition', 'composition', 'ingredients', 'active ingredient'];

function parseCSV(text: string): RowWithMeta[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const rawHeaders = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const colMap: Record<number, keyof ParsedRow> = {};
  const typeIdx: number[] = [];
  const compIdx: number[] = [];

  rawHeaders.forEach((h, i) => {
    const norm = normalizeHeader(h);
    if (KAGGLE_TYPE_HEADERS.includes(norm)) { typeIdx.push(i); return; }
    if (KAGGLE_COMP_HEADERS.some((k) => norm === k || norm.startsWith(k))) { compIdx.push(i); return; }
    const mapped = mapHeader(h);
    if (mapped && !(i in colMap)) colMap[i] = mapped;
  });

  if (!Object.values(colMap).includes('medicine_name')) throw new Error('Could not find a medicine name column. Accepted: "medicine_name", "name", "product name", "drug name".');
  if (!Object.values(colMap).includes('mrp')) throw new Error('Could not find an MRP/price column. Accepted: "mrp", "price", "selling price".');

  return lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());

    const row: Partial<ParsedRow> = {};
    Object.entries(colMap).forEach(([idx, key]) => {
      const val = cells[Number(idx)] ?? '';
      (row as Record<string, unknown>)[key] = val;
    });

    const typeHint = typeIdx.map((i) => cells[i] ?? '').join(' ');
    const compHint = compIdx.map((i) => cells[i] ?? '').join(' ');
    return applyGSTInference(row as ParsedRow, typeHint, compHint);
  }).filter((r) => r.medicine_name && String(r.medicine_name).trim());
}

function parseJSON(text: string): RowWithMeta[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.items ?? data.data ?? data.medicines ?? data.inventory;
  if (!Array.isArray(arr)) throw new Error('JSON must be an array or an object with an "items", "data", "medicines", or "inventory" key');
  return arr
    .filter((r: any) => r.medicine_name && String(r.medicine_name).trim())
    .map((r: any) => applyGSTInference(
      r as ParsedRow,
      r.type ?? r.medicine_type ?? r.category,
      r.short_composition1 ?? r.short_composition ?? r.composition,
    ));
}

const CSV_TEMPLATE = `medicine_name,mrp,stock_qty,purchase_price,batch_number,expiry_date,gst_rate,reorder_level,unit
Paracetamol 500mg,25.00,100,18.00,B001,2027-12,12,20,strip
Amoxicillin 250mg,45.00,60,36.00,B002,2026-06,12,15,strip
Cetirizine 10mg,18.00,80,12.00,B003,2027-03,12,10,strip
Omeprazole 20mg,55.00,50,40.00,B004,2027-09,12,10,strip
`;

const BATCH_SIZE = 2000;

export default function InventoryImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowWithMeta[]>([]);
  const [parseError, setParseError] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (items: object[]) => {
      const totalBatches = Math.ceil(items.length / BATCH_SIZE);
      const accumulated: ImportResult = { inserted: 0, updated: 0, errors: [] };

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        setBatchProgress({ current: batchIndex, total: totalBatches });
        const chunk = items.slice(i, i + BATCH_SIZE);
        const res = await inventoryApi.importBulk(chunk);
        const batchResult: ImportResult = res.data.data;
        accumulated.inserted += batchResult.inserted;
        accumulated.updated += batchResult.updated;
        // Offset row numbers to reflect position in the full dataset
        accumulated.errors.push(
          ...batchResult.errors.map((e) => ({ row: e.row + i, error: e.error }))
        );
      }

      setBatchProgress(null);
      return accumulated;
    },
    onSuccess: (accumulated) => {
      setResult(accumulated);
      setRows([]);
      setFileName('');
    },
    onError: () => {
      setBatchProgress(null);
    },
  });

  function handleFile(file: File) {
    setParseError('');
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = file.name.endsWith('.json') ? parseJSON(text) : parseCSV(text);
        if (parsed.length === 0) throw new Error('No valid rows found after parsing');
        setRows(parsed);
      } catch (err: any) {
        setParseError(err?.message ?? 'Failed to parse file');
        setRows([]);
      }
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'inventory_import_template.csv'; a.click();
  }

  const errorRows = importMutation.error
    ? [{ row: 0, error: (importMutation.error as any)?.response?.data?.error?.message ?? 'Import failed' }]
    : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/inventory" className="text-gray-400 hover:text-gray-600 text-sm">← Inventory</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Import Inventory</h1>
          <p className="text-gray-400 text-sm mt-0.5">Upload a CSV or JSON file to bulk-import medicines</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 border border-gray-200 bg-white text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold hover:border-violet-300 hover:text-violet-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Template
        </button>
      </div>

      {/* Format guide */}
      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-sm text-violet-800">
        <p className="font-semibold mb-2">Supported formats</p>
        <ul className="space-y-1 text-violet-700 text-xs">
          <li><span className="font-mono bg-violet-100 px-1 rounded">.csv</span> — Standard CSV with headers. Works directly with <strong>A-Z Medicine Dataset of India</strong> (Kaggle) — map columns automatically.</li>
          <li><span className="font-mono bg-violet-100 px-1 rounded">.json</span> — Array of objects, or <span className="font-mono">{"{ items: [...] }"}</span>. Also accepts Kaggle JSON exports.</li>
        </ul>
        <p className="mt-2 text-xs text-violet-600">Required columns: <span className="font-mono">medicine_name</span> (or <span className="font-mono">name / product name / drug name</span>) + <span className="font-mono">mrp</span> (or <span className="font-mono">price / selling price</span>)</p>
        <p className="text-xs text-violet-600 mt-0.5">Existing items with the same name + batch are <strong>updated</strong>, new ones are <strong>inserted</strong>. Max 2,000 rows per batch.</p>
        <p className="text-xs text-violet-600 mt-1">💡 <strong>GST auto-inference</strong>: If no GST column is present, the rate is inferred from the medicine name &amp; type — 0% vaccines/insulin, 5% Rx/OTC allopathy, 12% Ayurveda/devices, 18% supplements/sanitizers. Shown as <span className="inline-flex items-center bg-amber-100 text-amber-700 rounded px-1 font-mono text-[10px]">auto</span> in preview.</p>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all group"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <svg className="w-10 h-10 text-gray-300 group-hover:text-violet-400 mx-auto mb-3 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        {fileName ? (
          <p className="font-semibold text-violet-700">{fileName}</p>
        ) : (
          <>
            <p className="font-semibold text-gray-600">Drop your CSV or JSON file here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          </>
        )}
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          {parseError}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <p className="font-semibold text-gray-800">{rows.length.toLocaleString()} rows ready to import</p>
            <span className="text-xs text-gray-400">Showing first 10</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'Medicine Name', 'MRP', 'Stock', 'Purchase Price', 'Batch', 'Expiry', 'GST%', 'Unit'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{String(row.medicine_name)}</td>
                    <td className="px-4 py-2 text-gray-700">₹{row.mrp}</td>
                    <td className="px-4 py-2 text-gray-600">{row.stock_qty ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600">{row.purchase_price ? `₹${row.purchase_price}` : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2 text-gray-500">{row.batch_number || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2 text-gray-500">{row.expiry_date || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-gray-500">{row.gst_rate ?? 12}%</span>
                        {(row as RowWithMeta)[GST_INFERRED] && (
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-600 rounded px-1 py-0.5 leading-none">auto</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{row.unit || 'strip'}</td>
                  </tr>
                ))}
                {rows.length > 10 && (
                  <tr><td colSpan={9} className="px-4 py-2 text-gray-400 text-center">… and {rows.length - 10} more rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <button
              onClick={() => importMutation.mutate(rows as unknown as object[])}
              disabled={importMutation.isPending}
              className="flex items-center gap-2 bg-violet-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {importMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {batchProgress
                    ? `Batch ${batchProgress.current} / ${batchProgress.total}…`
                    : 'Importing…'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Import {rows.length.toLocaleString()} Items
                </>
              )}
            </button>
            <button onClick={() => { setRows([]); setFileName(''); }} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          {batchProgress && batchProgress.total > 1 && (
            <div className="px-5 pb-4">
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {Math.round((batchProgress.current / batchProgress.total) * 100)}% — processing batch {batchProgress.current} of {batchProgress.total}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-2xl border p-5 ${result.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="font-bold text-lg mb-3 text-gray-900">Import Complete</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3 text-center border border-emerald-100">
              <p className="text-2xl font-black text-emerald-600">{result.inserted}</p>
              <p className="text-xs text-gray-500 mt-0.5">New Items Added</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-blue-100">
              <p className="text-2xl font-black text-blue-600">{result.updated}</p>
              <p className="text-xs text-gray-500 mt-0.5">Items Updated</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-red-100">
              <p className="text-2xl font-black text-red-500">{result.errors.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Rows Skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
              <p className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border-b border-amber-100">Skipped rows</p>
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                {result.errors.map((e) => (
                  <div key={e.row} className="px-4 py-2 text-xs flex items-center gap-3">
                    <span className="font-mono text-gray-400 w-12">Row {e.row}</span>
                    <span className="text-red-500">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Link href="/dashboard/inventory" className="mt-4 inline-block text-sm font-semibold text-violet-600 hover:underline">
            → View Inventory
          </Link>
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {errorRows[0].error}
        </div>
      )}

    </div>
  );
}
