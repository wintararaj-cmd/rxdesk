'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../../../lib/apiClient';

type Medicine = {
  id: string; name: string; brand_name?: string; generic_name?: string;
  form?: string; strength?: string; manufacturer?: string; hsn_code?: string;
  gst_rate?: number; is_schedule_h?: boolean;
};

const EMPTY_FORM = { name: '', brand_name: '', generic_name: '', form: '', strength: '', manufacturer: '', hsn_code: '', gst_rate: 5, is_schedule_h: false };

export default function AdminMedicineCatalogPage() {
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = (q = search, pg = page) => {
    setLoading(true);
    adminApi.getMedicineCatalog(q || undefined, pg)
      .then(r => { setItems(r.data.data); setPagination(r.data.pagination); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); setSearch(searchInput); }, 400);
  }, [searchInput]);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEdit = (m: Medicine) => { setEditing(m); setForm({ name: m.name, brand_name: m.brand_name ?? '', generic_name: m.generic_name ?? '', form: m.form ?? '', strength: m.strength ?? '', manufacturer: m.manufacturer ?? '', hsn_code: m.hsn_code ?? '', gst_rate: m.gst_rate ?? 5, is_schedule_h: m.is_schedule_h ?? false }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Name is required');
    setSaving(true);
    try {
      if (editing) await adminApi.updateMedicine(editing.id, form);
      else await adminApi.createMedicine(form);
      setModalOpen(false);
      load();
    } catch (err: any) { alert(err?.response?.data?.error?.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this medicine from global catalog?')) return;
    setDeleteId(id);
    try { await adminApi.deleteMedicine(id); load(); }
    catch (err: any) { alert(err?.response?.data?.error?.message ?? 'Failed to delete'); }
    finally { setDeleteId(null); }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Medicine Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">Global medicine master — {pagination?.total?.toLocaleString() ?? '…'} medicines</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-rose-600/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add Medicine
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by name, generic, manufacturer…"
          className="flex-1 bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-rose-500/40 placeholder:text-gray-600" />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-xl h-12 animate-pulse" />)}</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Name', 'Generic', 'Form', 'HSN', 'GST', 'Sch.H', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-600">No medicines found</td></tr>
              ) : items.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-sm">{m.name}</p>
                    {m.brand_name && m.brand_name !== m.name && <p className="text-gray-600 text-xs">{m.brand_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.generic_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {m.form && <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded-full capitalize">{m.form}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{m.hsn_code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.gst_rate ?? 5}%</td>
                  <td className="px-4 py-3">
                    {m.is_schedule_h ? <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Yes</span> : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(m)} className="text-xs px-2 py-1 bg-white/[0.05] hover:bg-white/10 text-gray-400 rounded-lg border border-white/[0.08] transition-all">Edit</button>
                      <button onClick={() => handleDelete(m.id)} disabled={deleteId === m.id}
                        className="text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all disabled:opacity-50">
                        {deleteId === m.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-600">Page {page} of {pagination.totalPages} · {pagination.total.toLocaleString()} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 bg-white/[0.05] hover:bg-white/10 text-gray-400 text-xs font-semibold rounded-lg border border-white/[0.08] disabled:opacity-40 transition-all">Previous</button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="px-3 py-1 bg-white/[0.05] hover:bg-white/10 text-gray-400 text-xs font-semibold rounded-lg border border-white/[0.08] disabled:opacity-40 transition-all">Next</button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1117] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-semibold text-lg mb-5">{editing ? 'Edit Medicine' : 'Add Medicine'}</h3>
            <div className="space-y-4">
              {[
                { label: 'Medicine Name *', key: 'name', placeholder: 'e.g. Paracetamol 500mg' },
                { label: 'Brand Name', key: 'brand_name', placeholder: 'e.g. Calpol' },
                { label: 'Generic Name', key: 'generic_name', placeholder: 'e.g. Paracetamol' },
                { label: 'Form', key: 'form', placeholder: 'tablet / syrup / injection…' },
                { label: 'Strength', key: 'strength', placeholder: 'e.g. 500mg' },
                { label: 'Manufacturer', key: 'manufacturer', placeholder: 'e.g. GSK' },
                { label: 'HSN Code', key: 'hsn_code', placeholder: 'e.g. 30049099' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-rose-500/50 placeholder:text-gray-700" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">GST Rate (%)</label>
                  <select value={form.gst_rate} onChange={e => setForm(p => ({ ...p, gst_rate: Number(e.target.value) }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-rose-500/50">
                    {[0, 5, 12, 18, 28].map(r => <option key={r} value={r} className="bg-gray-900">{r}%</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative" onClick={() => setForm(p => ({ ...p, is_schedule_h: !p.is_schedule_h }))}>
                      <div className={`w-10 h-5 rounded-full transition-colors ${form.is_schedule_h ? 'bg-rose-600' : 'bg-white/10'}`} />
                      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all ${form.is_schedule_h ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm text-gray-400">Schedule H</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} disabled={saving}
                className="flex-1 px-4 py-2.5 border border-white/[0.08] text-gray-300 text-sm font-semibold rounded-xl hover:bg-white/[0.04] transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
