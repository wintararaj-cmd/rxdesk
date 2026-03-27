'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminApi, subscriptionApi } from '../../../../lib/apiClient';

type ShopPlan = { id: string; name: string; price_monthly: number };
type ShopSub = { status: string; current_period_end: string | null; plan: ShopPlan | null };
type Shop = {
  id: string; shop_name: string; owner_name: string; address: string; city: string;
  state: string; pin_code: string; phone: string; gstin?: string; license_number?: string;
  verification_status: 'pending' | 'approved' | 'rejected'; created_at: string;
  owner: { phone: string }; subscription?: ShopSub | null;
};
type Plan = { id: string; name: string; price_monthly: number };

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: '' },
];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${cfg[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>{status}</span>;
}

function ShopsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rechargeModal, setRechargeModal] = useState<{ id: string; name: string } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [rechargePeriod, setRechargePeriod] = useState<string>('1');
  const [detailDrawer, setDetailDrawer] = useState<Shop | null>(null);

  const status = searchParams.get('status') ?? 'pending';

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    adminApi.getShops(status || undefined, search || undefined)
      .then((r) => setShops(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, search]);

  const loadPlans = useCallback(() => {
    subscriptionApi.getPlans().then((r) => {
      const p = r.data.data;
      setPlans(p);
      if (p.length > 0) setSelectedPlan(p[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => { load(); loadPlans(); }, [load, loadPlans]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleVerify = async (id: string, action: 'approved') => {
    setActionLoading(id + action);
    try { await adminApi.verifyShop(id, action); load(); }
    catch (err: any) { alert(err?.response?.data?.error?.message ?? 'Failed'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionLoading(rejectModal.id + 'rejected');
    try {
      await adminApi.verifyShop(rejectModal.id, 'rejected', rejectReason.trim());
      setRejectModal(null); setRejectReason(''); load();
    } catch (err: any) { alert(err?.response?.data?.error?.message ?? 'Failed'); }
    finally { setActionLoading(null); }
  };

  const handleRecharge = async () => {
    if (!rechargeModal || !selectedPlan) return;
    setActionLoading(rechargeModal.id + 'recharge');
    try {
      await adminApi.rechargeShop(rechargeModal.id, { plan_id: selectedPlan, months: Number(rechargePeriod) });
      setRechargeModal(null); load();
    } catch (err: any) { alert(err?.response?.data?.error?.message ?? 'Recharge Failed'); }
    finally { setActionLoading(null); }
  };

  const handleBulkAction = async (bulkStatus: 'approved' | 'rejected') => {
    if (!selected.size) return;
    if (!confirm(`${bulkStatus === 'approved' ? 'Approve' : 'Reject'} ${selected.size} selected shop(s)?`)) return;
    setActionLoading('bulk');
    try { await adminApi.bulkActionShops(Array.from(selected), bulkStatus); load(); }
    catch (err: any) { alert(err?.response?.data?.error?.message ?? 'Bulk action failed'); }
    finally { setActionLoading(null); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleAll = () => {
    setSelected(prev => prev.size === shops.length ? new Set() : new Set(shops.map(s => s.id)));
  };

  const setTab = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set('status', v); else params.delete('status');
    router.push(`/admin/dashboard/shops?${params.toString()}`);
  };

  const daysLeft = (end: string | null) => {
    if (!end) return null;
    const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Shops</h1>
          <p className="text-gray-500 text-sm mt-1">Review and manage medical shop registrations</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">{selected.size} selected</span>
            <button onClick={() => handleBulkAction('approved')} disabled={!!actionLoading}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/30 transition-all disabled:opacity-50">
              ✓ Bulk Approve
            </button>
            <button onClick={() => handleBulkAction('rejected')} disabled={!!actionLoading}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 transition-all disabled:opacity-50">
              ✗ Bulk Reject
            </button>
          </div>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${(status === t.value || (!status && !t.value)) ? 'bg-white/[0.08] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name, owner, city, phone…"
          className="flex-1 min-w-[200px] bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-rose-500/40 placeholder:text-gray-600 transition-all"
        />
        <span className="text-xs text-gray-600 tabular-nums">{shops.length} shops</span>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 animate-pulse h-28" />
        ))}</div>
      ) : shops.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm">No shops found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select all bar */}
          {shops.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={selected.size === shops.length && shops.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-rose-500 cursor-pointer" />
              <span className="text-xs text-gray-600">{selected.size > 0 ? `${selected.size} of ${shops.length} selected` : `Select all ${shops.length}`}</span>
            </div>
          )}

          {shops.map((s) => {
            const sub = (s as any).subscription;
            const days = sub ? daysLeft(sub?.current_period_end) : null;
            const subExpired = days !== null && days < 0;

            return (
              <div key={s.id} className={`bg-white/[0.04] border rounded-2xl p-5 transition-all ${selected.has(s.id) ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/[0.06] hover:border-white/[0.10]'}`}>
                <div className="flex items-start justify-between gap-4">
                  {/* Checkbox */}
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)}
                    className="w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5 accent-rose-500 cursor-pointer shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-white font-semibold text-sm">{s.shop_name}</h3>
                      <StatusBadge status={s.verification_status} />
                      {sub && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${subExpired ? 'bg-red-500/15 text-red-400 border-red-500/30' : days! <= 7 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-violet-500/15 text-violet-400 border-violet-500/30'}`}>
                          {subExpired ? 'Sub Expired' : `${sub.plan?.name ?? 'Plan'} · ${days}d left`}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs space-y-0.5">
                      <p><span className="text-gray-600">Owner:</span> {s.owner_name} · {s.owner.phone}</p>
                      <p><span className="text-gray-600">Address:</span> {s.address}, {s.city}, {s.state} – {s.pin_code}</p>
                      {s.license_number && <p><span className="text-gray-600">License:</span> <span className="font-mono text-gray-400">{s.license_number}</span></p>}
                      {s.gstin && <p><span className="text-gray-600">GSTIN:</span> <span className="font-mono text-gray-400">{s.gstin}</span></p>}
                      <p><span className="text-gray-600">Registered:</span> {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    <button onClick={() => setDetailDrawer(s)}
                      className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/10 text-gray-400 text-xs font-semibold rounded-lg border border-white/[0.08] transition-all">
                      Details →
                    </button>
                    {s.verification_status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleVerify(s.id, 'approved')} disabled={!!actionLoading}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/30 transition-all disabled:opacity-50">
                          {actionLoading === s.id + 'approved' ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => setRejectModal({ id: s.id, name: s.shop_name })} disabled={!!actionLoading}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 transition-all disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    )}
                    {s.verification_status === 'approved' && (
                      <button onClick={() => setRechargeModal({ id: s.id, name: s.shop_name })} disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-semibold rounded-lg border border-violet-500/30 transition-all disabled:opacity-50">
                        {actionLoading === s.id + 'recharge' ? '…' : '⚡ Recharge'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      {detailDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailDrawer(null)} />
          <div className="relative ml-auto w-full max-w-md bg-[#0d1117] border-l border-white/[0.08] h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Shop Details</h2>
              <button onClick={() => setDetailDrawer(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-5">
              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                <p className="text-white font-bold text-lg">{detailDrawer.shop_name}</p>
                <StatusBadge status={detailDrawer.verification_status} />
              </div>

              {[
                { label: 'Owner', value: detailDrawer.owner_name },
                { label: 'Phone', value: detailDrawer.owner.phone },
                { label: 'City', value: `${detailDrawer.city}, ${detailDrawer.state}` },
                { label: 'PIN', value: detailDrawer.pin_code },
                { label: 'GSTIN', value: detailDrawer.gstin ?? '—' },
                { label: 'License', value: detailDrawer.license_number ?? '—' },
                { label: 'Registered', value: new Date(detailDrawer.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-gray-500 text-sm">{label}</span>
                  <span className="text-gray-300 text-sm font-medium">{value}</span>
                </div>
              ))}

              {(detailDrawer as any).subscription && (() => {
                const sub = (detailDrawer as any).subscription;
                const days = daysLeft(sub.current_period_end);
                return (
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-sm">
                    <p className="text-violet-300 font-semibold mb-1">Subscription</p>
                    <p className="text-gray-400">{sub.plan?.name} · ₹{sub.plan?.price_monthly}/mo</p>
                    <p className={`font-medium ${days! < 0 ? 'text-red-400' : days! <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {days! < 0 ? 'Expired' : `${days} days left`}
                    </p>
                    {sub.current_period_end && <p className="text-gray-600 text-xs mt-1">Ends {new Date(sub.current_period_end).toLocaleDateString('en-IN')}</p>}
                  </div>
                );
              })()}

              {detailDrawer.verification_status === 'approved' && (
                <button onClick={() => { setDetailDrawer(null); setRechargeModal({ id: detailDrawer.id, name: detailDrawer.shop_name }); }}
                  className="w-full px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-sm font-semibold rounded-xl border border-violet-500/30 transition-all">
                  ⚡ Recharge Subscription
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111318] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-1">Reject Shop</h3>
            <p className="text-gray-500 text-sm mb-4">Reason for rejecting <span className="text-gray-300">{rejectModal.name}</span></p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Incomplete documentation, invalid licence number…"
              rows={4} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-white/20" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2 bg-white/[0.05] hover:bg-white/10 text-gray-300 text-sm font-semibold rounded-xl border border-white/[0.08] transition-all">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || !!actionLoading}
                className="flex-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold rounded-xl border border-red-500/30 transition-all disabled:opacity-50">
                {actionLoading ? '…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recharge Modal */}
      {rechargeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111318] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-1">Manual Recharge</h3>
            <p className="text-gray-500 text-sm mb-4">Extend subscription for <span className="text-gray-300">{rechargeModal.name}</span></p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Select Plan</label>
                <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50">
                  {plans.map(p => <option key={p.id} value={p.id} className="bg-gray-900">{p.name} (₹{p.price_monthly}/mo)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Period</label>
                <select value={rechargePeriod} onChange={e => setRechargePeriod(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50">
                  <option value="1" className="bg-gray-900">Monthly (1 Mo)</option>
                  <option value="3" className="bg-gray-900">Quarterly (3 Mo)</option>
                  <option value="6" className="bg-gray-900">Half-Yearly (6 Mo)</option>
                  <option value="12" className="bg-gray-900">Yearly (12 Mo)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRechargeModal(null)}
                className="flex-1 px-4 py-2 bg-white/[0.05] hover:bg-white/10 text-gray-300 text-sm font-semibold rounded-xl border border-white/[0.08] transition-all">Cancel</button>
              <button onClick={handleRecharge} disabled={!!actionLoading || !selectedPlan}
                className="flex-1 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-sm font-semibold rounded-xl border border-violet-500/30 transition-all disabled:opacity-50">
                {actionLoading ? '…' : 'Recharge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminShopsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 text-sm">Loading…</div>}>
      <ShopsContent />
    </Suspense>
  );
}
