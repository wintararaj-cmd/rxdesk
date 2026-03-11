'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorApi, appointmentApi } from '../../../../lib/apiClient';

interface Chamber {
  id: string;
  consultation_fee: number;
  shop: { id: string; shop_name: string; city: string } | null;
  schedules: { day_of_week: number; start_time: string; end_time: string }[];
}

interface Appointment {
  id: string;
  token_number: number;
  slot_start_time: string;
  appointment_date: string;
  status: string;
  chief_complaint?: string;
  patient?: { full_name?: string; age?: number; gender?: string; blood_group?: string; phone?: string };
  chamber?: { shop?: { shop_name: string } };
}

const STATUS_COLORS: Record<string, string> = {
  booked:          'bg-amber-100 text-amber-700',
  confirmed:       'bg-sky-100 text-sky-700',
  arrived:         'bg-orange-100 text-orange-700',
  in_consultation: 'bg-blue-100 text-blue-700',
  completed:       'bg-emerald-100 text-emerald-700',
  cancelled:       'bg-red-100 text-red-500',
  no_show:         'bg-gray-100 text-gray-500',
};

const NEXT_STATUS: Record<string, { label: string; status: string; color: string }> = {
  booked:    { label: 'Confirm',     status: 'confirmed',       color: 'bg-sky-600 hover:bg-sky-700' },
  confirmed: { label: 'Mark Arrived', status: 'arrived',        color: 'bg-orange-500 hover:bg-orange-600' },
  arrived:   { label: 'Start Consult', status: 'in_consultation', color: 'bg-blue-600 hover:bg-blue-700' },
  in_consultation: { label: 'Complete', status: 'completed',    color: 'bg-emerald-600 hover:bg-emerald-700' },
};

export default function DoctorAppointmentsPage() {
  const qc = useQueryClient();
  const [selectedChamber, setSelectedChamber] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'waiting' | 'completed'>('all');

  const { data: chambers = [] } = useQuery<Chamber[]>({
    queryKey: ['doctor-web-chambers'],
    queryFn: () => doctorApi.getMyChambers().then((r) => r.data.data),
  });

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['doctor-web-appointments', selectedChamber],
    queryFn: () =>
      doctorApi
        .getTodayAppointments(selectedChamber !== 'all' ? selectedChamber : undefined)
        .then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-web-appointments'] }),
  });

  const filtered =
    filter === 'waiting'
      ? appointments.filter((a) => ['booked', 'confirmed', 'arrived', 'in_consultation'].includes(a.status))
      : filter === 'completed'
      ? appointments.filter((a) => a.status === 'completed')
      : appointments;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today&apos;s Appointments</h1>
          <p className="text-gray-500 text-sm mt-1">{appointments.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Chamber selector */}
        <select
          value={selectedChamber}
          onChange={(e) => setSelectedChamber(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="all">All Chambers</option>
          {chambers.map((c) => (
            <option key={c.id} value={c.id}>{c.shop?.shop_name ?? c.id}</option>
          ))}
        </select>

        {/* Status filter */}
        {(['all', 'waiting', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Token', 'Patient', 'Chamber', 'Time', 'Complaint', 'Status', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">No appointments</td></tr>
            ) : filtered.map((appt) => {
              const next = NEXT_STATUS[appt.status];
              return (
                <tr key={appt.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                      #{appt.token_number}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{appt.patient?.full_name ?? '—'}</p>
                    <p className="text-gray-400 text-xs">
                      {[appt.patient?.age ? `${appt.patient.age}y` : null, appt.patient?.gender, appt.patient?.blood_group].filter(Boolean).join(' · ')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{appt.chamber?.shop?.shop_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{appt.slot_start_time}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{appt.chief_complaint ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_COLORS[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {next && (
                      <button
                        onClick={() => updateMutation.mutate({ id: appt.id, status: next.status })}
                        disabled={updateMutation.isPending}
                        className={`${next.color} text-white text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap`}
                      >
                        {next.label}
                      </button>
                    )}
                    {appt.status === 'completed' && (
                      <span className="text-emerald-600 text-xs">✓ Done</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
