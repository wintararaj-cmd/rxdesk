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
  schedules: { day_of_week: number; start_time: string; end_time: string }[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<string, string> = {
  active:  'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
};

export default function DoctorsPage() {
  const qc = useQueryClient();
  const [mciInput, setMciInput] = useState('');
  const [feeInput, setFeeInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeVal, setEditingFeeVal] = useState('');

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-500 text-sm mt-1">{chambers.length} linked doctor{chambers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          {showForm ? '✕ Cancel' : '+ Add Doctor'}
        </button>
      </div>

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
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">Dr. {item.doctor?.full_name ?? 'Unknown'}</p>
                  {item.doctor?.specialization && (
                    <p className="text-gray-500 text-sm">{item.doctor.specialization}</p>
                  )}
                  {item.doctor?.experience_years !== undefined && (
                    <p className="text-gray-400 text-xs mt-0.5">{item.doctor.experience_years} yrs experience</p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {item.status}
                </span>
              </div>

              <div className="flex items-center gap-4 py-3 border-t border-gray-50">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Fee</p>
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
                      <span className="font-semibold text-gray-900 text-sm">₹{item.consultation_fee}</span>
                      <span className="text-gray-300 group-hover:text-violet-500 text-xs transition-colors">✎</span>
                    </button>
                  )}
                </div>
                {item.schedules.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Days</p>
                    <div className="flex flex-wrap gap-1">
                      {item.schedules.map((s) => (
                        <span key={s.day_of_week} className="bg-violet-50 text-violet-700 text-xs px-2 py-0.5 rounded-full">
                          {DAY_NAMES[s.day_of_week]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {item.status === 'pending' && item.requested_by === 'doctor' && (
                <button
                  onClick={() => approveMutation.mutate(item.id)}
                  disabled={approveMutation.isPending}
                  className="w-full mt-2 bg-emerald-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Approve Request
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
