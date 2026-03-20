'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, MapPin, Navigation, Stethoscope, Calendar, X, ChevronRight,
  Clock, CheckCircle, AlertCircle, RefreshCw, User, Star, Activity,
  Phone, Building, Heart, Pill, ArrowRight, Filter, Sparkles,
  CalendarCheck, CalendarX, TrendingUp,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorsApi, patientApi, chamberApi } from '../../../lib/apiClient';
import { useAuthStore } from '../../../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DoctorShop { id: string; shop_name: string; address_line: string; city: string; pin_code: string; }
interface Schedule { day_of_week: number; start_time: string; end_time: string; is_active: boolean; slot_duration?: number; }
interface Chamber { id: string; distance_km?: number; shop: DoctorShop; schedules?: Schedule[]; }
interface Doctor {
  id: string; full_name: string; specialization?: string;
  qualifications: string[]; experience_years?: number;
  consultation_fee?: number; chambers: Chamber[];
}
interface Slot { start: string; end: string; status: 'available' | 'booked' | 'blocked'; }
interface Appointment {
  id: string; appointment_date: string; slot_start_time: string; slot_end_time: string;
  token_number: number; status: string; chief_complaint?: string;
  chamber: {
    doctor: { full_name: string; specialization?: string };
    medical_shop?: { shop_name: string; address_line: string; city: string };
    shop?: { shop_name: string; address_line: string; city: string };
  };
}
interface PatientProfile {
  full_name: string; age?: number; gender?: string;
  blood_group?: string; city?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  booked:          { label: 'Booked',       color: 'text-blue-400',   bg: 'bg-blue-500/10',    border: 'border-blue-500/25',   dot: 'bg-blue-400' },
  confirmed:       { label: 'Confirmed',    color: 'text-emerald-400',bg: 'bg-emerald-500/10', border: 'border-emerald-500/25',dot: 'bg-emerald-400' },
  arrived:         { label: 'Arrived',      color: 'text-orange-400', bg: 'bg-orange-500/10',  border: 'border-orange-500/25', dot: 'bg-orange-400' },
  in_consultation: { label: 'In Progress',  color: 'text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/25', dot: 'bg-violet-400' },
  completed:       { label: 'Completed',    color: 'text-gray-400',   bg: 'bg-gray-500/10',    border: 'border-gray-500/20',   dot: 'bg-gray-400' },
  cancelled:       { label: 'Cancelled',    color: 'text-red-400',    bg: 'bg-red-500/10',     border: 'border-red-500/25',    dot: 'bg-red-400' },
  no_show:         { label: 'No Show',      color: 'text-amber-400',  bg: 'bg-amber-500/10',   border: 'border-amber-500/25',  dot: 'bg-amber-400' },
};

const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Orthopedic',
  'Pediatrician', 'Gynecologist', 'Neurologist', 'ENT', 'Ophthalmologist',
  'Psychiatrist', 'Dentist', 'Urologist',
];

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, gradient }:
  { icon: any; label: string; value: string | number; color: string; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} border`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <p className={`text-3xl font-black ${color} mb-1`}>{value}</p>
      <p className="text-xs text-white/50 font-medium">{label}</p>
    </div>
  );
}

// ── Appointment Card ──────────────────────────────────────────────────────────
function AppointmentCard({ apt }: { apt: Appointment }) {
  const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.booked;
  const dateStr = new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
  const shopName = apt.chamber?.medical_shop?.shop_name ?? apt.chamber?.['shop']?.shop_name ?? '';
  const city = apt.chamber?.medical_shop?.city ?? apt.chamber?.['shop']?.city ?? '';

  return (
    <div className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] hover:border-blue-500/20 rounded-2xl p-5 transition-all duration-200">
      <div className="flex items-start gap-4">
        {/* Token badge */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 flex flex-col items-center justify-center">
          <span className="text-[9px] text-gray-500 leading-none">Token</span>
          <span className="text-lg font-black text-blue-400 leading-tight">#{apt.token_number}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-white text-sm">Dr. {apt.chamber.doctor.full_name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {cfg.label}
            </span>
          </div>
          {apt.chamber.doctor.specialization && (
            <p className="text-xs text-blue-400/80 mb-1">{apt.chamber.doctor.specialization}</p>
          )}
          {shopName && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
              <Building className="w-3 h-3" />{shopName}{city ? ` · ${city}` : ''}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{apt.slot_start_time}</span>
          </div>
          {apt.chief_complaint && (
            <p className="text-xs text-gray-600 mt-2 italic">&ldquo;{apt.chief_complaint}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Doctor Card ───────────────────────────────────────────────────────────────
function DoctorCard({ doc, onBook }: { doc: Doctor; onBook: (doc: Doctor) => void }) {
  const initials = doc.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-blue-500/25 rounded-2xl p-5 transition-all duration-200">
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-blue-500/30 to-violet-600/30 border border-blue-500/25 rounded-2xl flex items-center justify-center">
          <span className="text-blue-300 font-black text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-white text-sm">Dr. {doc.full_name}</h3>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {doc.consultation_fee && (
                <span className="text-xs text-emerald-400 font-bold">₹{doc.consultation_fee}</span>
              )}
              {doc.experience_years && (
                <span className="text-[10px] text-gray-500">{doc.experience_years}+ yrs</span>
              )}
            </div>
          </div>
          {doc.specialization && (
            <p className="text-xs text-blue-400 font-medium mt-0.5">{doc.specialization}</p>
          )}
          {doc.qualifications?.length > 0 && (
            <p className="text-[11px] text-gray-600 mt-1">{doc.qualifications.join(', ')}</p>
          )}
        </div>
      </div>

      {/* Chambers */}
      {doc.chambers?.length > 0 && (
        <div className="space-y-2 mb-4">
          {doc.chambers.map((ch) => (
            <div key={ch.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-300">{ch.shop.shop_name}</p>
                  <p className="text-[11px] text-gray-600">{ch.shop.address_line}, {ch.shop.city}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ch.distance_km !== undefined && (
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        {ch.distance_km < 1 ? `${Math.round(ch.distance_km * 1000)} m away` : `${ch.distance_km.toFixed(1)} km away`}
                      </span>
                    )}
                    {ch.schedules && ch.schedules.length > 0 && (
                      <span className="text-[10px] text-gray-600">
                        {ch.schedules.filter(s => s.is_active).map(s => DAYS[s.day_of_week]).join(', ')}
                        {' '}{ch.schedules[0].start_time}–{ch.schedules[0].end_time}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onBook(doc)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-xs font-bold transition-all shadow shadow-blue-500/20 group-hover:shadow-blue-500/30"
      >
        <CalendarCheck className="w-3.5 h-3.5" />
        Book Appointment
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Booking Modal ─────────────────────────────────────────────────────────────
function BookingModal({
  doctor, onClose,
}: { doctor: Doctor; onClose: () => void }) {
  const qc = useQueryClient();
  const [selChamber, setSelChamber] = useState(doctor.chambers[0]?.id ?? '');
  const [selDate, setSelDate] = useState('');
  const [selSlot, setSelSlot] = useState('');
  const [complaint, setComplaint] = useState('');
  const [dateError, setDateError] = useState('');
  const [bookErr, setBookErr] = useState('');
  const [success, setSuccess] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const selectedChamber = doctor.chambers.find(c => c.id === selChamber);

  const { data: slots, isFetching: slotsLoading } = useQuery({
    queryKey: ['chamber-slots', selChamber, selDate],
    queryFn: () => chamberApi.getSlots(selChamber, selDate),
    enabled: !!(selChamber && selDate),
    select: (res) => (res.data.data?.slots ?? []) as Slot[],
  });

  const book = useMutation({
    mutationFn: () => patientApi.bookAppointment({
      chamber_id: selChamber, appointment_date: selDate,
      slot_start_time: selSlot, chief_complaint: complaint || undefined,
    }),
    onSuccess: () => { setSuccess(true); qc.invalidateQueries({ queryKey: ['patient-appointments'] }); },
    onError: (err: any) => setBookErr(err?.response?.data?.error?.message ?? 'Booking failed.'),
  });

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dStr = e.target.value;
    setDateError(''); setSelSlot('');
    if (!dStr) { setSelDate(''); return; }
    if (selectedChamber?.schedules?.length) {
      const dayOfWeek = new Date(dStr).getDay();
      const active = selectedChamber.schedules.filter(s => s.is_active).map(s => s.day_of_week);
      if (active.length && !active.includes(dayOfWeek)) {
        setDateError(`Available only on: ${active.map(d => DAYS[d]).join(', ')}`);
        setSelDate(''); return;
      }
    }
    setSelDate(dStr);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f0f1e] border border-white/[0.09] rounded-3xl w-full max-w-lg shadow-2xl shadow-blue-500/5 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-blue-500/25 rounded-xl flex items-center justify-center">
              <span className="text-blue-300 font-black text-xs">
                {doctor.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Book Appointment</h2>
              <p className="text-[11px] text-gray-500">Dr. {doctor.full_name}{doctor.specialization ? ` · ${doctor.specialization}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {success ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="font-bold text-xl mb-2 text-white">Appointment Booked! 🎉</h3>
            <p className="text-sm text-gray-400 mb-6">You&apos;ll receive a confirmation SMS shortly.</p>
            <button onClick={onClose} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl text-sm font-bold">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

            {/* Chamber selector */}
            {doctor.chambers.length > 1 && (
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium">Select Clinic</label>
                <div className="space-y-2">
                  {doctor.chambers.map((ch) => (
                    <label key={ch.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selChamber === ch.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]'
                    }`}>
                      <input type="radio" name="chamber" value={ch.id} checked={selChamber === ch.id}
                        onChange={() => { setSelChamber(ch.id); setSelDate(''); setSelSlot(''); setDateError(''); }}
                        className="mt-0.5 accent-blue-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{ch.shop.shop_name}</p>
                        <p className="text-xs text-gray-500">{ch.shop.address_line}, {ch.shop.city}</p>
                        {ch.distance_km !== undefined && (
                          <p className="text-xs text-emerald-400 font-medium mt-0.5">
                            {ch.distance_km < 1 ? `${Math.round(ch.distance_km * 1000)} m` : `${ch.distance_km.toFixed(1)} km`} away
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Single chamber info */}
            {selChamber && doctor.chambers.length === 1 && (
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 flex items-center gap-3">
                <Building className="w-4 h-4 text-gray-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{selectedChamber?.shop.shop_name}</p>
                  <p className="text-xs text-gray-500">{selectedChamber?.shop.address_line}, {selectedChamber?.shop.city}</p>
                </div>
              </div>
            )}

            {/* Available days */}
            {selectedChamber?.schedules && selectedChamber.schedules.filter(s => s.is_active).length > 0 && (
              <div className="flex items-center gap-2 text-xs bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span className="text-gray-500">
                  <span className="text-gray-400 font-medium">Available: </span>
                  {selectedChamber.schedules.filter(s => s.is_active).map(s =>
                    `${DAYS[s.day_of_week]} (${s.start_time}–${s.end_time})`
                  ).join(', ')}
                </span>
              </div>
            )}

            {/* Date picker */}
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">Select Date</label>
              <input
                type="date" min={today} value={selDate}
                onChange={handleDateChange}
                className="w-full h-11 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]"
              />
              {dateError && (
                <p className="text-xs text-orange-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />{dateError}
                </p>
              )}
            </div>

            {/* Time slots */}
            {selDate && selChamber && (
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium">Select Time Slot</label>
                {slotsLoading && <p className="text-xs text-gray-500 py-2">Loading slots…</p>}
                {!slotsLoading && slots && slots.length === 0 && (
                  <p className="text-xs text-orange-400 py-2">No slots available for this date.</p>
                )}
                {!slotsLoading && slots && slots.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button key={s.start} disabled={s.status !== 'available'} onClick={() => setSelSlot(s.start)}
                        className={`h-9 rounded-lg text-xs font-semibold transition-all border ${
                          s.status !== 'available'
                            ? 'opacity-25 cursor-not-allowed bg-white/[0.02] border-white/[0.04] text-gray-600'
                            : selSlot === s.start
                            ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/30'
                            : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:border-blue-500/40 hover:text-white hover:bg-blue-500/10'
                        }`}>
                        {s.start}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chief complaint */}
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">
                Chief Complaint <span className="text-gray-600">(optional)</span>
              </label>
              <textarea
                value={complaint} onChange={(e) => setComplaint(e.target.value)}
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
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <CalendarCheck className="w-4 h-4" />
              {book.isPending ? 'Booking…' : 'Confirm Appointment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function PatientDashboardPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  // Search
  const [query, setQuery] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState<{ q: string; lat?: number; lng?: number; specialization?: string }>({ q: '' });

  // Booking modal
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);

  const router = useRouter();
  
  // Active section
  const tabParam = searchParams.get('tab') as 'home' | 'search' | 'appointments' | 'profile' | null;
  const section = (tabParam && ['home', 'search', 'appointments', 'profile'].includes(tabParam)) ? tabParam : 'home';

  const setSection = useCallback((s: typeof section) => {
    if (s === 'home') {
      router.push('/patient/dashboard');
    } else {
      router.push(`/patient/dashboard?tab=${s}`);
    }
  }, [router]);

  // Profile
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

  // Load profile
  useEffect(() => {
    patientApi.getProfile().then(res => setPatientProfile(res.data?.data ?? null)).catch(() => {});
  }, []);

  // Open booking from URL param
  useEffect(() => {
    const bookId = searchParams.get('book');
    if (bookId) {
      doctorsApi.getById(bookId).then(res => {
        setBookingDoctor(res.data.data);
        setSection('search');
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSearchQuery({ q: query, specialization: specFilter || undefined, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
  };

  const { data: appointments, isLoading: aptsLoading, refetch: refetchApts } = useQuery({
    queryKey: ['patient-appointments'],
    queryFn: () => patientApi.getAppointments(),
    select: (res) => (res.data.data ?? []) as Appointment[],
  });

  const upcoming = (appointments ?? []).filter(a => ['booked', 'confirmed', 'arrived', 'in_consultation'].includes(a.status));
  const past = (appointments ?? []).filter(a => ['completed', 'cancelled', 'no_show'].includes(a.status));

  // ── NAV tabs ──────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'home', label: 'Home', icon: Activity },
    { id: 'search', label: 'Find Doctors', icon: Search },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  const displayName = patientProfile?.full_name ?? user?.phone ?? 'Patient';

  return (
    <>
      {/* ── Section tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl w-fit mb-8">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              section === id ? 'bg-white/[0.09] text-white shadow' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── HOME ──────────────────────────────────────────────────────── */}
      {section === 'home' && (
        <div className="space-y-8">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/20 via-violet-600/15 to-indigo-600/10 border border-blue-500/20 p-7">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-violet-600/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-2 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Welcome back
              </div>
              <h1 className="text-2xl font-black text-white mb-1">Hello, {displayName.split(' ')[0]}! 👋</h1>
              <p className="text-gray-400 text-sm mb-6">How are you feeling today? Find doctors near you or track your appointments.</p>
              <button
                onClick={() => setSection('search')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-bold transition-all shadow shadow-blue-500/20"
              >
                <Search className="w-3.5 h-3.5" />Find a Doctor
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={CalendarCheck} label="Upcoming" value={upcoming.length}
              color="text-blue-400" gradient="from-blue-600/15 to-blue-600/5 border-blue-500/20 bg-gradient-to-br"
            />
            <StatCard
              icon={CheckCircle} label="Completed" value={past.filter(a => a.status === 'completed').length}
              color="text-emerald-400" gradient="from-emerald-600/15 to-emerald-600/5 border-emerald-500/20 bg-gradient-to-br"
            />
            <StatCard
              icon={CalendarX} label="Cancelled" value={past.filter(a => a.status === 'cancelled').length}
              color="text-red-400" gradient="from-red-600/15 to-red-600/5 border-red-500/20 bg-gradient-to-br"
            />
            <StatCard
              icon={TrendingUp} label="Total" value={(appointments ?? []).length}
              color="text-violet-400" gradient="from-violet-600/15 to-violet-600/5 border-violet-500/20 bg-gradient-to-br"
            />
          </div>

          {/* Upcoming appointments preview */}
          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" /> Upcoming Appointments
                </h2>
                <button onClick={() => setSection('appointments')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-3">
                {upcoming.slice(0, 2).map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
              </div>
            </div>
          )}

          {/* Quick specialization search */}
          <div>
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-violet-400" /> Browse by Specialization
            </h2>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map(spec => (
                <button
                  key={spec}
                  onClick={() => { setSpecFilter(spec); setSection('search'); setHasSearched(true); setSearchQuery({ q: '', specialization: spec }); }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] hover:border-violet-500/30 hover:text-white rounded-xl transition-all"
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FIND DOCTORS ──────────────────────────────────────────────── */}
      {section === 'search' && (
        <div>
          <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" /> Find Doctors
          </h2>

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <div className="flex-1 flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 h-12 focus-within:border-blue-500/40 transition-all">
              <Search className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="text" value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Doctor name or specialization…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-600"
              />
              {query && (
                <button onClick={() => { setQuery(''); setSpecFilter(''); }} className="text-gray-600 hover:text-gray-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => { if (locStatus !== 'ok') locate(); }}
              className={`flex items-center gap-2 px-4 h-12 rounded-xl text-sm font-medium transition-all border shrink-0 ${
                locStatus === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : 'bg-white/[0.04] text-gray-400 hover:text-white border-white/[0.08]'
              }`}
            >
              <Navigation className="w-4 h-4" />
              {locStatus === 'ok' ? 'Located' : locStatus === 'loading' ? 'Locating…' : 'Near Me'}
            </button>
            <button
              onClick={runSearch} disabled={searching}
              className="px-6 h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-bold transition-all disabled:opacity-60 shadow shadow-blue-500/15 shrink-0"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {/* Specialization quick filters */}
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => { setSpecFilter(''); runSearch(); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all border ${!specFilter ? 'bg-blue-600/20 text-blue-300 border-blue-500/30' : 'text-gray-500 border-white/[0.08] hover:text-white'}`}
            >
              All
            </button>
            {SPECIALIZATIONS.slice(0, 8).map(spec => (
              <button
                key={spec}
                onClick={() => { setSpecFilter(spec); setHasSearched(true); setSearchQuery({ q: '', specialization: spec, ...(coords ?? {}) }); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all border ${specFilter === spec ? 'bg-violet-600/20 text-violet-300 border-violet-500/30' : 'text-gray-500 border-white/[0.08] hover:text-white'}`}
              >
                {spec}
              </button>
            ))}
          </div>

          {/* Results */}
          {!hasSearched && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-white/[0.03] border border-white/[0.06] rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Stethoscope className="w-9 h-9 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">Search for a doctor by name, specialization,</p>
              <p className="text-gray-600 text-sm">or use your location to find doctors nearby.</p>
            </div>
          )}

          {hasSearched && !searching && doctors.length === 0 && (
            <div className="text-center py-20">
              <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              <p className="font-semibold text-gray-500">No doctors found</p>
              <p className="text-sm text-gray-600 mt-1">Try a different name, specialization, or location</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {doctors.map(doc => (
              <DoctorCard key={doc.id} doc={doc} onBook={(d) => setBookingDoctor(d)} />
            ))}
          </div>
        </div>
      )}

      {/* ── APPOINTMENTS ──────────────────────────────────────────────── */}
      {section === 'appointments' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" /> My Appointments
            </h2>
            <button onClick={() => refetchApts()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {aptsLoading && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Loading appointments…
            </div>
          )}

          {!aptsLoading && (!appointments || appointments.length === 0) && (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-white/[0.03] border border-white/[0.06] rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-9 h-9 text-gray-700" />
              </div>
              <p className="font-semibold text-gray-500 mb-1">No appointments yet</p>
              <p className="text-sm text-gray-600 mb-5">Find a doctor and book your first visit</p>
              <button onClick={() => setSection('search')} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl text-sm font-bold">
                Find Doctors
              </button>
            </div>
          )}

          {!aptsLoading && appointments && appointments.length > 0 && (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Upcoming ({upcoming.length})
                  </h3>
                  <div className="space-y-3">
                    {upcoming.map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-600" />
                    Past Visits ({past.length})
                  </h3>
                  <div className="space-y-3 opacity-75">
                    {past.map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE ───────────────────────────────────────────────────── */}
      {section === 'profile' && (
        <div className="max-w-lg">
          <h2 className="text-lg font-black text-white mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-violet-400" /> My Profile
          </h2>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center text-xl font-black shadow-xl shadow-blue-500/20">
                {displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{patientProfile?.full_name ?? 'Your Name'}</h3>
                <p className="text-sm text-gray-500">{user?.phone}</p>
                <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">Patient</span>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Age', value: patientProfile?.age ? `${patientProfile.age} years` : '—', icon: User },
                { label: 'Gender', value: patientProfile?.gender ? patientProfile.gender.charAt(0).toUpperCase() + patientProfile.gender.slice(1) : '—', icon: User },
                { label: 'Blood Group', value: patientProfile?.blood_group ?? '—', icon: Heart },
                { label: 'City', value: patientProfile?.city ?? '—', icon: MapPin },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                  <p className="text-[11px] text-gray-600 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs text-gray-600">
              <Phone className="w-3 h-3" />
              <span>To update your profile, please contact support or your clinic.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKING MODAL ────────────────────────────────────────────── */}
      {bookingDoctor && (
        <BookingModal doctor={bookingDoctor} onClose={() => setBookingDoctor(null)} />
      )}
    </>
  );
}

export default function PatientDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>}>
      <PatientDashboardPageContent />
    </Suspense>
  );
}
