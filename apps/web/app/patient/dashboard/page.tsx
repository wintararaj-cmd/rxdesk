'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search, MapPin, Navigation, Stethoscope, Calendar, X, ChevronRight,
  Clock, CheckCircle, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorsApi, patientApi, chamberApi } from '../../../lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DoctorShop { id: string; shop_name: string; address_line: string; city: string; pin_code: string; }
interface Schedule { day_of_week: number; start_time: string; end_time: string; is_active: boolean; slot_duration?: number; }
interface Chamber { id: string; distance_km?: number; shop: DoctorShop; schedules?: Schedule[]; }
interface Doctor { id: string; full_name: string; specialization?: string; qualifications: string[]; experience_years?: number; consultation_fee?: number; chambers: Chamber[]; }
interface Slot { start: string; end: string; status: 'available' | 'booked' | 'blocked'; }
interface Appointment { id: string; appointment_date: string; slot_start_time: string; slot_end_time: string; token_number: number; status: string; chief_complaint?: string; chamber: { doctor: { full_name: string; specialization?: string }; shop: { shop_name: string; address_line: string; city: string } }; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_COLOR: Record<string, string> = {
  booked: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  confirmed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  completed: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  cancelled: 'text-red-400 bg-red-500/10 border-red-500/20',
  no_show: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

export default function PatientDashboardPage() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  // Search state
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState<{ q: string; lat?: number; lng?: number }>({ q: '' });

  // Booking modal state
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [selChamber, setSelChamber] = useState('');
  const [selDate, setSelDate] = useState('');
  const [selSlot, setSelSlot] = useState('');
  const [complaint, setComplaint] = useState('');
  const [bookErr, setBookErr] = useState('');
  const [bookSuccess, setBookSuccess] = useState(false);

  // Active tab
  const [tab, setTab] = useState<'search' | 'appointments'>('search');

  // Open booking modal from URL param (coming from landing page)
  useEffect(() => {
    const bookId = searchParams.get('book');
    if (bookId) {
      doctorsApi.getById(bookId).then((res) => {
        openBooking(res.data.data);
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Doctor Search ─────────────────────────────────────────────────────────
  const locate = useCallback(() => {
    if (!navigator.geolocation) { setLocStatus('denied'); return; }
    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocStatus('ok'); },
      () => setLocStatus('denied'),
    );
  }, []);

  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['doctor-search', searchQuery],
    queryFn: () => doctorsApi.search({ ...searchQuery }),
    enabled: hasSearched,
    select: (res) => (res.data.data ?? []) as Doctor[],
  });
  const doctors = searchData ?? [];

  const runSearch = () => {
    setHasSearched(true);
    setSearchQuery({ q: query, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
  };

  // ── Appointments ──────────────────────────────────────────────────────────
  const { data: appointments, isLoading: aptsLoading, refetch: refetchApts } = useQuery({
    queryKey: ['patient-appointments'],
    queryFn: () => patientApi.getAppointments(),
    select: (res) => (res.data.data ?? []) as Appointment[],
  });

  // ── Slots ─────────────────────────────────────────────────────────────────
  const { data: slots, isFetching: slotsLoading } = useQuery({
    queryKey: ['chamber-slots', selChamber, selDate],
    queryFn: () => chamberApi.getSlots(selChamber, selDate),
    enabled: !!(selChamber && selDate),
    select: (res) => (res.data.data?.slots ?? []) as Slot[],
  });

  // ── Book appointment ──────────────────────────────────────────────────────
  const book = useMutation({
    mutationFn: () =>
      patientApi.bookAppointment({ chamber_id: selChamber, appointment_date: selDate, slot_start_time: selSlot, chief_complaint: complaint || undefined }),
    onSuccess: () => {
      setBookSuccess(true);
      qc.invalidateQueries({ queryKey: ['patient-appointments'] });
    },
    onError: (err: any) => {
      setBookErr(err?.response?.data?.error?.message ?? 'Booking failed. Please try again.');
    },
  });

  const openBooking = (doc: Doctor) => {
    setBookingDoctor(doc);
    setSelChamber(doc.chambers[0]?.id ?? '');
    setSelDate(''); setSelSlot(''); setComplaint('');
    setBookErr(''); setBookSuccess(false);
  };

  const closeBooking = () => { setBookingDoctor(null); setBookSuccess(false); };

  const selectedChamber = bookingDoctor?.chambers.find((c) => c.id === selChamber);

  // Build min date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      {/* ── TABS ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit mb-7">
        {(['search', 'appointments'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all capitalize ${ tab === t ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300' }`}>
            {t === 'appointments' ? 'My Appointments' : 'Find Doctors'}
          </button>
        ))}
      </div>

      {/* ── FIND DOCTORS TAB ────────────────────────────────────────── */}
      {tab === 'search' && (
        <div>
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-7">
            <div className="flex-1 flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 h-12 focus-within:border-blue-500/40 transition-all">
              <Search className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="text" value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Doctor name or specialization…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-600"
              />
            </div>
            <button
              onClick={() => { if (locStatus !== 'ok') locate(); }}
              title="Use my location"
              className={`flex items-center gap-2 px-4 h-12 rounded-xl text-sm font-medium transition-all border shrink-0 ${
                locStatus === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : locStatus === 'loading' ? 'bg-white/[0.03] text-gray-500 border-white/[0.06]'
                : 'bg-white/[0.04] text-gray-400 hover:text-white border-white/[0.08]'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>{locStatus === 'ok' ? 'Located' : locStatus === 'loading' ? 'Locating…' : 'Near Me'}</span>
            </button>
            <button onClick={runSearch} disabled={searching} className="px-6 h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 shadow shadow-blue-500/15 shrink-0">
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {/* Results */}
          {!hasSearched && (
            <div className="text-center py-20 text-gray-600">
              <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Search for a doctor by name, specialization, or use your location</p>
            </div>
          )}

          {hasSearched && !searching && doctors.length === 0 && (
            <div className="text-center py-20 text-gray-600">
              <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-gray-500">No doctors found</p>
              <p className="text-sm mt-1">Try a different name or specialization</p>
            </div>
          )}

          <div className="space-y-4">
            {doctors.map((doc) => (
              <div key={doc.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:border-blue-500/25 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/25 rounded-xl flex items-center justify-center">
                    <span className="text-blue-300 font-bold text-xs">{doc.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-0.5">
                      <h3 className="font-semibold text-white">Dr. {doc.full_name}</h3>
                      <div className="flex gap-3 text-xs text-gray-500 shrink-0">
                        {doc.experience_years ? <span>{doc.experience_years}+ yrs</span> : null}
                        {doc.consultation_fee ? <span className="text-emerald-400 font-medium">₹{doc.consultation_fee}</span> : null}
                      </div>
                    </div>
                    {doc.specialization && <p className="text-blue-400 text-sm mb-1">{doc.specialization}</p>}
                    {doc.qualifications?.length > 0 && <p className="text-xs text-gray-600 mb-3">{doc.qualifications.join(', ')}</p>}

                    {doc.chambers?.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {doc.chambers.map((ch) => (
                          <div key={ch.id} className="flex items-start gap-2 text-xs flex-wrap">
                            <MapPin className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
                            <span className="text-gray-400 font-medium">{ch.shop.shop_name}</span>
                            <span className="text-gray-600">· {ch.shop.address_line}, {ch.shop.city}</span>
                            {ch.distance_km !== undefined && (
                              <span className="text-emerald-400 font-semibold">
                                {ch.distance_km < 1 ? `${Math.round(ch.distance_km * 1000)} m away` : `${ch.distance_km.toFixed(1)} km away`}
                              </span>
                            )}
                            {ch.schedules && ch.schedules.length > 0 && (
                              <span className="text-gray-600 ml-1">
                                · {ch.schedules.map((s) => DAYS[s.day_of_week]).join(', ')} {ch.schedules[0].start_time}–{ch.schedules[0].end_time}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end mt-3 pt-3 border-t border-white/[0.05]">
                  <button
                    onClick={() => openBooking(doc)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-xs font-semibold transition-all shadow shadow-blue-500/15"
                  >
                    Book Appointment <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── APPOINTMENTS TAB ─────────────────────────────────────────── */}
      {tab === 'appointments' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-white">My Appointments</h2>
            <button onClick={() => refetchApts()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {aptsLoading && <p className="text-sm text-gray-500 py-8 text-center">Loading appointments…</p>}

          {!aptsLoading && (!appointments || appointments.length === 0) && (
            <div className="text-center py-20 text-gray-600">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-gray-500">No appointments yet</p>
              <p className="text-sm mt-1">Switch to &ldquo;Find Doctors&rdquo; to book your first appointment</p>
            </div>
          )}

          <div className="space-y-3">
            {appointments?.map((apt) => (
              <div key={apt.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.05] transition-all">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-white">Dr. {apt.chamber.doctor.full_name}</h3>
                      {apt.chamber.doctor.specialization && <span className="text-xs text-blue-400">{apt.chamber.doctor.specialization}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{apt.chamber.shop.shop_name} · {apt.chamber.shop.city}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(apt.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{apt.slot_start_time} – {apt.slot_end_time}</span>
                      <span className="text-gray-600">Token #{apt.token_number}</span>
                    </div>
                    {apt.chief_complaint && <p className="text-xs text-gray-600 mt-1.5 italic">&ldquo;{apt.chief_complaint}&rdquo;</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium capitalize shrink-0 ${STATUS_COLOR[apt.status] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
                    {apt.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BOOKING MODAL ────────────────────────────────────────────── */}
      {bookingDoctor && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBooking}>
          <div className="bg-[#111120] border border-white/[0.08] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
              <div>
                <h2 className="text-base font-bold">Book Appointment</h2>
                <p className="text-xs text-gray-500 mt-0.5">Dr. {bookingDoctor.full_name}{bookingDoctor.specialization ? ` · ${bookingDoctor.specialization}` : ''}</p>
              </div>
              <button onClick={closeBooking} className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {bookSuccess ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-1">Appointment Booked!</h3>
                <p className="text-sm text-gray-400 mb-6">You&apos;ll receive an SMS confirmation shortly.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { closeBooking(); setTab('appointments'); }} className="px-5 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm font-medium hover:bg-white/[0.1] transition-all">
                    View Appointments
                  </button>
                  <button onClick={closeBooking} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl text-sm font-semibold transition-all">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Chamber selector */}
                {bookingDoctor.chambers.length > 1 && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Select Clinic / Chamber</label>
                    <div className="space-y-2">
                      {bookingDoctor.chambers.map((ch) => (
                        <label key={ch.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selChamber === ch.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]'}`}>
                          <input type="radio" name="chamber" value={ch.id} checked={selChamber === ch.id} onChange={() => { setSelChamber(ch.id); setSelDate(''); setSelSlot(''); }} className="mt-0.5 accent-blue-500" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{ch.shop.shop_name}</p>
                            <p className="text-xs text-gray-500">{ch.shop.address_line}, {ch.shop.city}</p>
                            {ch.distance_km !== undefined && <p className="text-xs text-emerald-400 mt-0.5">{ch.distance_km < 1 ? `${Math.round(ch.distance_km * 1000)} m away` : `${ch.distance_km.toFixed(1)} km away`}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chamber info (single or selected) */}
                {selChamber && bookingDoctor.chambers.length === 1 && (
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
                    <p className="text-sm font-medium text-white">{selectedChamber?.shop.shop_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedChamber?.shop.address_line}, {selectedChamber?.shop.city}</p>
                  </div>
                )}

                {/* Available days */}
                {selectedChamber?.schedules && selectedChamber.schedules.length > 0 && (
                  <div className="text-xs text-gray-500">
                    <span className="font-medium text-gray-400">Available: </span>
                    {selectedChamber.schedules.filter(s => s.is_active).map((s) => `${DAYS[s.day_of_week]} (${s.start_time}–${s.end_time})`).join(', ')}
                  </div>
                )}

                {/* Date picker */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Select Date</label>
                  <input
                    type="date" min={today}
                    value={selDate}
                    onChange={(e) => { setSelDate(e.target.value); setSelSlot(''); }}
                    className="w-full h-11 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]"
                  />
                </div>

                {/* Time slots */}
                {selDate && selChamber && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Select Time Slot</label>
                    {slotsLoading && <p className="text-xs text-gray-500 py-2">Loading slots…</p>}
                    {!slotsLoading && slots && slots.length === 0 && (
                      <p className="text-xs text-orange-400 py-2">No slots available for this date</p>
                    )}
                    {!slotsLoading && slots && slots.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {slots.map((s) => (
                          <button
                            key={s.start}
                            disabled={s.status !== 'available'}
                            onClick={() => setSelSlot(s.start)}
                            className={`h-9 rounded-lg text-xs font-medium transition-all border ${
                              s.status !== 'available' ? 'opacity-30 cursor-not-allowed bg-white/[0.02] border-white/[0.04] text-gray-600'
                              : selSlot === s.start ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/20'
                              : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:border-blue-500/40 hover:text-white'
                            }`}
                          >
                            {s.start}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Chief complaint */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Chief Complaint <span className="text-gray-600">(optional)</span></label>
                  <textarea
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="Brief description of your concern…"
                    rows={2}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50 transition-all resize-none"
                  />
                </div>

                {bookErr && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {bookErr}
                  </div>
                )}

                <button
                  onClick={() => book.mutate()}
                  disabled={!selChamber || !selDate || !selSlot || book.isPending}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow shadow-blue-500/20"
                >
                  {book.isPending ? 'Booking…' : 'Confirm Appointment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
