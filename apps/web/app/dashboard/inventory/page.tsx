'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, medicinesApi } from '../../../lib/apiClient';

function parseCsv(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: any = {};
    headers.forEach((h, i) => {
      let val = (values[i] || '').trim().replace(/^"|"$/g, '');
      obj[h] = val;
    });
    return obj;
  });
}

function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

interface CatalogMedicine {
  id: string;
  name: string;
  generic_name?: string;
  brand_name?: string;
  form?: string;
  strength?: string;
  manufacturer?: string;
  gst_rate?: number;
  hsn_code?: string;
  is_schedule_h?: boolean;
}

interface InventoryItem {
  id: string;
  medicine?: { generic_name?: string; form?: string; strength?: string };
  medicine_name: string;
  hsn_code?: string;
  unit?: string;
  stock_qty: number;
  reorder_level: number;
  mrp: number;
  gst_rate: number;
  purchase_price?: number;
  expiry_date?: string;
  batch_number?: string;
  discount_type: 'percentage' | 'amount';
  discount_value: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Add form — catalog / master data only
const EMPTY_ADD_FORM = {
  medicine_name: '',
  reorder_level: '',
  mrp: '',
  gst_rate: '12',
  hsn_code: '',
  unit: 'strip',
  discount_type: 'percentage',
  discount_value: '0',
};

// Edit form — all fields (manual stock corrections + purchase-invoice fields)
const EMPTY_EDIT_FORM = {
  medicine_name: '',
  hsn_code: '',
  unit: 'strip',
  reorder_level: '',
  mrp: '',
  gst_rate: '12',
  stock_qty: '',
  purchase_price: '',
  batch_number: '',
  expiry_date: '',
  discount_type: 'percentage',
  discount_value: '0',
};

export default function InventoryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'stock' | 'catalog' | 'finder'>('stock');
  const [finderQuery, setFinderQuery] = useState('');
  const [finderInput, setFinderInput] = useState('');
  const finderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<typeof EMPTY_ADD_FORM>(EMPTY_ADD_FORM);
  const [editForm, setEditForm] = useState<Partial<typeof EMPTY_EDIT_FORM>>({});
  const [triedToSubmit, setTriedToSubmit] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [catPage, setCatPage] = useState(1);
  const [catSearch, setCatSearch] = useState('');
  const [catSearchInput, setCatSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inventoryImportRef = useRef<HTMLInputElement>(null);
  // Expiry alert state
  const [expiryDays, setExpiryDays] = useState(90);
  const [showExpiryAlert, setShowExpiryAlert] = useState(true);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  }, []);

  const handleCatSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCatSearchInput(val);
    if (catDebounceRef.current) clearTimeout(catDebounceRef.current);
    catDebounceRef.current = setTimeout(() => {
      setCatSearch(val);
      setCatPage(1);
    }, 400);
  }, []);

  const { data: catalogResult, isLoading: catLoading } = useQuery<{ data: CatalogMedicine[]; pagination: Pagination }>({
    queryKey: ['medicine-catalog', catPage, catSearch],
    queryFn: () => medicinesApi.catalog({ page: catPage, q: catSearch || undefined }).then((r) => ({ data: r.data.data, pagination: r.data.pagination })),
    enabled: tab === 'catalog',
    placeholderData: (prev) => prev,
  });
  const catalogItems = catalogResult?.data ?? [];
  const catalogPagination = catalogResult?.pagination;

  const { data: queryResult, isLoading } = useQuery<{ data: InventoryItem[]; pagination: Pagination }>({
    queryKey: ['inventory', page, search],
    queryFn: () => inventoryApi.list({ page, q: search || undefined }).then((r) => ({ data: r.data.data, pagination: r.data.pagination })),
    placeholderData: (prev) => prev,
  });
  const items = queryResult?.data ?? [];
  const pagination = queryResult?.pagination;

  const addMutation = useMutation({
    mutationFn: (data: object) => inventoryApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setShowAdd(false);
      setForm(EMPTY_ADD_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => inventoryApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', page, search] });
      setEditItem(null);
      setEditForm({});
      setTriedToSubmit(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const importMutation = useMutation({
    mutationFn: (items: any[]) => inventoryApi.importBulk(items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      alert('Inventory items imported successfully!');
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Import failed'),
  });

  // Expiry alert query
  const { data: expiringItems = [] } = useQuery<{
    id: string; medicine_name: string; batch_number?: string; expiry_date: string; stock_qty: number; mrp: number;
  }[]>({
    queryKey: ['inventory-expiring', expiryDays],
    queryFn: () => inventoryApi.expiringItems(expiryDays).then((r) => r.data.data),
    enabled: tab === 'stock',
    staleTime: 5 * 60 * 1000,
  });

  const now = new Date();
  const criticalItems = expiringItems.filter((i) => {
    const d = Math.ceil((new Date(i.expiry_date).getTime() - now.getTime()) / 86_400_000);
    return d <= 30;
  });
  const warningItems = expiringItems.filter((i) => {
    const d = Math.ceil((new Date(i.expiry_date).getTime() - now.getTime()) / 86_400_000);
    return d > 30 && d <= expiryDays;
  });

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let items = [];
      if (file.name.endsWith('.json')) items = JSON.parse(text);
      else items = parseCsv(text);
      if (items.length > 0) importMutation.mutate(items);
    } catch (err) { alert('Failed to parse file'); }
    if (e.target) e.target.value = '';
  };

  const handleAdd = () => {
    addMutation.mutate({
      medicine_name: form.medicine_name,
      hsn_code: form.hsn_code || undefined,
      unit: form.unit || 'strip',
      reorder_level: Number(form.reorder_level) || 10,
      mrp: Number(form.mrp),
      gst_rate: Number(form.gst_rate) || 12,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      // stock starts at 0 — populated via purchase invoices
      stock_qty: 0,
    });
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setEditForm({
      medicine_name: item.medicine_name,
      hsn_code: item.hsn_code ?? '',
      unit: item.unit ?? 'strip',
      stock_qty: String(item.stock_qty),
      reorder_level: String(item.reorder_level),
      mrp: String(item.mrp),
      gst_rate: String(item.gst_rate ?? 12),
      purchase_price: item.purchase_price != null ? String(item.purchase_price) : '',
      batch_number: item.batch_number ?? '',
      expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
      discount_type: item.discount_type,
      discount_value: String(item.discount_value),
    });
  };

  const handleUpdate = () => {
    if (!editItem) return;
    if (!editForm.medicine_name?.trim()) {
      alert('Medicine name is required');
      return;
    }
    updateMutation.mutate({
      id: editItem.id,
      data: {
        medicine_name: editForm.medicine_name,
        hsn_code: editForm.hsn_code || undefined,
        unit: editForm.unit || undefined,
        stock_qty: editForm.stock_qty ? Number(editForm.stock_qty) : undefined,
        reorder_level: editForm.reorder_level ? Number(editForm.reorder_level) : undefined,
        mrp: editForm.mrp ? Number(editForm.mrp) : undefined,
        gst_rate: editForm.gst_rate ? Number(editForm.gst_rate) : undefined,
        purchase_price: editForm.purchase_price ? Number(editForm.purchase_price) : undefined,
        batch_number: editForm.batch_number || undefined,
        expiry_date: editForm.expiry_date || undefined,
        discount_type: editForm.discount_type,
        discount_value: editForm.discount_value ? Number(editForm.discount_value) : undefined,
      },
    });
  };

  const GST_RATES = ['0', '5', '12', '18', '28'];
  const UNITS = ['strip', 'bottle', 'packet', 'vial', 'tube', 'piece', 'box'];

  // Add form — catalog / master data only
  const ADD_FIELDS: { key: keyof typeof EMPTY_ADD_FORM; label: string; type: 'text' | 'number' | 'select'; span: 1 | 2; placeholder?: string }[] = [
    { key: 'medicine_name', label: 'Medicine Name', type: 'text', span: 2, placeholder: 'e.g. Paracetamol 500mg' },
    { key: 'mrp', label: 'MRP / Selling Price (₹)', type: 'number', span: 1, placeholder: '0.00' },
    { key: 'gst_rate', label: 'GST Rate (%)', type: 'select', span: 1 },
    { key: 'hsn_code', label: 'HSN Code', type: 'text', span: 1, placeholder: 'e.g. 30049099' },
    { key: 'unit', label: 'Unit', type: 'select', span: 1 },
    { key: 'discount_type', label: 'Disc. Type', type: 'select', span: 1 },
    { key: 'discount_value', label: 'Disc. Val', type: 'number', span: 1 },
    { key: 'reorder_level', label: 'Reorder Level', type: 'number', span: 2, placeholder: 'Minimum stock before alert (default 10)' },
  ];

  // Edit form — all fields
  const EDIT_FIELDS: { key: keyof typeof EMPTY_EDIT_FORM; label: string; type: 'text' | 'number' | 'date' | 'select'; span: 1 | 2; note?: string }[] = [
    { key: 'medicine_name', label: 'Medicine Name', type: 'text', span: 2 },
    { key: 'mrp', label: 'MRP / Selling Price (₹)', type: 'number', span: 1 },
    { key: 'gst_rate', label: 'GST Rate (%)', type: 'select', span: 1 },
    { key: 'hsn_code', label: 'HSN Code', type: 'text', span: 1 },
    { key: 'unit', label: 'Unit', type: 'select', span: 1 },
    { key: 'discount_type', label: 'Disc. Type', type: 'select', span: 1 },
    { key: 'discount_value', label: 'Disc. Val', type: 'number', span: 1 },
    { key: 'reorder_level', label: 'Reorder Level', type: 'number', span: 2 },
    { key: 'stock_qty', label: 'Stock Qty', type: 'number', span: 1, note: 'Auto-updated from purchase invoices' },
    { key: 'purchase_price', label: 'Purchase Price (₹)', type: 'number', span: 1, note: 'Auto-updated from purchase invoices' },
    { key: 'batch_number', label: 'Batch No.', type: 'text', span: 1, note: 'Auto-updated from purchase invoices' },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date', span: 1, note: 'Auto-updated from purchase invoices' },
  ];

  return (
    <div className="p-6">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tab === 'stock'
              ? (pagination ? `${pagination.total.toLocaleString()} items in stock` : '…')
              : tab === 'catalog'
              ? (catalogPagination ? `${catalogPagination.total.toLocaleString()} medicines in catalog` : '…')
              : 'Find alternatives by composition'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'stock' && (
            <div className="flex gap-3 items-center">
              <button
                onClick={() => downloadCsv('inventory_import_template.csv', 'medicine_name,quantity,mrp,purchase_price,batch_number,expiry_date,gst_rate,hsn_code,unit,discount_type,discount_value,reorder_level\n"Paracetamol 500 MG",100,15.50,10.20,"B123","2026-12-31",12,"30049099","strip","percentage",10,50')}
                className="text-[10px] text-violet-400 font-bold uppercase hover:underline"
              >
                Template
              </button>
              <div className="flex gap-2">
                <input type="file" ref={inventoryImportRef} onChange={handleImportFile} accept=".csv,.json" className="hidden" />
                <button
                  onClick={() => inventoryImportRef.current?.click()}
                  disabled={importMutation.isPending}
                  className="bg-white text-violet-600 border border-violet-200 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-50 transition-colors shadow-sm"
                >
                  {importMutation.isPending ? 'Importing...' : 'Bulk Import'}
                </button>
                <button
                  onClick={() => setShowAdd(true)}
                  className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
                >
                  + Add Item
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Expiry Alert Banner ───────────────────────────────────────── */}
      {tab === 'stock' && expiringItems.length > 0 && (
        <div className={`mb-4 rounded-2xl border overflow-hidden ${
          criticalItems.length > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
        }`}>
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer"
            onClick={() => setShowExpiryAlert((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{criticalItems.length > 0 ? '⚠️' : '📅'}</span>
              <div>
                <p className={`text-sm font-bold ${criticalItems.length > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                  {criticalItems.length > 0
                    ? `${criticalItems.length} medicine${criticalItems.length !== 1 ? 's' : ''} expiring within 30 days!`
                    : `${expiringItems.length} medicine${expiringItems.length !== 1 ? 's' : ''} expiring within ${expiryDays} days`}
                </p>
                <p className={`text-xs ${criticalItems.length > 0 ? 'text-red-500' : 'text-amber-500'}`}>
                  {criticalItems.length > 0 && warningItems.length > 0
                    ? `+${warningItems.length} more within ${expiryDays} days — check stock`
                    : 'Check stock and plan clearance or returns'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white text-xs">
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    onClick={(e) => { e.stopPropagation(); setExpiryDays(d); }}
                    className={`px-2.5 py-1 font-semibold transition-colors ${
                      expiryDays === d ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <svg className={`w-4 h-4 transition-transform ${showExpiryAlert ? 'rotate-180' : ''} ${criticalItems.length > 0 ? 'text-red-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
          {showExpiryAlert && (
            <div className="border-t border-gray-200/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className={criticalItems.length > 0 ? 'bg-red-100/50' : 'bg-amber-100/50'}>
                    {['Medicine', 'Batch', 'Expiry', 'Days Left', 'Qty', 'MRP'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/80">
                  {expiringItems.map((item) => {
                    const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - now.getTime()) / 86_400_000);
                    const isCritical = daysLeft <= 30;
                    const isExpired  = daysLeft <= 0;
                    return (
                      <tr key={item.id} className={isExpired ? 'bg-red-100' : isCritical ? 'bg-red-50/50' : 'bg-white/40'}>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">{item.medicine_name}</td>
                        <td className="px-3 py-2.5 text-gray-500 font-mono">{item.batch_number ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{new Date(item.expiry_date).toLocaleDateString('en-IN')}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            isExpired  ? 'bg-red-600 text-white'
                            : isCritical ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isExpired ? 'EXPIRED' : `${daysLeft}d`}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-700">{item.stock_qty}</td>
                        <td className="px-3 py-2.5 text-gray-600">₹{Number(item.mrp).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('stock')}
          className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'stock' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Stock
        </button>
        <button
          onClick={() => setTab('catalog')}
          className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'catalog' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Medicine Catalog
        </button>
        <button
          onClick={() => setTab('finder')}
          className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${tab === 'finder' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🔍 Finder
        </button>
      </div>

      {/* ── FINDER TAB ───────────────────────────────────────────── */}
      {tab === 'finder' && <MedicineFinder />}

      {/* ── CATALOG TAB ─────────────────────────────────────────── */}
      {tab === 'catalog' && (
        <>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search catalog by name, generic or brand…"
              value={catSearchInput}
              onChange={handleCatSearchChange}
              className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Medicine', 'Generic Name', 'Form', 'Strength', 'Manufacturer', 'GST', 'Sch.H'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {catLoading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
                ) : catalogItems.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">{catSearch ? 'No results found.' : 'No medicines in catalog.'}</td></tr>
                ) : catalogItems.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.name}</p>
                      {m.brand_name && m.brand_name !== m.name && (
                        <p className="text-gray-400 text-xs">{m.brand_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.generic_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {m.form && (
                        <span className="inline-block bg-violet-50 text-violet-700 text-xs px-2 py-0.5 rounded-full capitalize">{m.form}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.strength ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.manufacturer ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.gst_rate ?? 12}%</td>
                    <td className="px-4 py-3">
                      {m.is_schedule_h ? (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">Yes</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {catalogPagination && catalogPagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">
                Showing {((catalogPagination.page - 1) * catalogPagination.pageSize) + 1}–{Math.min(catalogPagination.page * catalogPagination.pageSize, catalogPagination.total)} of {catalogPagination.total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCatPage(1)} disabled={catPage === 1} className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">«</button>
                <button onClick={() => setCatPage((p) => Math.max(1, p - 1))} disabled={catPage === 1} className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <span className="px-3 py-1 text-xs text-gray-600 font-medium">{catPage} / {catalogPagination.totalPages}</span>
                <button onClick={() => setCatPage((p) => Math.min(catalogPagination.totalPages, p + 1))} disabled={catPage === catalogPagination.totalPages} className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
                <button onClick={() => setCatPage(catalogPagination.totalPages)} disabled={catPage === catalogPagination.totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">»</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STOCK TAB ───────────────────────────────────────────── */}
      {tab === 'stock' && (<>
      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by medicine name…"
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-violet-400"
        />
      </div>
      {showAdd && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-semibold text-gray-900">Add Inventory Item</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Enter catalogue details only. Stock qty, purchase price, batch no. &amp; expiry date will be populated automatically when you record a purchase invoice.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {ADD_FIELDS.map(({ key, label, type, span, placeholder }) => (
              <div key={key} className={span === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                {type === 'select' && key === 'gst_rate' ? (
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                    value={form.gst_rate}
                    onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}
                  >
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                ) : type === 'select' && key === 'unit' ? (
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : type === 'select' && key === 'discount_type' ? (
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="amount">Amount (₹)</option>
                  </select>
                ) : (
                  <input
                    type={type}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 placeholder:text-gray-300"
                    value={form[key as keyof typeof EMPTY_ADD_FORM]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          {addMutation.isError && (
            <p className="text-red-500 text-xs mb-3">Failed to add item. Please check and try again.</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending || !form.medicine_name || !form.mrp}
              className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding…' : 'Add Item'}
            </button>
            <button onClick={() => { setShowAdd(false); setForm(EMPTY_ADD_FORM); }} className="text-gray-500 text-sm px-4 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900 text-lg">Edit Item</h3>
              <button onClick={() => { setEditItem(null); setEditForm({}); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {EDIT_FIELDS.map(({ key, label, type, span, note }) => (
                <div key={key} className={span === 2 ? 'col-span-2' : ''}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-xs font-medium text-gray-600">{label}</label>
                    {note && <span className="text-xs text-violet-400 italic">{note}</span>}
                  </div>
                  {type === 'select' && key === 'gst_rate' ? (
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                      value={editForm.gst_rate ?? '12'}
                      onChange={(e) => setEditForm({ ...editForm, gst_rate: e.target.value })}
                    >
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  ) : type === 'select' && key === 'unit' ? (
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                      value={editForm.unit ?? 'strip'}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : type === 'select' && key === 'discount_type' ? (
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                      value={editForm.discount_type ?? 'percentage'}
                      onChange={(e) => setEditForm({ ...editForm, discount_type: e.target.value as any })}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="amount">Amount (₹)</option>
                    </select>
                  ) : (
                    <input
                      type={type}
                      className={`w-full border rounded-lg px-3 h-9 text-sm text-gray-900 outline-none transition-all ${triedToSubmit && !editForm.medicine_name?.trim() && key === 'medicine_name' ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-violet-500'}`}
                      value={editForm[key] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            {updateMutation.isError && (
              <p className="text-red-500 text-xs mb-3">Failed to update. Please try again.</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                className="bg-violet-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 flex-1"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => { setEditItem(null); setEditForm({}); }}
                className="text-gray-500 text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Medicine', 'Stock', 'Reorder', 'Price', 'Discount', 'GST', 'Expiry', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">{search ? 'No results found.' : 'No items yet. Add your first item.'}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className={item.stock_qty <= item.reorder_level ? 'bg-red-50' : ''}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.medicine_name}</p>
                  {item.medicine?.generic_name && (
                    <p className="text-gray-400 text-xs">{item.medicine.generic_name}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${item.stock_qty <= item.reorder_level ? 'text-red-600' : 'text-gray-900'}`}>
                    {item.stock_qty}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{item.reorder_level}</td>
                <td className="px-4 py-3 text-gray-900">₹{item.mrp}</td>
                <td className="px-4 py-3 text-gray-500">
                  {item.discount_value > 0 ? (
                    <span className="text-emerald-600 font-medium">
                      {item.discount_type === 'percentage' ? `${item.discount_value}%` : `₹${item.discount_value}`}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{item.gst_rate ?? 12}%</td>
                <td className="px-4 py-3 text-gray-500">
                  {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(item)}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >«</button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >Prev</button>
            <span className="px-3 py-1 text-xs text-gray-600 font-medium">{page} / {pagination.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >Next</button>
            <button
              onClick={() => setPage(pagination.totalPages)}
              disabled={page === pagination.totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >»</button>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Medicine Finder — composition / generic search utility
// ─────────────────────────────────────────────────────────────────────────────
function MedicineFinder() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shopId = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('rxdesk_shop') || '{}').id as string | undefined; } catch { return undefined; } })()
    : undefined;

  const { data, isLoading, isFetching } = useQuery<any>({
    queryKey: ['medicine-finder', query],
    queryFn: () => medicinesApi.compositionSearch(query, shopId).then(r => r.data.data),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(val.trim()), 500);
  };

  const formMap: Record<string, string> = {
    tablet: '💊', capsule: '💊', syrup: '🍶', injection: '💉',
    ointment: '🧴', drops: '💧', inhaler: '🫧', powder: '🧂',
  };

  return (
    <div className="space-y-6">
      {/* Hero search bar */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-8 shadow-xl shadow-violet-200">
        <h2 className="text-white font-black text-xl tracking-tight mb-1">Medicine Composition Finder</h2>
        <p className="text-violet-200 text-sm font-medium mb-5">
          Type a brand name to find all medicines with the same generic composition
        </p>
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={handleChange}
            placeholder="e.g. Crocin, Augmentin, Dolo 650…"
            className="w-full bg-white/10 text-white placeholder-violet-300 border border-white/20 rounded-2xl px-5 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            autoFocus
          />
          {(isLoading || isFetching) && (
            <div className="absolute right-4 top-3.5 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Results */}
      {data && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Generic composition badge */}
          {data.generic_name ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center text-white text-sm font-black">Rx</div>
                <div>
                  <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Active Composition Found</p>
                  <p className="text-base font-black text-violet-900">{data.generic_name}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 font-medium">{data.alternatives.length} alternative{data.alternatives.length !== 1 ? 's' : ''} found in catalog</p>
            </div>
          ) : data.alternatives.length > 0 ? (
            <div className="mb-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <span>⚠️</span>
              <span className="font-medium">No generic composition data found — showing name matches only. Consider enriching your medicine catalog with generic names.</span>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-bold text-gray-600 mb-1">No medicines found</p>
              <p className="text-sm">Try a different name or check your medicine catalog</p>
            </div>
          )}

          {/* Alternatives grid */}
          {data.alternatives.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.alternatives.map((m: any) => (
                <div
                  key={m.id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all group ${
                    m.is_in_stock === true
                      ? 'border-emerald-100 hover:border-emerald-200'
                      : m.is_in_stock === false
                      ? 'border-gray-100 hover:border-violet-100'
                      : 'border-gray-100 hover:border-violet-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{m.name}</p>
                      {m.brand_name && m.brand_name !== m.name && (
                        <p className="text-[10px] text-gray-400 font-medium truncate">{m.brand_name}</p>
                      )}
                    </div>
                    {m.is_in_stock === true && (
                      <span className="shrink-0 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                        ✓ In Stock
                      </span>
                    )}
                    {m.is_in_stock === false && (
                      <span className="shrink-0 bg-gray-100 text-gray-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                        Not Stocked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {m.form && (
                      <span className="bg-violet-50 text-violet-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
                        {formMap[m.form] || '💊'} {m.form}
                      </span>
                    )}
                    {m.strength && (
                      <span className="bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
                        {m.strength}
                      </span>
                    )}
                    {m.is_schedule_h && (
                      <span className="bg-red-50 text-red-500 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
                        Sch-H
                      </span>
                    )}
                  </div>
                  {m.manufacturer && (
                    <p className="text-[10px] text-gray-400 mt-2 truncate">{m.manufacturer}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!data && !isLoading && query.length < 2 && (
        <div className="text-center py-20 text-gray-300">
          <p className="text-5xl mb-4">💊</p>
          <p className="font-bold text-gray-500 text-lg">Start typing a medicine name</p>
          <p className="text-sm text-gray-400 mt-1">We'll find all alternatives with the same composition</p>
        </div>
      )}
    </div>
  );
}
