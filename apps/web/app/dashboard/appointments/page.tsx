'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentApi, shopApi, chamberApi } from '../../../lib/apiClient';

// ── OPD Prescription Slip (A4) ───────────────────────────────────────────────
function printOpdSlip(
  appt: Appointment,
  shop: { shop_name?: string; address_line?: string; city?: string; contact_phone?: string } | null
) {
  const shopName = shop?.shop_name ?? 'Medical Shop';
  const shopAddress = [shop?.address_line, shop?.city].filter(Boolean).join(', ');
  const shopPhone = shop?.contact_phone ?? '';
  const doctorName = appt.chamber?.doctor?.full_name ? `Dr. ${appt.chamber.doctor.full_name}` : '';
  const specialization = appt.chamber?.doctor?.specialization ?? '';
  const patientName = appt.patient?.full_name ?? 'Walk-in Patient';
  const patientAge = appt.patient?.age ? `${appt.patient.age} yrs` : '';
  const patientGender = appt.patient?.gender ?? '';
  const patientPhone = appt.patient?.user?.phone ?? '';
  const patientInfo = [patientAge, patientGender].filter(Boolean).join(' · ');
  const date = new Date(appt.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const time = appt.slot_start_time ?? '';
  const complaint = appt.chief_complaint ?? '';
  const blankLines = (n: number) =>
    Array.from({ length: n }).map(() =>
      '<div style="border-bottom:1px solid #d1d5db;margin-bottom:16px;height:20px"></div>'
    ).join('');
  const medicineRows = Array.from({ length: 9 }).map(() =>
    '<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 6px"></td><td style="padding:8px 6px"></td><td style="padding:8px 6px"></td><td style="padding:8px 6px"></td></tr>'
  ).join('');
  const html = [
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OPD Slip</title>',
    '<style>',
    '*{margin:0;padding:0;box-sizing:border-box}',
    '@page{size:A4;margin:14mm 18mm}',
    'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111}',
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:12px;margin-bottom:14px}',
    '.sn{font-size:22px;font-weight:800;color:#7c3aed}',
    '.ss{font-size:11px;color:#6b7280;margin-top:4px}',
    '.db{text-align:right}',
    '.dn{font-size:16px;font-weight:700}',
    '.ds{font-size:11px;color:#7c3aed;font-weight:600;margin-top:2px}',
    '.strip{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 14px;display:flex;gap:24px;margin-bottom:18px;flex-wrap:wrap}',
    '.lbl{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;font-weight:700}',
    '.val{font-size:13px;font-weight:700;margin-top:2px}',
    '.sec{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7c3aed;margin:14px 0 7px}',
    '.rx{font-size:44px;font-weight:900;color:#e5e7eb;line-height:1;margin-bottom:4px}',
    '.cb{border:1px dashed #d1d5db;border-radius:6px;padding:8px 10px;min-height:36px;font-size:12px;color:#374151;margin-bottom:4px}',
    'table{width:100%;border-collapse:collapse;font-size:11px}',
    'thead th{text-align:left;padding:4px 6px;color:#6b7280;font-size:9px;text-transform:uppercase;border-bottom:1px solid #e5e7eb}',
    '.sig{margin-top:28px;text-align:right}',
    '.sl{display:inline-block;border-top:1.5px solid #374151;padding-top:6px;min-width:170px;text-align:center;font-size:11px}',
    '.ftr{border-top:1px solid #e5e7eb;margin-top:20px;padding-top:7px;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af}',
    '</style></head><body>',
    '<div class="hdr">',
    '  <div><div class="sn">' + shopName + '</div>',
    '  <div class="ss">' + shopAddress + (shopPhone ? ' &nbsp;|&nbsp; &#128222; ' + shopPhone : '') + '</div></div>',
    '  <div class="db">',
    (doctorName ? '    <div class="dn">' + doctorName + '</div>' : ''),
    (specialization ? '    <div class="ds">' + specialization + '</div>' : ''),
    '  </div>',
    '</div>',
    '<div class="strip">',
    '  <div><div class="lbl">Token</div><div class="val" style="font-size:22px;color:#7c3aed">#' + appt.token_number + '</div></div>',
    '  <div style="flex:1;min-width:140px"><div class="lbl">Patient Name</div><div class="val">' + patientName + '</div></div>',
    (patientInfo ? '  <div><div class="lbl">Age / Gender</div><div class="val">' + patientInfo + '</div></div>' : ''),
    (patientPhone ? '  <div><div class="lbl">Phone</div><div class="val">' + patientPhone + '</div></div>' : ''),
    '  <div><div class="lbl">Date</div><div class="val" style="font-size:11px">' + date + (time ? '<br><span style="color:#7c3aed">' + time + '</span>' : '') + '</div></div>',
    '</div>',
    (complaint ? '<div class="sec">Chief Complaint</div><div class="cb">' + complaint + '</div>' : ''),
    '<div class="sec">Diagnosis / Complaints</div>' + blankLines(3),
    '<div class="rx">Rx</div>',
    '<div class="sec" style="margin-top:0">Medicines</div>',
    '<table><thead><tr>',
    '  <th style="width:40%">Medicine Name</th>',
    '  <th style="width:20%">Dose</th>',
    '  <th style="width:20%">Frequency</th>',
    '  <th style="width:20%">Duration</th>',
    '</tr></thead><tbody>' + medicineRows + '</tbody></table>',
    '<div class="sec" style="margin-top:14px">Advice / Instructions</div>' + blankLines(3),
    '<div class="sec">Follow-up</div>' + blankLines(1),
    '<div class="sig"><div class="sl">',
    (doctorName ? doctorName + '<br><span style="font-size:10px;color:#9ca3af">' + specialization + '</span>' : 'Doctor Signature &amp; Stamp'),
    '</div></div>',
    '<div class="ftr"><span>' + shopName + ' — OPD Prescription Slip</span><span>Powered by RxDesk</span></div>',
    '</body></html>',
  ].join('\n');
  const w = window.open('', '_blank', 'width=820,height=1060');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); setTimeout(() => w.close(), 800); }, 400);
}

interface Appointment {
  id: string;
  token_number: number;
  status: string;
  appointment_date: string;
  slot_start_time?: string;
  chief_complaint?: string;
  patient?: { full_name?: string; age?: number; gender?: string; user?: { phone?: string } };
  chamber?: { doctor?: { full_name: string; specialization: string } };
}

interface Chamber {
  id: string;
  consultation_fee: number;
  doctor: { full_name: string; specialization: string } | null;
  schedules: { day_of_week: number; start_time: string; end_time: string }[];
}
interface Slot { start: string; end: string; status: string; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_META: Record<string, { label: string; pill: string; dot: string }> = {
  booked:          { label: 'Booked',          pill: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  confirmed:       { label: 'Confirmed',        pill: 'bg-sky-100 text-sky-700 border-sky-200',         dot: 'bg-sky-400' },
  arrived:         { label: 'Arrived',          pill: 'bg-orange-100 text-orange-700 border-orange-200',dot: 'bg-orange-400' },
  in_consultation: { label: 'In Consultation',  pill: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  completed:       { label: 'Completed',        pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled:       { label: 'Cancelled',        pill: 'bg-red-50 text-red-500 border-red-200',          dot: 'bg-red-400' },
  no_show:         { label: 'No Show',          pill: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400' },
};

export default function AppointmentsPage() {
  const qc = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['shop-me'],
    queryFn: () => shopApi.getMyShop().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  // Walk-in state
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [wiPhone, setWiPhone] = useState('');
  const [wiName, setWiName] = useState('');
  const [wiChamberId, setWiChamberId] = useState('');
  const [wiDate, setWiDate] = useState('');
  const [wiSlot, setWiSlot] = useState('');
  const [wiComplaint, setWiComplaint] = useState('');
  const [wiError, setWiError] = useState('');
  const [wiSuccess, setWiSuccess] = useState<{ token: number; patientName: string; doctor: string } | null>(null);

  // â”€â”€ Status filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ── View date (defaults to today) ────────────────────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10);
  const [viewDate, setViewDate] = useState<string>(todayIso);

  const { data: activeChambers = [] } = useQuery<Chamber[]>({
    queryKey: ['web-active-chambers'],
    queryFn: () => chamberApi.getShopChambers('active').then((r) => r.data.data),
    enabled: showWalkIn,
  });

  const selectedChamber = activeChambers.find((c) => c.id === wiChamberId);
  const scheduledDays = new Set(selectedChamber?.schedules.map((s) => s.day_of_week) ?? []);

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });

  const { data: wiSlots = [], isLoading: slotsLoading } = useQuery<Slot[]>({
    queryKey: ['web-wi-slots', wiChamberId, wiDate],
    queryFn: () => chamberApi.getAvailableSlots(wiChamberId, wiDate).then((r) => r.data.data?.slots ?? r.data.data ?? []),
    enabled: !!(wiChamberId && wiDate),
  });

  const walkInMutation = useMutation({
    mutationFn: (data: object) => appointmentApi.bookWalkIn(data),
    onSuccess: (res: any) => {
      const bookedDate = wiDate; // capture before state reset
      // Invalidate the specific date's cache then switch the main page to that date
      qc.invalidateQueries({ queryKey: ['today-appointments', bookedDate] });
      if (bookedDate) setViewDate(bookedDate);
      const token = res.data?.data?.token_number ?? res.data?.token_number;
      const name = (res.data?.data?.patient?.full_name ?? wiName) || 'Walk-in Patient';
      const doctor = selectedChamber?.doctor?.full_name ?? '';
      setWiSuccess({ token, patientName: name, doctor });
      setWiPhone(''); setWiName(''); setWiChamberId(''); setWiDate(''); setWiSlot(''); setWiComplaint(''); setWiError('');
    },
    onError: (err: any) => {
      setWiError(err?.response?.data?.error?.message ?? 'Could not book appointment. Please try again.');
    },
  });

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['today-appointments', viewDate],
    queryFn: () => shopApi.getTodayAppointments(viewDate).then((r) => r.data.data),
    refetchInterval: viewDate === todayIso ? 30_000 : false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['today-appointments', viewDate] }),
  });

  // Derived stats
  const stats = {
    total:    appointments.length,
    waiting:  appointments.filter((a) => ['booked', 'confirmed', 'arrived'].includes(a.status)).length,
    active:   appointments.filter((a) => a.status === 'in_consultation').length,
    done:     appointments.filter((a) => a.status === 'completed').length,
  };

  const filtered = statusFilter === 'all' ? appointments : appointments.filter((a) => a.status === statusFilter);

  const closeModal = () => { setShowWalkIn(false); setWiSuccess(null); setWiError(''); };

  return (
    <div className="p-6 space-y-6">

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewDate === todayIso ? "Today's Appointments" : 'Appointments'}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {new Date(viewDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date picker */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <input
              type="date"
              value={viewDate}
              onChange={(e) => { setViewDate(e.target.value); setStatusFilter('all'); }}
              className="text-sm text-gray-700 font-medium outline-none bg-transparent cursor-pointer"
            />
            {viewDate !== todayIso && (
              <button
                onClick={() => { setViewDate(todayIso); setStatusFilter('all'); }}
                className="ml-1 text-xs text-violet-600 font-semibold hover:underline whitespace-nowrap"
              >
                Back to Today
              </button>
            )}
          </div>
          <button
            onClick={() => setShowWalkIn(true)}
            className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Book Walk-in
          </button>
        </div>
      </div>

      {/* â”€â”€ Stat cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Today', value: stats.total, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'Waiting',     value: stats.waiting, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'In Progress', value: stats.active,  color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-100' },
          { label: 'Completed',   value: stats.done,    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* â”€â”€ Status filter tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'booked', 'arrived', 'in_consultation', 'completed', 'cancelled'].map((s) => {
          const meta = STATUS_META[s];
          const count = s === 'all' ? appointments.length : appointments.filter((a) => a.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === s
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {meta && <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === s ? 'bg-white' : meta.dot}`} />}
              {meta?.label ?? 'All'} <span className={`${statusFilter === s ? 'text-violet-200' : 'text-gray-400'}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* â”€â”€ Appointments table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            Loading appointmentsâ€¦
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <p className="font-medium">No appointments {statusFilter !== 'all' ? `with status "${STATUS_META[statusFilter]?.label}"` : 'today'}</p>
            <p className="text-sm mt-1">Click &quot;+ Book Walk-in&quot; to add one</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Token', 'Patient', 'Doctor', 'Time', 'Reason', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((appt) => {
                const meta = STATUS_META[appt.status] ?? STATUS_META['booked'];
                const isActive = appt.status === 'in_consultation';
                return (
                  <tr key={appt.id} className={`transition-colors hover:bg-gray-50/60 ${isActive ? 'bg-blue-50/30' : ''}`}>
                    {/* Token */}
                    <td className="px-4 py-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-violet-100 text-violet-700'}`}>
                        {appt.token_number}
                      </div>
                    </td>
                    {/* Patient */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-gray-900">{appt.patient?.full_name ?? 'â€”'}</p>                      {appt.patient?.user?.phone && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{appt.patient.user.phone}</p>
                      )}                      {(appt.patient?.age || appt.patient?.gender) && (
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {[appt.patient.age ? `${appt.patient.age}y` : null, appt.patient.gender].filter(Boolean).join(' Â· ')}
                        </p>
                      )}
                    </td>
                    {/* Doctor */}
                    <td className="px-4 py-3.5">
                      {appt.chamber?.doctor ? (
                        <>
                          <p className="font-medium text-gray-800">Dr. {appt.chamber.doctor.full_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{appt.chamber.doctor.specialization}</p>
                        </>
                      ) : <span className="text-gray-300">â€”</span>}
                    </td>
                    {/* Time */}
                    <td className="px-4 py-3.5">
                      {appt.slot_start_time ? (
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{appt.slot_start_time}</span>
                      ) : <span className="text-gray-300 text-xs">â€”</span>}
                    </td>
                    {/* Reason */}
                    <td className="px-4 py-3.5 max-w-[160px]">
                      <p className="text-gray-500 text-xs truncate">{appt.chief_complaint ?? <span className="text-gray-300">â€”</span>}</p>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${meta.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${isActive ? 'animate-pulse' : ''}`} />
                        {meta.label}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {['booked', 'confirmed', 'arrived'].includes(appt.status) && (
                          <button
                            onClick={() => updateMutation.mutate({ id: appt.id, status: 'in_consultation' })}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            Start
                          </button>
                        )}
                        {appt.status === 'in_consultation' && (
                          <button
                            onClick={() => updateMutation.mutate({ id: appt.id, status: 'completed' })}
                            className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                          >
                            Complete
                          </button>
                        )}
                        {['booked', 'confirmed'].includes(appt.status) && (
                          <button
                            onClick={() => updateMutation.mutate({ id: appt.id, status: 'no_show' })}
                            className="text-xs text-gray-400 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:text-red-500 hover:border-red-200 transition-colors"
                          >
                            No Show
                          </button>
                        )}
                        <button
                          onClick={() => printOpdSlip(appt, shopData as any)}
                          title="Print OPD Prescription Slip"
                          className="text-xs text-violet-600 border border-violet-200 bg-violet-50 px-2.5 py-1.5 rounded-lg hover:bg-violet-100 hover:border-violet-400 transition-colors font-medium flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                          </svg>
                          Print Slip
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* â”€â”€ Walk-in Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showWalkIn && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Book Walk-in</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fill patient details to register a walk-in visit</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* â”€â”€ Success state â”€â”€ */}
              {wiSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm mb-3">Appointment booked successfully</p>
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl py-5 px-6 mb-4">
                    <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">Token Number</p>
                    <p className="text-5xl font-black text-violet-700">#{wiSuccess.token}</p>
                    <p className="font-semibold text-gray-900 mt-2">{wiSuccess.patientName}</p>
                    {wiSuccess.doctor && <p className="text-gray-400 text-sm mt-0.5">Dr. {wiSuccess.doctor}</p>}
                  </div>
                  <button
                    onClick={() => setWiSuccess(null)}
                    className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors"
                  >
                    Book Another
                  </button>
                </div>
              ) : (
                <>
                  {/* Phone + Name */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Phone *</label>
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-violet-400">
                        <span className="px-3 text-sm text-gray-400 font-medium border-r border-gray-200 py-2.5 bg-gray-50">+91</span>
                        <input
                          value={wiPhone}
                          onChange={(e) => setWiPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="10-digit number"
                          maxLength={10}
                          type="tel"
                          className="flex-1 px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Name <span className="normal-case font-normal">(optional)</span></label>
                      <input
                        value={wiName}
                        onChange={(e) => setWiName(e.target.value)}
                        placeholder="Patient name"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                      />
                    </div>
                  </div>

                  {/* Doctor selector */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Doctor *</label>
                    <div className="flex flex-col gap-2">
                      {activeChambers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setWiChamberId(c.id); setWiSlot(''); setWiError(''); setWiDate(new Date().toISOString().slice(0, 10)); }}
                          className={`text-left border rounded-xl px-4 py-3 text-sm transition-all ${wiChamberId === c.id ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300' : 'border-gray-200 hover:border-violet-200 bg-white'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">
                              {c.doctor ? `Dr. ${c.doctor.full_name}` : 'Unknown Doctor'}
                            </span>
                            <span className="text-violet-600 text-xs font-semibold bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">â‚¹{c.consultation_fee}</span>
                          </div>
                          {c.doctor?.specialization && <p className="text-gray-400 text-xs mt-0.5">{c.doctor.specialization}</p>}
                        </button>
                      ))}
                      {activeChambers.length === 0 && (
                        <p className="text-gray-400 text-sm text-center py-4 border border-dashed border-gray-200 rounded-xl">No active chambers found</p>
                      )}
                    </div>
                  </div>

                  {/* Date picker */}
                  {wiChamberId && (
                    <div className="mb-4">
                      <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Date *</label>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {next7Days.map((d) => {
                          const iso = d.toISOString().slice(0, 10);
                          const isSelected = wiDate === iso;
                          const isScheduled = scheduledDays.size === 0 || scheduledDays.has(d.getDay());
                          const scheduleForDay = selectedChamber?.schedules.find((s) => s.day_of_week === d.getDay());
                          return (
                            <button
                              key={iso}
                              disabled={!isScheduled}
                              onClick={() => { setWiDate(iso); setWiSlot(''); setWiError(''); }}
                              className={`flex-shrink-0 w-14 rounded-xl border flex flex-col items-center justify-center py-2 gap-0.5 transition-all text-xs ${
                                !isScheduled
                                  ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-violet-500 bg-violet-600 text-white font-bold shadow-md shadow-violet-200'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-violet-400'
                              }`}
                              title={scheduleForDay ? `${scheduleForDay.start_time} â€“ ${scheduleForDay.end_time}` : 'Off day'}
                            >
                              <span className="font-medium">{DAYS[d.getDay()]}</span>
                              <span className="text-base font-black leading-tight">{d.getDate()}</span>
                              {isScheduled && scheduleForDay && (
                                <span className={`text-[9px] leading-tight ${isSelected ? 'text-violet-200' : 'opacity-60'}`}>{scheduleForDay.start_time}</span>
                              )}
                              {!isScheduled && <span className="text-[9px] leading-tight">Off</span>}
                            </button>
                          );
                        })}
                      </div>
                      {scheduledDays.size === 0 && (
                        <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                          No schedule set â€” current time will be used as slot
                        </p>
                      )}
                    </div>
                  )}

                  {/* Slot picker */}
                  {wiDate && scheduledDays.size > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Time Slot <span className="normal-case font-normal">(optional)</span></label>
                        {wiSlot && <button onClick={() => setWiSlot('')} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>}
                      </div>
                      {slotsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                          Loading slotsâ€¦
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 gap-1.5">
                            {wiSlots.filter((s) => s.status === 'available').map((s) => (
                              <button
                                key={s.start}
                                onClick={() => setWiSlot(wiSlot === s.start ? '' : s.start)}
                                className={`border rounded-lg py-2 text-xs font-medium transition-all ${wiSlot === s.start ? 'border-violet-500 bg-violet-600 text-white' : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50'}`}
                              >
                                {s.start}
                              </button>
                            ))}
                          </div>
                          {wiSlots.filter((s) => s.status === 'available').length === 0 && (
                            <p className="text-red-500 text-sm py-2">No available slots for this date</p>
                          )}
                          {wiSlots.filter((s) => s.status === 'available').length > 0 && !wiSlot && (
                            <p className="text-xs text-gray-400 mt-1">Leave unselected to auto-assign the next slot</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Complaint */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Chief Complaint <span className="normal-case font-normal">(optional)</span></label>
                    <textarea
                      value={wiComplaint}
                      onChange={(e) => setWiComplaint(e.target.value)}
                      placeholder="e.g. Fever since 2 days, headacheâ€¦"
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    />
                  </div>

                  {/* Error */}
                  {wiError && (
                    <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                      {wiError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            {!wiSuccess && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl">
                <button
                  disabled={!wiPhone.trim() || wiPhone.length < 10 || !wiChamberId || !wiDate || walkInMutation.isPending}
                  onClick={() => {
                    setWiError('');
                    walkInMutation.mutate({
                      chamber_id: wiChamberId,
                      appointment_date: wiDate,
                      ...(wiSlot && { slot_start_time: wiSlot }),
                      patient_phone: wiPhone.trim(),
                      ...(wiName.trim() && { patient_name: wiName.trim() }),
                      ...(wiComplaint.trim() && { chief_complaint: wiComplaint.trim() }),
                    });
                  }}
                  className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-violet-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {walkInMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Bookingâ€¦
                    </>
                  ) : (
                    'Book Appointment'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
