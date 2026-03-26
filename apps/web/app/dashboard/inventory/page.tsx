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

interface MasterInventoryItem {
  id: string;
  medicine_id?: string;
  medicine_name: string;
  hsn_code?: string;
  unit?: string;
  rack_location?: string;
  reorder_level: number;
  total_stock: number;
  nearest_expiry?: string;
  max_mrp: number;
  min_mrp: number;
}

interface BatchItem {
  id: string;
  batch_number?: string;
  expiry_date?: string;
  stock_qty: number;
  mrp: number;
  purchase_price: number;
  hsn_code?: string;
  unit?: string;
  discount_type?: 'percentage' | 'amount';
  discount_value?: number;
}

interface InventoryItem extends BatchItem {
  medicine_name: string;
  medicine?: { generic_name?: string; form?: string; strength?: string };
  gst_rate: number;
  reorder_level: number;
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
  gst_rate: '5',
  hsn_code: '',
  unit: 'strip',
  discount_type: 'percentage',
  discount_value: '0',
  rack_location: '',
};

// Edit form — all fields (manual stock corrections + purchase-invoice fields)
const EMPTY_EDIT_FORM = {
  medicine_name: '',
  hsn_code: '',
  unit: 'strip',
  reorder_level: '',
  mrp: '',
  gst_rate: '5',
  stock_qty: '',
  purchase_price: '',
  batch_number: '',
  expiry_date: '',
  discount_type: 'percentage',
  discount_value: '0',
  rack_location: '',
};

// Component for each medicine in the master list
function InventoryMasterRow({ item, onEdit }: { item: MasterInventoryItem; onEdit: (it: MasterInventoryItem) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: batches = [], isLoading } = useQuery<BatchItem[]>({
    queryKey: ['inventory-batches', item.id],
    queryFn: () => inventoryApi.masterBatches(item.id).then((r) => r.data.data),
    enabled: expanded,
  });

  const isLowStock = item.total_stock <= item.reorder_level;

  return (
    <>
      <tr className={`hover:bg-gray-50/80 transition-colors border-b border-gray-50 ${isLowStock ? 'bg-red-50/30' : ''}`}>
        <td className="px-4 py-3">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 group text-left"
          >
            <div className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${expanded ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
              <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-violet-700">{item.medicine_name}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-tight">
                {item.unit || 'strip'}
                {item.hsn_code && <span className="ml-2 bg-gray-100 px-1 rounded">HSN: {item.hsn_code}</span>}
              </p>
            </div>
          </button>
        </td>
        <td className="px-4 py-3">
          <span className={`text-sm font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
            {item.total_stock}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 font-mono bg-gray-50/50">
          {item.rack_location || <span className="text-gray-300 italic">No Rack</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{item.reorder_level}</td>
        <td className="px-4 py-3 text-sm text-gray-900">
          {item.min_mrp === item.max_mrp ? `₹${item.min_mrp.toFixed(2)}` : `₹${item.min_mrp} - ${item.max_mrp}`}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {item.nearest_expiry ? (() => {
            const expiryDate = new Date(item.nearest_expiry);
            const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / 86400000);
            const isExpired = daysLeft <= 0;
            const isCritical = daysLeft <= 30;
            
            return (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isExpired ? 'bg-red-100 text-red-700' : isCritical ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {expiryDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                {isCritical && !isExpired && ' (soon)'}
              </span>
            );
          })() : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => onEdit(item)}
            className="text-xs text-violet-600 hover:text-violet-800 font-bold uppercase tracking-wider"
          >
            Edit
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-2 bg-gray-50/40 border-b border-gray-100">
            <div className="pl-7 pr-4 py-3 border-l-2 border-violet-100">
              {isLoading ? (
                <p className="text-xs text-gray-400 italic">Fetching batches...</p>
              ) : batches.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No storage records found.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50/80">
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2 text-left text-gray-500 font-bold uppercase tracking-tighter">Batch No.</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-bold uppercase tracking-tighter">Expiry</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-bold uppercase tracking-tighter text-right">Stock</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-bold uppercase tracking-tighter text-right">MRP</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-bold uppercase tracking-tighter text-right">Purchase Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {batches.filter(b => b.stock_qty !== 0).map((batch) => (
                        <tr key={batch.id} className="hover:bg-violet-50/30">
                          <td className="px-3 py-2 font-mono text-gray-700 font-medium">{batch.batch_number || 'No Batch'}</td>
                          <td className="px-3 py-2 text-gray-500">{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString('en-IN') : 'No Expiry'}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">{batch.stock_qty}</td>
                          <td className="px-3 py-2 text-right text-gray-600">₹{Number(batch.mrp).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-400">₹{Number(batch.purchase_price).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'stock' | 'catalog' | 'finder' | 'reports' | 'nearby'>('stock');
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

  const { data: queryResult, isLoading } = useQuery<{ data: MasterInventoryItem[] }>({
    queryKey: ['inventory', search],
    queryFn: () => inventoryApi.masterList({ q: search || undefined }).then((r) => ({ data: r.data.data })),
    placeholderData: (prev) => prev,
    enabled: tab === 'stock',
  });
  const items = queryResult?.data ?? [];
  const pagination: Pagination | null = null; // No pagination for master list for now

  const addMutation = useMutation({
    mutationFn: (data: object) => inventoryApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setShowAdd(false);
      setForm(EMPTY_ADD_FORM);
    },
  });

  const [catSuggestionsQuery, setCatSuggestionsQuery] = useState('');
  const { data: catSuggestions = [] } = useQuery<CatalogMedicine[]>({
    queryKey: ['medicine-suggestions', catSuggestionsQuery],
    queryFn: () => medicinesApi.catalog({ q: catSuggestionsQuery, pageSize: 5 }).then((r) => r.data.data),
    enabled: catSuggestionsQuery.length >= 2,
  });

  const handleSelectSuggestion = (m: CatalogMedicine) => {
    setForm({
      ...form,
      medicine_name: m.name,
      hsn_code: m.hsn_code ?? '',
      gst_rate: String(m.gst_rate ?? 5),
    });
    setCatSuggestionsQuery('');
  };

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

  const onExportExpiry = async () => {
    try {
      const res = await inventoryApi.exportExpiryExcel(expiryDays);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Expiring_Medicines_${expiryDays}days.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export report');
    }
  };

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
      rack_location: form.rack_location || '',
      mrp: Number(form.mrp),
      gst_rate: Number(form.gst_rate) || 5,
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
      gst_rate: String(item.gst_rate ?? 5),
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

    // Check if we are editing a Master record or a Batch record
    const isMaster = 'total_stock' in editItem;

    if (isMaster) {
      updateMasterMutation.mutate({
        id: editItem.id,
        data: {
          rack_location: editForm.rack_location,
          reorder_level: editForm.reorder_level ? Number(editForm.reorder_level) : undefined,
          hsn_code: editForm.hsn_code || undefined,
        }
      });
    } else {
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
    }
  };

  const updateMasterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => inventoryApi.updateMaster(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setEditItem(null);
      setEditForm({});
      setTriedToSubmit(false);
    },
  });

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
    { key: 'reorder_level', label: 'Reorder Level', type: 'number', span: 1, placeholder: '10' },
    { key: 'rack_location', label: 'Rack Location', type: 'text', span: 1, placeholder: 'e.g. A-1' },
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
    { key: 'reorder_level', label: 'Reorder Level', type: 'number', span: 1 },
    { key: 'rack_location', label: 'Rack Location', type: 'text', span: 1 },
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
              ? (items.length > 0 ? `${items.length.toLocaleString()} items in stock` : '…')
              : tab === 'catalog'
              ? (catalogPagination ? `${catalogPagination.total.toLocaleString()} medicines in catalog` : '…')
              : tab === 'nearby'
              ? 'Search medicine availability across nearby shops'
              : 'Find alternatives by composition'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'stock' && (
            <div className="flex gap-3 items-center">
              <button
                onClick={() => downloadCsv('inventory_import_template.csv', 'medicine_name,quantity,mrp,purchase_price,batch_number,expiry_date,gst_rate,hsn_code,unit,discount_type,discount_value,reorder_level,rack_location\n"Paracetamol 500 MG",100,15.50,10.20,"B123","2026-12-31",12,"30049099","strip","percentage",10,50,"A-1"')}
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
              <button 
                onClick={(e) => { e.stopPropagation(); onExportExpiry(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-[11px] font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export Report
              </button>
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
        <button
          onClick={() => setTab('reports')}
          className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${tab === 'reports' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📊 Reports
        </button>
        <button
          onClick={() => setTab('nearby')}
          className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${tab === 'nearby' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📍 Nearby Shops
        </button>
      </div>

      {/* ── FINDER TAB ───────────────────────────────────────────── */}
      {tab === 'finder' && <MedicineFinder />}
      {tab === 'reports' && <StockSupplierReport />}
      {tab === 'nearby' && <NearbyAvailability />}

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
                  {['Medicine', 'HSN', 'Generic Name', 'Form', 'Strength', 'Manufacturer', 'GST', 'Sch.H'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {catLoading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
                ) : catalogItems.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">{catSearch ? 'No results found.' : 'No medicines in catalog.'}</td></tr>
                ) : catalogItems.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.name}</p>
                      {m.brand_name && m.brand_name !== m.name && (
                        <p className="text-gray-400 text-xs">{m.brand_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.hsn_code ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.generic_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {m.form && (
                        <span className="inline-block bg-violet-50 text-violet-700 text-xs px-2 py-0.5 rounded-full capitalize">{m.form}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.strength ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.manufacturer ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.gst_rate ?? 5}%</td>
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
                {type === 'select' ? (
                  key === 'gst_rate' ? (
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                      value={form.gst_rate}
                      onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}
                    >
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  ) : key === 'unit' ? (
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : ( // This 'else' covers 'discount_type'
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                      value={form.discount_type}
                      onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="amount">Amount (₹)</option>
                    </select>
                  )
                ) : ( // This 'else' covers non-'select' types (the input field)
                  <div className="relative">
                    <input
                      type={type}
                      placeholder={placeholder}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 placeholder:text-gray-300"
                      value={form[key as keyof typeof EMPTY_ADD_FORM]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, [key]: val });
                        if (key === 'medicine_name') {
                          setCatSuggestionsQuery(val);
                        }
                      }}
                      onFocus={() => {
                        if (key === 'medicine_name' && form.medicine_name.length >= 2) {
                          setCatSuggestionsQuery(form.medicine_name);
                        }
                      }}
                    />
                    {key === 'medicine_name' && catSuggestions.length > 0 && catSuggestionsQuery.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {catSuggestions.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-violet-50 transition-colors group border-b border-gray-50 last:border-0"
                            onClick={() => handleSelectSuggestion(m)}
                          >
                            <div className="flex justify-between items-center text-left">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 truncate">{m.name}</p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase truncate">
                                  {m.generic_name || 'No Generic'} • {m.form || 'Tab'}
                                </p>
                              </div>
                              <div className="text-right ml-2 shrink-0">
                                {m.hsn_code && <p className="text-[10px] font-black text-violet-400">HSN: {m.hsn_code}</p>}
                                <p className="text-[10px] font-bold text-gray-400">{m.gst_rate ?? 5}% GST</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                      value={editForm.gst_rate ?? '5'}
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
              {['Medicine', 'Stock', 'Rack', 'Reorder', 'MRP Range', 'Next Expiry', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-xs text-gray-400 font-medium">Loading Inventory...</p>
                </div>
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">{search ? 'No results found.' : 'No items yet. Add your first item.'}</td></tr>
            ) : (items as any[]).map((item: MasterInventoryItem) => (
              <InventoryMasterRow key={item.id} item={item} onEdit={(it) => {
                // For edit, we populate a simpler form or handle rack-only update
                setEditItem({ ...it, stock_qty: it.total_stock, medicine_name: it.medicine_name, gst_rate: 5 } as any);
                setEditForm({
                   medicine_name: it.medicine_name,
                   rack_location: it.rack_location || '',
                   reorder_level: String(it.reorder_level),
                   unit: it.unit || 'strip',
                   hsn_code: it.hsn_code || '',
                });
              }} />
            ))}
          </tbody>
        </table>
      </div>
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

function StockSupplierReport() {
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounce = useRef<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-supplier-report', q],
    queryFn: () => inventoryApi.stockSupplierReport(q).then(r => r.data.data),
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQ(e.target.value.trim()), 400);
  };

  const downloadReport = () => {
    if (!data) return;
    const headers = ['Medicine', 'Generic', 'Batch', 'Expiry', 'Rack', 'Supplier', 'Invoice', 'Inv. Date', 'Stock', 'Unit', 'Purchase Price', 'MRP', 'Total Value (P)', 'Total Value (M)'];
    const rows = data.map((it: any) => [
      `"${it.medicine_name}"`,
      `"${it.generic_name || ''}"`,
      `"${it.batch_number || ''}"`,
      it.expiry_date ? new Date(it.expiry_date).toISOString().split('T')[0] : '',
      `"${it.rack_location || ''}"`,
      `"${it.supplier_name || 'Manual/NA'}"`,
      `"${it.invoice_number || ''}"`,
      it.invoice_date ? new Date(it.invoice_date).toISOString().split('T')[0] : '',
      it.stock_qty,
      `"${it.unit}"`,
      it.purchase_price,
      it.mrp,
      it.total_purchase_value,
      it.total_mrp_value
    ]);
    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stock_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Batch-wise &amp; Supplier-wise Stock</h2>
          <p className="text-xs text-gray-400 font-medium">Detailed breakdown of current stock with purchase origins</p>
        </div>
        <button 
          onClick={downloadReport}
          disabled={!data || data.length === 0}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <span>📥</span> Download CSV
        </button>
      </div>
      
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50">
        <div className="mb-6 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <span className="absolute left-3.5 top-2.5 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search by medicine name…"
              className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:bg-white transition-all shadow-inner"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>
          <div className="text-right">
             <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest leading-none">Total Stock Value (P.Price)</p>
             <p className="text-xl font-black text-violet-600">₹{data?.reduce((s: number, it: any) => s + (it.total_purchase_value || 0), 0).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="px-4 py-4 text-left font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100">Medicine / Generic</th>
                <th className="px-4 py-4 text-left font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100">Batch / Expiry</th>
                <th className="px-4 py-4 text-left font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100 text-center">Rack</th>
                <th className="px-4 py-4 text-left font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100">Supplier / Invoice</th>
                <th className="px-4 py-4 text-right font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100">Stock</th>
                <th className="px-4 py-4 text-right font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100">P.Price / MRP</th>
                <th className="px-4 py-4 text-right font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100">Total Val</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && <tr><td colSpan={7} className="text-center py-20 text-gray-400 italic">Calculating report data…</td></tr>}
              {data && data.length === 0 && <tr><td colSpan={7} className="text-center py-20 text-gray-400 font-medium">No records found.</td></tr>}
              {data?.map((it: any) => (
                <tr key={it.inventory_id} className="hover:bg-violet-50/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-gray-900 leading-tight">{it.medicine_name}</p>
                    <p className="text-[10px] text-gray-400 leading-tight uppercase font-medium mt-0.5">
                      {it.generic_name || 'Generic Not Linked'}
                      {it.hsn_code && <span className="ml-2 font-black text-violet-400">HSN: {it.hsn_code}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-mono text-xs text-gray-700 bg-gray-100 w-fit px-1.5 rounded">{it.batch_number || 'N/A'}</p>
                    {it.expiry_date && <p className={`text-[10px] font-black mt-1 ${new Date(it.expiry_date).getTime() < new Date().getTime() ? 'text-red-600' : 'text-orange-500'}`}>EXP: {new Date(it.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {it.rack_location ? (
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tight border border-indigo-100">📍 {it.rack_location}</span>
                    ) : (
                      <span className="text-gray-300 italic text-[10px]">No Rack</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs font-bold text-gray-900">{it.supplier_name || <span className="text-gray-400 font-normal italic text-[10px]">Manual Entry</span>}</p>
                    {it.invoice_number && <p className="text-[10px] text-gray-500 mt-0.5">Inv: #{it.invoice_number}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="font-black text-emerald-600 text-sm">{it.stock_qty}</p>
                    <p className="text-[10px] font-medium text-gray-400 lowercase">{it.unit}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-600">
                    <p className="text-xs font-bold">₹{it.purchase_price.toFixed(2)}</p>
                    <p className="text-[9px] text-gray-400 font-medium tracking-tight">MRP ₹{it.mrp.toFixed(2)}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="text-xs font-black text-gray-900">₹{it.total_purchase_value.toFixed(0)}</p>
                    <div className="w-full bg-gray-100 h-1 rounded-full mt-1.5 overflow-hidden">
                       <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (it.total_purchase_value / 5000) * 100)}%` }}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Nearby Medicine Availability — search which local shops have the medicine
// ─────────────────────────────────────────────────────────────────────────────
function NearbyAvailability() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [pincode, setPincode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rxdesk_shop') || '{}').pin_code as string || ''; } catch { return ''; }
  });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isFetching } = useQuery<any[]>({
    queryKey: ['medicine-availability', query, pincode],
    queryFn: () =>
      medicinesApi
        .checkAvailability(query, pincode || undefined)
        .then((r) => r.data.data),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(val.trim()), 600);
  };

  const gmapsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-8 shadow-2xl shadow-violet-200 relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-12 -left-8 w-56 h-56 bg-white/5 rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-lg">📍</div>
            <div>
              <h2 className="text-white font-black text-xl tracking-tight leading-tight">Nearby Medicine Availability</h2>
              <p className="text-violet-200 text-xs font-medium">Find which registered shops have a medicine in stock right now</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            {/* Medicine search */}
            <div className="md:col-span-2 relative">
              <label className="text-[10px] font-black text-violet-300 uppercase tracking-widest block mb-1.5">Medicine Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={handleChange}
                  placeholder="e.g. Paracetamol 500mg, Crocin…"
                  className="w-full bg-white/10 text-white placeholder-violet-300/70 border border-white/20 rounded-2xl px-5 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-sm pr-12"
                />
                {(isLoading || isFetching) && (
                  <div className="absolute right-4 top-3.5 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
            {/* Pin code filter */}
            <div>
              <label className="text-[10px] font-black text-violet-300 uppercase tracking-widest block mb-1.5">Pin Code (optional)</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 700001"
                maxLength={6}
                className="w-full bg-white/10 text-white placeholder-violet-300/70 border border-white/20 rounded-2xl px-5 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!data && !isLoading && query.length < 2 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-5 text-4xl shadow-inner">🏪</div>
          <h3 className="font-black text-gray-700 text-lg mb-1">Search a Medicine</h3>
          <p className="text-sm text-gray-400 font-medium">Type at least 2 characters to see which nearby shops have it in stock</p>
        </div>
      )}

      {/* No results */}
      {data && data.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-10 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-black text-amber-900 mb-1">No Shops Found</h3>
          <p className="text-sm text-amber-600/80 font-medium">
            No registered shop in {pincode ? `pin code <strong>${pincode}</strong>` : 'the system'} currently has <strong>{query}</strong> in stock.
          </p>
          <p className="text-xs text-amber-500 mt-2">Try a different medicine name or remove the pin code filter to search broadly.</p>
        </div>
      )}

      {/* Results grid */}
      {data && data.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 tracking-tight">Available At</h3>
              <p className="text-xs text-gray-400 font-medium">{data.length} shop{data.length !== 1 ? 's' : ''} found with <span className="text-violet-600 font-bold">{query}</span> in stock</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2 text-center">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Stock</p>
              <p className="text-xl font-black text-emerald-700">{data.reduce((s: number, it: any) => s + (it.stock_qty || 0), 0)} units</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((shop: any, i: number) => (
              <div
                key={`${shop.shop_id}-${i}`}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-violet-100 transition-all group overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 group-hover:text-violet-700 transition-colors truncate">{shop.shop_name}</p>
                      <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {[shop.address, shop.city].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-center shrink-0">
                      <p className="text-lg font-black leading-none">{shop.stock_qty}</p>
                      <p className="text-[9px] font-black uppercase tracking-wider leading-none mt-0.5">{shop.unit || 'units'}</p>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center text-sm">₹</div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">MRP</p>
                      <p className="font-black text-violet-700">₹{Number(shop.mrp).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    {shop.contact && (
                      <a
                        href={`tel:${shop.contact}`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-700 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        Call
                      </a>
                    )}
                    {shop.latitude && shop.longitude && (
                      <a
                        href={gmapsUrl(shop.latitude, shop.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        Map
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
