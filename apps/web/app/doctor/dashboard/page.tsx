'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { doctorApi } from '../../../lib/apiClient';

const STATUS_COLORS: Record<string, string> = {
  booked:          'bg-amber-100 text-amber-700',
  confirmed:       'bg-sky-100 text-sky-700',
  arrived:         'bg-orange-100 text-orange-700',
  in_consultation: 'bg-blue-100 text-blue-700',
  completed:       'bg-emerald-100 text-emerald-700',
  cancelled:       'bg-red-100 text-red-500',
  no_show:         'bg-gray-100 text-gray-500',
};

export default function DoctorHomePage() {
  const { data: profile } = useQuery({
    queryKey: ['doctor-web-profile'],
    queryFn: () => doctorApi.getProfile().then((r) => r.data.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['doctor-web-stats'],
    queryFn: () => doctorApi.getStats().then((r) => r.data.data),
  });

  const { data: todayAppointments = [], isLoading } = useQuery({
    queryKey: ['doctor-web-today'],
    queryFn: () => doctorApi.getTodayAppointments().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const waiting = (todayAppointments as any[]).filter((a) =>
    ['booked', 'confirmed', 'arrived', 'in_consultation'].includes(a.status)
  );
  const completed = (todayAppointments as any[]).filter((a) => a.status === 'completed');

  const statCards = [
    { label: 'Today — Total', value: (todayAppointments as any[]).length, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { label: 'Waiting',       value: waiting.length,   color: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: 'Completed',     value: completed.length, color: 'bg-sky-50 text-sky-700 border-sky-100' },
    { label: 'Total Patients', value: stats?.total_patients ?? '—', color: 'bg-violet-50 text-violet-700 border-violet-100' },
  ];

  return (
    <div className="p-6">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{profile?.full_name ? `, Dr. ${profile.full_name}` : ''} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        {profile?.verification_status && profile.verification_status !== 'approved' && (
          <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
            profile.verification_status === 'pending'
              ? 'bg-amber-50 text-amber-700 border border-amber-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}>
            {profile.verification_status === 'pending'
              ? '⏳ Your profile is pending admin verification. Some features may be restricted.'
              : `❌ Your profile was rejected. Reason: ${profile.rejection_reason ?? 'Contact support.'}`}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, color }) => (
          <div key={label} className={`${color} border rounded-2xl p-4`}>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm font-medium mt-1 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { href: '/doctor/dashboard/appointments', label: "Today's Queue", sub: `${waiting.length} waiting`, emoji: '🗂️', bg: 'bg-emerald-600 hover:bg-emerald-700' },
          { href: '/doctor/dashboard/prescriptions', label: 'Prescriptions', sub: 'View issued prescriptions', emoji: '📋', bg: 'bg-teal-600 hover:bg-teal-700' },
          { href: '/doctor/dashboard/chambers', label: 'My Chambers', sub: 'Manage shop chambers', emoji: '🏥', bg: 'bg-sky-600 hover:bg-sky-700' },
        ].map(({ href, label, sub, emoji, bg }) => (
          <Link
            key={href}
            href={href}
            className={`${bg} text-white rounded-2xl p-5 transition-colors flex items-center gap-4`}
          >
            <span className="text-3xl">{emoji}</span>
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-white/70 text-sm">{sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Today's appointments preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Today&apos;s Appointments</h2>
          <Link href="/doctor/dashboard/appointments" className="text-emerald-600 text-sm font-medium hover:text-emerald-700">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {['#', 'Patient', 'Time', 'Complaint', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={5} className="py-10 text-center text-gray-400">Loading…</td></tr>
            ) : (todayAppointments as any[]).length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-gray-400">No appointments today</td></tr>
            ) : (todayAppointments as any[]).slice(0, 8).map((appt) => (
              <tr key={appt.id}>
                <td className="px-4 py-3">
                  <span className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                    #{appt.token_number}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{appt.patient?.full_name ?? appt.patient?.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{appt.slot_start_time}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{appt.chief_complaint ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_COLORS[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
