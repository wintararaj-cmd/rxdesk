'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chamberApi, doctorApi } from '../../../lib/apiClient';

interface LinkedDoctor {
  id: string;
  status: string;
  consultation_fee: number;
  requested_by: string;
  created_at: string;
  doctor: { id: string; full_name: string; specialization?: string; experience_years?: number } | null;
  schedules: { day_of_week: number; start_time: string; end_time: string; slot_duration?: number; max_patients?: number }[];
}

interface DoctorStats {
  today_count: number;
  month_count: number;
  all_time_count: number;
  month_revenue: number;
  consultation_fee: number;
  completed_this_month: number;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_COLORS: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending:  'bg-amber-100 text-amber-700 border-amber-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ── Doctor Stats Card ──────────────────────────────────────────────────────
function DoctorStatsPanel({ chamberId }: { chamberId: string }) {
  const { data, isLoading } = useQuery<DoctorStats>({
    queryKey: ['chamber-stats', chamberId],
    queryFn: () => chamberApi.getDoctorStats(chamberId).then((r) => r.data.data),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50 animate-pulse">
      {[1,2,3].map(i => (
        <div key={i} className="h-12 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
  if (!data) return null;

  const stats = [
    { label: "Today", value: data.today_count, unit: 'appts', color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'This Month', value: data.month_count, unit: 'appts', color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Revenue', value: `₹${data.month_revenue.toLocaleString('en-IN')}`, unit: 'this month', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
          <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase">{s.label}</p>
          <p className="text-[9px] text-gray-300">{s.unit}</p>
        </div>
      ))}
    </div>
  );
}

// ── Schedule Viewer / Editor ───────────────────────────────────────────────
function SchedulePanel({ item }: { item: LinkedDoctor }) {
  const [open, setOpen] = useState(false);

  if (item.schedules.length === 0 && item.status !== 'active') return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-violet-600 font-semibold transition-colors w-full"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        {item.schedules.length > 0 ? (
          <span>{item.schedules.length} day{item.schedules.length !== 1 ? 's' : ''} scheduled</span>
        ) : (
          <span className="text-amber-500">No schedule set</span>
        )}
        <svg className={`w-3 h-3 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {/* Day grid */}
          <div className="flex gap-1 flex-wrap">
            {[0,1,2,3,4,5,6].map((day) => {
              const sched = item.schedules.find((s) => s.day_of_week === day);
              return (
                <div
                  key={day}
                  title={sched ? `${sched.start_time} – ${sched.end_time}` : 'Off'}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                    sched
                      ? 'bg-violet-50 text-violet-700 border-violet-200'
                      : 'bg-gray-50 text-gray-300 border-gray-100'
                  }`}
                >
                  {DAY_NAMES[day]}
                </div>
              );
            })}
          </div>
          {/* Time details */}
          {item.schedules.length > 0 && (
            <div className="space-y-1 mt-2">
              {item.schedules.map((s) => (
                <div key={s.day_of_week} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="font-semibold text-violet-700 w-8">{DAY_NAMES[s.day_of_week]}</span>
                  <span className="font-mono">{s.start_time} – {s.end_time}</span>
                  {s.slot_duration && (
                    <span className="text-gray-400">{s.slot_duration}min slots</span>
                  )}
                  {s.max_patients && (
                    <span className="text-gray-400">Max {s.max_patients}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DoctorsPage() {
  const qc = useQueryClient();
  const [mciInput, setMciInput] = useState('');
  const [feeInput, setFeeInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeVal, setEditingFeeVal] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expandedStats, setExpandedStats] = useState<string | null>(null);

  const { data: chambers = [], isLoading } = useQuery<LinkedDoctor[]>({
    queryKey: ['web-shop-chambers'],
    queryFn: () => chamberApi.getShopChambers().then((r) => r.data.data),
  });

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['web-doctor-search', searchQ],
    queryFn: () =>
      doctorApi.search({ q: searchQ, limit: 10 }).then((r) => r.data.data ?? r.data.doctors ?? []),
    enabled: searchQ.trim().length > 1,
  });

  const addMutation = useMutation({
    mutationFn: (data: object) => chamberApi.shopAddDoctor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-shop-chambers'] });
      setShowForm(false);
      setMciInput('');
      setFeeInput('');
    },
    onError: (err: any) => alert(err?.response?.data?.error?.message ?? 'Could not add doctor.'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => chamberApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['web-shop-chambers'] }),
    onError: (err: any) => alert(err?.response?.data?.error?.message ?? 'Could not approve.'),
  });

  const updateFeeMutation = useMutation({
    mutationFn: ({ id, fee }: { id: string; fee: number }) => chamberApi.updateFee(id, fee),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-shop-chambers'] });
      setEditingFeeId(null);
    },
    onError: (err: any) => alert(err?.response?.data?.error?.message ?? 'Could not update fee.'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => chamberApi.removeDoctor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-shop-chambers'] });
      setRemovingId(null);
    },
    onError: (err: any) => alert(err?.response?.data?.error?.message ?? 'Could not remove doctor.'),
  });

  const activeChambers  = chambers.filter((c) => c.status === 'active');
  const pendingChambers = chambers.filter((c) => c.status === 'pending');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeChambers.length} active · {pendingChambers.length} pending
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          {showForm ? '✕ Cancel' : '+ Add Doctor'}
        </button>
      </div>

      {/* Overview stats */}
      {activeChambers.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active Doctors', value: activeChambers.length, icon: '👨‍⚕️', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100' },
            { label: 'Pending Requests', value: pendingChambers.length, icon: '⏳', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
            { label: 'Total Linked', value: chambers.length, icon: '🔗', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-100' },
          ].map((s) => (
            <div key={s.label} className={`border rounded-2xl p-4 ${s.bg} flex items-center gap-3`}>
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Doctor Form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Link a Doctor by MCI Number</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter the doctor's MCI registration number. The doctor must be an approved RxDesk user.
          </p>

          {/* Live doctor search */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Search by Name (optional)</label>
            <div className="relative">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Type doctor name or specialization…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {searchResults.length > 0 && searchQ.trim().length > 1 && (
              <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-sm bg-white">
                {(searchResults as any[]).slice(0, 6).map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => { setMciInput(doc.mci_number); setSearchQ(''); }}
                    className="w-full text-left flex items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-violet-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Dr. {doc.full_name}</p>
                      {doc.specialization && <p className="text-gray-400 text-xs">{doc.specialization}</p>}
                      <p className="text-violet-500 text-xs mt-0.5">MCI: {doc.mci_number}</p>
                    </div>
                    <span className="text-violet-500 text-xs font-semibold ml-4">Select →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">MCI Number *</label>
              <input
                value={mciInput}
                onChange={(e) => setMciInput(e.target.value)}
                placeholder="e.g. MH-12345"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Consultation Fee (₹)</label>
              <input
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                placeholder="0"
                type="number"
                min={0}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </div>

          <button
            disabled={!mciInput.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate({ mci_number: mciInput.trim(), consultation_fee: feeInput ? Number(feeInput) : 0 })}
            className="bg-violet-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addMutation.isPending ? 'Linking…' : 'Link Doctor'}
          </button>
        </div>
      )}

      {/* Pending requests banner */}
      {pendingChambers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold text-amber-800 text-sm">{pendingChambers.length} pending request{pendingChambers.length !== 1 ? 's' : ''}</p>
            <p className="text-amber-600 text-xs mt-0.5">Doctor-initiated requests await your approval below.</p>
          </div>
        </div>
      )}

      {/* Doctors grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : chambers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">👨‍⚕️</p>
          <p className="text-gray-500">No doctors linked yet. Use the button above to add one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {chambers.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                item.status === 'inactive' ? 'opacity-60 border-gray-100' : 'border-gray-100 hover:shadow-md'
              }`}
            >
              {/* Doctor info */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                    {(item.doctor?.full_name ?? '?')[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">Dr. {item.doctor?.full_name ?? 'Unknown'}</p>
                    {item.doctor?.specialization && (
                      <p className="text-gray-500 text-xs">{item.doctor.specialization}</p>
                    )}
                    {item.doctor?.experience_years !== undefined && item.doctor.experience_years > 0 && (
                      <p className="text-gray-400 text-xs mt-0.5">{item.doctor.experience_years} yrs exp.</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border capitalize flex-shrink-0 ml-2 ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {item.status}
                </span>
              </div>

              {/* Fee row */}
              <div className="flex items-center justify-between py-2.5 border-t border-gray-50">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Consultation Fee</p>
                  {editingFeeId === item.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-500">₹</span>
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        value={editingFeeVal}
                        onChange={(e) => setEditingFeeVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateFeeMutation.mutate({ id: item.id, fee: Number(editingFeeVal) });
                          if (e.key === 'Escape') setEditingFeeId(null);
                        }}
                        className="w-20 border border-violet-400 rounded-lg px-2 py-1 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-violet-300"
                      />
                      <button
                        onClick={() => updateFeeMutation.mutate({ id: item.id, fee: Number(editingFeeVal) })}
                        disabled={updateFeeMutation.isPending}
                        className="text-xs bg-violet-600 text-white px-2 py-1 rounded-lg hover:bg-violet-700 disabled:opacity-50"
                      >✓</button>
                      <button onClick={() => setEditingFeeId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingFeeId(item.id); setEditingFeeVal(String(item.consultation_fee)); }}
                      className="flex items-center gap-1.5 group"
                    >
                      <span className="font-bold text-gray-900">₹{item.consultation_fee}</span>
                      <span className="text-gray-300 group-hover:text-violet-500 text-xs transition-colors">✎</span>
                    </button>
                  )}
                </div>

                {/* Schedule badges inline */}
                {item.schedules.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
                    {item.schedules.slice(0, 4).map((s) => (
                      <span key={s.day_of_week} className="bg-violet-50 text-violet-700 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                        {DAY_NAMES[s.day_of_week]}
                      </span>
                    ))}
                    {item.schedules.length > 4 && (
                      <span className="text-gray-400 text-[10px]">+{item.schedules.length - 4}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats — only for active */}
              {item.status === 'active' && (
                <div>
                  <button
                    onClick={() => setExpandedStats(expandedStats === item.id ? null : item.id)}
                    className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-violet-600 transition-colors mt-1 pt-1"
                  >
                    <span className="font-semibold uppercase tracking-wide">Performance</span>
                    <svg className={`w-3 h-3 transition-transform ${expandedStats === item.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {expandedStats === item.id && (
                    <DoctorStatsPanel chamberId={item.id} />
                  )}
                </div>
              )}

              {/* Schedule panel */}
              <SchedulePanel item={item} />

              {/* Actions */}
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
                {item.status === 'pending' && item.requested_by === 'doctor' && (
                  <button
                    onClick={() => approveMutation.mutate(item.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    ✓ Approve Request
                  </button>
                )}
                {item.status !== 'inactive' && (
                  <>
                    {removingId === item.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <p className="text-xs text-red-600 font-medium flex-1">Remove this doctor?</p>
                        <button
                          onClick={() => removeMutation.mutate(item.id)}
                          disabled={removeMutation.isPending}
                          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {removeMutation.isPending ? '…' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setRemovingId(null)}
                          className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRemovingId(item.id)}
                        className="ml-auto text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
