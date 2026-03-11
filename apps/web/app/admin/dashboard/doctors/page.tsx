'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminApi } from '../../../../lib/apiClient';

type Doctor = {
  id: string;
  full_name: string;
  mci_number: string;
  specialization?: string;
  qualifications: string[];
  experience_years: number;
  verification_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  user: { phone: string; created_at: string };
};

const STATUS_TABS = [
  { label: 'Pending', value: 'pending', color: 'text-amber-400 border-amber-400' },
  { label: 'Approved', value: 'approved', color: 'text-emerald-400 border-emerald-400' },
  { label: 'Rejected', value: 'rejected', color: 'text-red-400 border-red-400' },
  { label: 'All', value: '', color: 'text-gray-400 border-gray-400' },
];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${cfg[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>{status}</span>;
}

function DoctorsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const status = searchParams.get('status') ?? 'pending';

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getDoctors(status || undefined)
      .then((r) => setDoctors(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await adminApi.verifyDoctor(id, 'approved');
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionLoading(rejectModal.id);
    try {
      await adminApi.verifyDoctor(rejectModal.id, 'rejected', rejectReason.trim());
      setRejectModal(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const setTab = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set('status', v);
    else params.delete('status');
    router.push(`/admin/dashboard/doctors?${params.toString()}`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Doctors</h1>
        <p className="text-gray-500 text-sm mt-1">Review and approve doctor registrations</p>
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
            <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-12 text-center">
          <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
          <p className="text-gray-500 text-sm">No doctors found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {doctors.map((d) => (
            <div key={d.id} className="bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] rounded-2xl p-5 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-white font-semibold text-sm">{d.full_name}</h3>
                    <StatusBadge status={d.verification_status} />
                  </div>
                  <div className="text-gray-500 text-xs space-y-0.5">
                    <p><span className="text-gray-600">MCI:</span> <span className="text-gray-400 font-mono">{d.mci_number}</span></p>
                    {d.specialization && <p><span className="text-gray-600">Specialization:</span> {d.specialization}</p>}
                    <p><span className="text-gray-600">Qualifications:</span> {d.qualifications.join(', ')}</p>
                    <p><span className="text-gray-600">Experience:</span> {d.experience_years} yrs · <span className="text-gray-600">Phone:</span> {d.user.phone}</p>
                    <p><span className="text-gray-600">Registered:</span> {new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    {d.rejection_reason && <p className="text-red-400"><span className="text-red-500">Reason:</span> {d.rejection_reason}</p>}
                  </div>
                </div>
                {d.verification_status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(d.id)}
                      disabled={actionLoading === d.id}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/30 transition-all disabled:opacity-50"
                    >
                      {actionLoading === d.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setRejectModal({ id: d.id, name: d.full_name })}
                      disabled={actionLoading === d.id}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111318] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold mb-1">Reject Doctor</h3>
            <p className="text-gray-500 text-sm mb-4">Provide a reason for rejecting <span className="text-gray-300">{rejectModal.name}</span>.</p>
            <textarea
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-rose-500/50 placeholder:text-gray-600 resize-none"
              rows={3}
              placeholder="e.g. Invalid MCI number, incomplete documents…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 h-10 rounded-xl bg-white/[0.06] text-gray-400 text-sm font-medium hover:bg-white/[0.09] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || !!actionLoading}
                className="flex-1 h-10 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50"
              >
                {actionLoading ? '…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDoctorsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 text-sm">Loading…</div>}>
      <DoctorsContent />
    </Suspense>
  );
}
