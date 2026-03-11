'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorApi, chamberApi, shopApi } from '../../../../lib/apiClient';

// ── Schedule types ─────────────────────────────────────────────────────────
type DayRow = {
  enabled: boolean;
  start_time: string;
  end_time: string;
  slot_duration: number;
  max_patients: number;
};
type WeekConfig = Record<number, DayRow>;

const DEFAULT_DAY: DayRow = {
  enabled: false,
  start_time: '09:00',
  end_time: '17:00',
  slot_duration: 15,
  max_patients: 20,
};

function initWeek(schedules: { day_of_week: number; start_time: string; end_time: string; slot_duration: number; max_patients: number }[]): WeekConfig {
  const week: WeekConfig = {};
  for (let i = 0; i <= 6; i++) week[i] = { ...DEFAULT_DAY };
  schedules.forEach((s) => {
    week[s.day_of_week] = { enabled: true, start_time: s.start_time, end_time: s.end_time, slot_duration: s.slot_duration, max_patients: s.max_patients };
  });
  return week;
}

interface Chamber {
  id: string;
  status: string;
  consultation_fee: number;
  requested_by: string;
  approved_at?: string;
  created_at: string;
  shop: {
    id: string;
    shop_name: string;
    address_line?: string;
    city: string;
    pin_code?: string;
    contact_phone?: string;
  } | null;
  schedules: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration: number;
    max_patients: number;
    is_active: boolean;
  }[];
}

interface ShopResult {
  id: string;
  shop_name: string;
  city: string;
  address_line?: string;
  pin_code?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<string, string> = {
  active:  'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
};

export default function DoctorChambersPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [shopQuery, setShopQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState<ShopResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [addError, setAddError] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Schedule modal state
  const [schedModal, setSchedModal] = useState<{ chamberId: string; shopName: string } | null>(null);
  const [weekConfig, setWeekConfig] = useState<WeekConfig>({});
  const [schedError, setSchedError] = useState('');

  const openSchedule = useCallback((ch: Chamber) => {
    setWeekConfig(initWeek(ch.schedules));
    setSchedError('');
    setSchedModal({ chamberId: ch.id, shopName: ch.shop?.shop_name ?? 'Chamber' });
  }, []);

  const updateDay = (day: number, patch: Partial<DayRow>) => {
    setWeekConfig((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const { data: shopResults = [], isFetching: shopSearching } = useQuery<ShopResult[]>({
    queryKey: ['shop-search', shopQuery],
    queryFn: () =>
      shopQuery.trim().length >= 2
        ? shopApi.search({ q: shopQuery.trim() }).then((r) => r.data.data ?? [])
        : Promise.resolve([]),
    enabled: shopQuery.trim().length >= 2,
    staleTime: 10_000,
  });

  const { data: chambers = [], isLoading } = useQuery<Chamber[]>({
    queryKey: ['doctor-web-chambers-full'],
    queryFn: () => doctorApi.getMyChambers().then((r) => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: object) => chamberApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-web-chambers-full'] });
      setShowAdd(false);
      setSelectedShop(null);
      setShopQuery('');
      setFeeInput('');
      setAddError('');
    },
    onError: (err: any) => setAddError(err?.response?.data?.error?.message ?? 'Could not send request.'),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ chamberId, schedules }: { chamberId: string; schedules: object[] }) =>
      chamberApi.setSchedule(chamberId, schedules),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-web-chambers-full'] });
      setSchedModal(null);
    },
    onError: (err: any) => setSchedError(err?.response?.data?.error?.message ?? 'Could not save schedule.'),
  });

  const handleSaveSchedule = () => {
    setSchedError('');
    const schedules = Object.entries(weekConfig)
      .filter(([, row]) => row.enabled)
      .map(([day, row]) => ({
        day_of_week: Number(day),
        start_time: row.start_time,
        end_time: row.end_time,
        slot_duration: row.slot_duration,
        max_patients: row.max_patients,
      }));
    if (schedules.length === 0) { setSchedError('Enable at least one day.'); return; }
    if (!schedModal) return;
    scheduleMutation.mutate({ chamberId: schedModal.chamberId, schedules });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Chambers</h1>
          <p className="text-gray-500 text-sm mt-1">{chambers.length} chamber{chambers.length !== 1 ? 's' : ''} linked</p>
        </div>
        <button
          onClick={() => { setShowAdd((v) => !v); setAddError(''); }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          {showAdd ? '✕ Cancel' : '+ Link Chamber'}
        </button>
      </div>

      {/* Add chamber form */}
      {showAdd && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">Request to Join a Medical Shop</h2>
          <p className="text-sm text-gray-500 mb-4">
            Search for a medical shop by name. Once submitted, the shop owner needs to approve your request.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Shop search */}
            <div ref={searchRef} className="relative">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Shop Name *</label>
              {selectedShop ? (
                <div className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-gray-800 flex-1">
                    {selectedShop.shop_name}
                    <span className="text-gray-400 ml-1 text-xs">· {selectedShop.city}</span>
                  </span>
                  <button
                    onClick={() => { setSelectedShop(null); setShopQuery(''); }}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >✕</button>
                </div>
              ) : (
                <>
                  <input
                    value={shopQuery}
                    onChange={(e) => { setShopQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Type shop name…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  {showDropdown && shopQuery.trim().length >= 2 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {shopSearching ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                      ) : shopResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">No shops found</div>
                      ) : shopResults.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedShop(s); setShowDropdown(false); setShopQuery(''); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-800">{s.shop_name}</p>
                          <p className="text-xs text-gray-400">{s.city}{s.address_line ? ` · ${s.address_line}` : ''}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Consultation fee */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Consultation Fee (₹)</label>
              <input
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                placeholder="0"
                type="number"
                min={0}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
          {addError && <p className="text-red-500 text-sm mb-3">{addError}</p>}
          <button
            disabled={!selectedShop || addMutation.isPending}
            onClick={() => selectedShop && addMutation.mutate({ shop_id: selectedShop.id, consultation_fee: feeInput ? Number(feeInput) : 0 })}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addMutation.isPending ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : chambers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🏥</p>
          <p className="text-gray-500">No chambers linked yet. Click &quot;Link Chamber&quot; to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {chambers.map((ch) => (
            <div key={ch.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {/* Shop info */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{ch.shop?.shop_name ?? 'Unknown Shop'}</p>
                  {ch.shop?.city && <p className="text-gray-500 text-sm">{ch.shop.city}{ch.shop.pin_code ? ` · ${ch.shop.pin_code}` : ''}</p>}
                  {ch.shop?.address_line && <p className="text-gray-400 text-xs mt-0.5">{ch.shop.address_line}</p>}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-2 ${STATUS_COLORS[ch.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ch.status}
                </span>
              </div>

              <div className="flex items-center gap-4 border-t border-gray-50 pt-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Fee</p>
                  <p className="font-semibold text-gray-900 text-sm">₹{ch.consultation_fee}</p>
                </div>
                {ch.shop?.contact_phone && (
                  <div>
                    <p className="text-xs text-gray-400">Contact</p>
                    <p className="text-gray-700 text-xs">{ch.shop.contact_phone}</p>
                  </div>
                )}
              </div>

              {/* Schedule */}
              {ch.schedules.length > 0 ? (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Schedule</p>
                  <div className="space-y-1">
                    {ch.schedules.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium w-10 text-center">
                          {DAY_NAMES[s.day_of_week]}
                        </span>
                        <span className="text-gray-600">{s.start_time} – {s.end_time}</span>
                        <span className="text-gray-400">· {s.slot_duration}min · max {s.max_patients}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-xs italic">No schedule set yet</p>
              )}

              {ch.status === 'active' && (
                <button
                  onClick={() => openSchedule(ch)}
                  className="mt-3 w-full border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  {ch.schedules.length > 0 ? '✏️ Edit Schedule' : '📅 Set Schedule'}
                </button>
              )}

              {ch.status === 'pending' && (
                <p className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  ⏳ Waiting for shop owner approval
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Schedule Modal ─────────────────────────────────────────── */}
      {schedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Weekly Schedule</h2>
                <p className="text-sm text-gray-500 mt-0.5">{schedModal.shopName}</p>
              </div>
              <button onClick={() => setSchedModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              <p className="text-xs text-gray-400 mb-2">Toggle days on/off. Each day can have independent hours, slot duration and patient limit.</p>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const row = weekConfig[day];
                return (
                  <div key={day} className={`rounded-2xl border transition-all ${row.enabled ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100 bg-gray-50/50'}`}>
                    {/* Day header row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => updateDay(day, { enabled: !row.enabled })}
                        className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${row.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${row.enabled ? 'translate-x-[18px]' : ''}`} />
                      </button>
                      <span className={`font-semibold text-sm w-10 ${row.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                        {DAY_NAMES[day]}
                      </span>
                      {row.enabled && (
                        <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </div>

                    {/* Expanded config when enabled */}
                    {row.enabled && (
                      <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Start Time</label>
                          <input
                            type="time"
                            value={row.start_time}
                            onChange={(e) => updateDay(day, { start_time: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">End Time</label>
                          <input
                            type="time"
                            value={row.end_time}
                            onChange={(e) => updateDay(day, { end_time: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Slot (min)</label>
                          <select
                            value={row.slot_duration}
                            onChange={(e) => updateDay(day, { slot_duration: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                          >
                            {[5, 10, 15, 20, 30, 45, 60].map((v) => (
                              <option key={v} value={v}>{v} min</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">Max Patients</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={row.max_patients}
                            onChange={(e) => updateDay(day, { max_patients: Math.max(1, Number(e.target.value)) })}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              {schedError && <p className="text-red-500 text-sm flex-1">{schedError}</p>}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => setSchedModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSchedule}
                  disabled={scheduleMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {scheduleMutation.isPending ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
