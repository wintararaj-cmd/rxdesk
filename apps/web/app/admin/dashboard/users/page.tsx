'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminApi } from '../../../../lib/apiClient';

type User = {
  id: string;
  phone: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
};

const ROLE_TABS = [
  { label: 'All', value: '' },
  { label: 'Patients', value: 'patient' },
  { label: 'Doctors', value: 'doctor' },
  { label: 'Shops', value: 'shop_owner' },
  { label: 'Admins', value: 'admin' },
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

  const role = searchParams.get('role') ?? '';

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getUsers(role || undefined)
      .then((r) => setUsers(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => { load(); }, [load]);

  const setTab = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set('role', v);
    else params.delete('role');
    router.push(`/admin/dashboard/users?${params.toString()}`);
  };

  const filtered = search.trim()
    ? users.filter((u) => u.phone.includes(search.trim()) || u.id.includes(search.trim()))
    : users;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
        <p className="text-gray-500 text-sm mt-1">All registered platform users (latest 200)</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
          {ROLE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${role === t.value
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="flex-1 min-w-[180px] bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-rose-500/40 placeholder:text-gray-600 transition-all"
          placeholder="Search by phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-gray-600 tabular-nums">{filtered.length} users</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-xl h-14 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm">No users found</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-300 text-sm">{u.phone}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />Active
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">Inactive</span>
                      )}
                      {u.is_verified && (
                        <span className="text-blue-400 text-xs">
                          <svg className="w-3.5 h-3.5 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                          {' '}Verified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs tabular-nums">
                    {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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
