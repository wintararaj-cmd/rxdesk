'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminApi } from '../../../../lib/apiClient';

type User = { id: string; phone: string; role: string; is_verified: boolean; is_active: boolean; created_at: string };

const ROLE_TABS = [
  { label: 'All', value: '' }, { label: 'Patients', value: 'patient' },
  { label: 'Doctors', value: 'doctor' }, { label: 'Shops', value: 'shop_owner' }, { label: 'Admins', value: 'admin' },
];
const ROLE_COLORS: Record<string, string> = {
  patient: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  doctor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  shop_owner: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  admin: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

function RoleBadge({ role }: { role: string }) {
  const label = role === 'shop_owner' ? 'Shop' : role.charAt(0).toUpperCase() + role.slice(1);
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[role] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>{label}</span>;
}

function UsersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const role = searchParams.get('role') ?? '';

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getUsers(role || undefined, search || undefined)
      .then(r => setUsers(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setTab = (v: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (v) p.set('role', v); else p.delete('role');
    router.push(`/admin/dashboard/users?${p.toString()}`);
  };

  const handleToggle = async (u: User) => {
    if (!confirm(`${u.is_active ? 'Deactivate' : 'Reactivate'} user ${u.phone}?`)) return;
    setTogglingId(u.id);
    try {
      await adminApi.toggleUserActive(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Failed');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`PERMANENTLY DELETE user ${u.phone}?\nThis action CANNOT be undone and will delete ALL associated data (shops, doctors, patients, bills, etc).`)) return;
    setDeletingId(u.id);
    try {
      await adminApi.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    const url = adminApi.exportUsersCsvUrl(role || undefined);
    window.open(url, '_blank');
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
          <p className="text-gray-500 text-sm mt-1">All registered platform users · latest 300</p>
        </div>
        <button onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-semibold rounded-xl border border-emerald-500/30 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
          {ROLE_TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${role === t.value ? 'bg-white/[0.08] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by phone…"
          className="flex-1 min-w-[180px] bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-rose-500/40 placeholder:text-gray-600 transition-all" />
        <span className="text-xs text-gray-600 tabular-nums">{users.length} users</span>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-xl h-14 animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm">No users found</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Phone', 'Role', 'Status', 'Joined', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-white/[0.02] transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-gray-300 text-sm">{u.phone}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-600 text-xs"><span className="w-1.5 h-1.5 bg-gray-600 rounded-full" />Inactive</span>
                      )}
                      {u.is_verified && (
                        <span className="text-blue-400 text-xs font-medium">✓ Verified</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs tabular-nums">
                    {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.role !== 'admin' && (
                        <>
                          <button onClick={() => handleToggle(u)} disabled={togglingId === u.id || deletingId === u.id}
                            className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-all disabled:opacity-50 ${u.is_active ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}>
                            {togglingId === u.id ? '…' : u.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                          
                          {!u.is_active && (
                            <button onClick={() => handleDelete(u)} disabled={togglingId === u.id || deletingId === u.id}
                              className="text-xs px-3 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-semibold transition-all disabled:opacity-50">
                              {deletingId === u.id ? '…' : 'Delete Permanent'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 text-sm">Loading…</div>}>
      <UsersContent />
    </Suspense>
  );
}
