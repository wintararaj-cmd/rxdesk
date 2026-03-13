'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminApi, subscriptionApi } from '../../../../lib/apiClient';

type Shop = {
  id: string;
  shop_name: string;
  owner_name: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  phone: string;
  gstin?: string;
  license_number?: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  owner: { phone: string };
};

type Plan = {
  id: string;
  name: string;
  price_monthly: number;
};

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
  
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [rechargeModal, setRechargeModal] = useState<{ id: string; name: string } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [rechargePeriod, setRechargePeriod] = useState<string>('1');

  const status = searchParams.get('status') ?? 'pending';

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getShops(status || undefined)
      .then((r) => setShops(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  const loadPlans = useCallback(() => {
    subscriptionApi.getPlans()
      .then((r) => {
        const p = r.data.data;
        setPlans(p);
        if (p.length > 0) setSelectedPlan(p[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => { 
    load(); 
    loadPlans(); 
  }, [load, loadPlans]);

  const handleVerify = async (id: string, action: 'approved') => {
    setActionLoading(id + action);
    try {
      await adminApi.verifyShop(id, action);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionLoading(rejectModal.id + 'rejected');
    try {
      await adminApi.verifyShop(rejectModal.id, 'rejected', rejectReason.trim());
      setRejectModal(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecharge = async () => {
    if (!rechargeModal || !selectedPlan) return;
    setActionLoading(rechargeModal.id + 'recharge');
    try {
      await adminApi.rechargeShop(rechargeModal.id, { plan_id: selectedPlan, months: Number(rechargePeriod) });
      setRechargeModal(null);
      alert(`Successfully recharged ${rechargeModal.name} for ${rechargePeriod} month(s)!`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Recharge Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const setTab = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set('status', v);
    else params.delete('status');
    router.push(`/admin/dashboard/shops?${params.toString()}`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Shops</h1>
        <p className="text-gray-500 text-sm mt-1">Review and approve medical shop registrations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 mb-6 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${(status === t.value || (!status && !t.value))
              ? 'bg-white/[0.08] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-12 text-center">
          <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35" /></svg>
          <p className="text-gray-500 text-sm">No shops found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.map((s) => (
            <div key={s.id} className="bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] rounded-2xl p-5 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-white font-semibold text-sm">{s.shop_name}</h3>
                    <StatusBadge status={s.verification_status} />
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
                  {s.verification_status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerify(s.id, 'approved')}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/30 transition-all disabled:opacity-50"
                      >
                        {actionLoading === s.id + 'approved' ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectModal({ id: s.id, name: s.shop_name })}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 transition-all disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {s.verification_status === 'approved' && (
                    <button
                      onClick={() => setRechargeModal({ id: s.id, name: s.shop_name })}
                      disabled={!!actionLoading}
                      className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-semibold rounded-lg border border-violet-500/30 transition-all disabled:opacity-50"
                    >
                      {actionLoading === s.id + 'recharge' ? '…' : 'Recharge Shop'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111318] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-1">Reject Shop</h3>
            <p className="text-gray-500 text-sm mb-4">
              Provide a reason for rejecting{' '}
              <span className="text-gray-300">{rejectModal.name}</span>.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Incomplete documentation, invalid licence number…"
              rows={4}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-white/20"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2 bg-white/[0.05] hover:bg-white/10 text-gray-300 text-sm font-semibold rounded-xl border border-white/[0.08] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || !!actionLoading}
                className="flex-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold rounded-xl border border-red-500/30 transition-all disabled:opacity-50"
              >
                {actionLoading ? '…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recharge modal */}
      {rechargeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111318] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-1">Manual Recharge</h3>
            <p className="text-gray-500 text-sm mb-4">
              Extend subscription for <span className="text-gray-300">{rechargeModal.name}</span>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Select Plan</label>
                <select
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id} className="bg-gray-900">{p.name} (₹{p.price_monthly}/mo)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Recharge Period</label>
                <select
                  value={rechargePeriod}
                  onChange={e => setRechargePeriod(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                >
                  <option value="1" className="bg-gray-900">Monthly (1 Mo)</option>
                  <option value="3" className="bg-gray-900">Quarterly (3 Mo)</option>
                  <option value="6" className="bg-gray-900">Half-Yearly (6 Mo)</option>
                  <option value="12" className="bg-gray-900">Yearly (12 Mo)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRechargeModal(null)}
                className="flex-1 px-4 py-2 bg-white/[0.05] hover:bg-white/10 text-gray-300 text-sm font-semibold rounded-xl border border-white/[0.08] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRecharge}
                disabled={!!actionLoading || !selectedPlan}
                className="flex-1 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-sm font-semibold rounded-xl border border-violet-500/30 transition-all disabled:opacity-50"
              >
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
