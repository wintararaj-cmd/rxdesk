'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, medicinesApi } from '../../../lib/apiClient';

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
};

export default function InventoryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'stock' | 'catalog'>('stock');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<typeof EMPTY_ADD_FORM>(EMPTY_ADD_FORM);
  const [editForm, setEditForm] = useState<Partial<typeof EMPTY_EDIT_FORM>>({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [catPage, setCatPage] = useState(1);
  const [catSearch, setCatSearch] = useState('');
  const [catSearchInput, setCatSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const handleAdd = () => {
    addMutation.mutate({
      medicine_name: form.medicine_name,
      hsn_code: form.hsn_code || undefined,
      unit: form.unit || 'strip',
      reorder_level: Number(form.reorder_level) || 10,
      mrp: Number(form.mrp),
      gst_rate: Number(form.gst_rate) || 12,
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
    });
  };

  const handleUpdate = () => {
    if (!editItem) return;
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
    { key: 'reorder_level', label: 'Reorder Level', type: 'number', span: 2, placeholder: 'Minimum stock before alert (default 10)' },
  ];

  // Edit form — all fields
  const EDIT_FIELDS: { key: keyof typeof EMPTY_EDIT_FORM; label: string; type: 'text' | 'number' | 'date' | 'select'; span: 1 | 2; note?: string }[] = [
    { key: 'medicine_name', label: 'Medicine Name', type: 'text', span: 2 },
    { key: 'mrp', label: 'MRP / Selling Price (₹)', type: 'number', span: 1 },
    { key: 'gst_rate', label: 'GST Rate (%)', type: 'select', span: 1 },
    { key: 'hsn_code', label: 'HSN Code', type: 'text', span: 1 },
    { key: 'unit', label: 'Unit', type: 'select', span: 1 },
    { key: 'reorder_level', label: 'Reorder Level', type: 'number', span: 2 },
    { key: 'stock_qty', label: 'Stock Qty', type: 'number', span: 1, note: 'Auto-updated from purchase invoices' },
    { key: 'purchase_price', label: 'Purchase Price (₹)', type: 'number', span: 1, note: 'Auto-updated from purchase invoices' },
    { key: 'batch_number', label: 'Batch No.', type: 'text', span: 1, note: 'Auto-updated from purchase invoices' },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date', span: 1, note: 'Auto-updated from purchase invoices' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tab === 'stock'
              ? (pagination ? `${pagination.total.toLocaleString()} items in stock` : '…')
              : (catalogPagination ? `${catalogPagination.total.toLocaleString()} medicines in catalog` : '…')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'stock' && (
            <>
              <Link
                href="/dashboard/inventory/import"
                className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold hover:border-violet-300 hover:text-violet-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Import CSV / JSON
              </Link>
              <button
                onClick={() => setShowAdd(true)}
                className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
              >
                + Add Item
              </button>
            </>
          )}
        </div>
      </div>

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
      </div>

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
                  ) : (
                    <input
                      type={type}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500"
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
              {['Medicine', 'Stock', 'Reorder', 'Price', 'GST', 'Expiry', 'Actions'].map((h) => (
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
