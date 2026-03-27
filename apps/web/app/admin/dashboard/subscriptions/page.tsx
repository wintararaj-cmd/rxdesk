'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminApi } from '../../../../lib/apiClient';

type sub = {
  id: string; status: string; current_period_start: string | null;
  current_period_end: string | null;
  plan: { id: string; name: string; price_monthly: number } | null;
  shop: { id: string; shop_name: string; owner_name: string; city: string; owner: { phone: string } };
};

const TABS = [
  { label: 'All', value: '' },
  { label: '✅ Active', value: 'active' },
  { label: '⚠️ Expiring Soon', value: 'soon' },
  { label: '❌ Expired', value: 'expired' },
];

function daysLeft(end: string | null) {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
}

function SubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [subs, setSubs] = useState<sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const filterTab = searchParams.get('filter') ?? '';

  const load = useCallback(() => {
    setLoading(true);
    const apiStatus = filterTab === 'soon' ? 'active' : filterTab || undefined;
    adminApi.getSubscriptions(apiStatus)
      .then(r => setSubs(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterTab]);

  useEffect(() => { load(); }, [load]);

  const setTab = (v: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (v) p.set('filter', v); else p.delete('filter');
    router.push(`/admin/dashboard/subscriptions?${p.toString()}`);
  };

  let filtered = subs.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      return s.shop.shop_name.toLowerCase().includes(q) || s.shop.owner_name.toLowerCase().includes(q) || s.shop.owner.phone.includes(q);
    }
    return true;
  });
  if (filterTab === 'soon') {
    filtered = filtered.filter(s => { const d = daysLeft(s.current_period_end); return d !== null && d >= 0 && d <= 30; });
  }

  const active = subs.filter(s => { const d = daysLeft(s.current_period_end); return d !== null && d > 0; }).length;
  const expiringSoon = subs.filter(s => { const d = daysLeft(s.current_period_end); return d !== null && d >= 0 && d <= 30; }).length;
  const expired = subs.filter(s => { const d = daysLeft(s.current_period_end); return d !== null && d < 0; }).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Subscriptions</h1>
        <p className="text-gray-500 text-sm mt-1">All shop subscription plans and renewal status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active', count: active, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400' },
          { label: 'Expiring in 30 days', count: expiringSoon, color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400' },
          { label: 'Expired', count: expired, color: 'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`bg-gradient-to-br ${color} border rounded-2xl p-4`}>
            <p className="text-2xl font-bold text-white">{count}</p>
            <p className="text-xs font-medium text-white/60 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterTab === t.value ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shop, owner, phone…"
          className="flex-1 min-w-[200px] bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-violet-500/40 placeholder:text-gray-600" />
        <span className="text-xs text-gray-600 tabular-nums">{filtered.length} results</span>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl h-20 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">No subscriptions found</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Shop', 'Plan', 'Status', 'Expires', 'Days Left', 'Phone'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(s => {
                const days = daysLeft(s.current_period_end);
                const isExpired = days !== null && days < 0;
                const isSoon = days !== null && days >= 0 && days <= 30;
                return (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-sm">{s.shop.shop_name}</p>
                      <p className="text-gray-600 text-xs">{s.shop.owner_name} · {s.shop.city}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-medium">
                        {s.plan?.name ?? 'N/A'}
                      </span>
                      {s.plan && <p className="text-gray-600 text-xs mt-0.5">₹{s.plan.price_monthly}/mo</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${isExpired ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
                        {isExpired ? 'expired' : 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">
                      {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {days !== null ? (
                        <span className={`font-bold text-sm ${isExpired ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isExpired ? `${Math.abs(days)}d ago` : `${days}d`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.shop.owner.phone}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 text-sm">Loading…</div>}>
      <SubContent />
    </Suspense>
  );
}
