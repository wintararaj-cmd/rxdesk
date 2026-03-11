'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '../../../lib/apiClient';

type Analytics = {
  doctors: { total: number; pending: number };
  shops: { total: number; pending: number };
  patients: { total: number };
  appointments: { total: number };
};

export default function AdminOverviewPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getAnalytics()
      .then((r) => setAnalytics(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = analytics ? [
    {
      label: 'Total Doctors',
      value: analytics.doctors.total,
      sub: `${analytics.doctors.pending} pending approval`,
      subHighlight: analytics.doctors.pending > 0,
      href: '/admin/dashboard/doctors',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
      ),
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400',
    },
    {
      label: 'Total Shops',
      value: analytics.shops.total,
      sub: `${analytics.shops.pending} pending approval`,
      subHighlight: analytics.shops.pending > 0,
      href: '/admin/dashboard/shops',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614" /></svg>
      ),
      color: 'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400',
    },
    {
      label: 'Total Patients',
      value: analytics.patients.total,
      sub: 'Registered patients',
      subHighlight: false,
      href: '/admin/dashboard/users',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
      ),
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
    },
    {
      label: 'Total Appointments',
      value: analytics.appointments.total,
      sub: 'All time',
      subHighlight: false,
      href: null,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
      ),
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400',
    },
  ] : [];

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
        <p className="text-gray-500 text-sm mt-1">RxDesk platform statistics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 animate-pulse h-28" />
          ))
          : stats.map((s) => {
            const card = (
              <div
                key={s.label}
                className={`bg-gradient-to-br ${s.color} border rounded-2xl p-5 transition-all hover:scale-[1.01] ${s.href ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="opacity-80">{s.icon}</span>
                  {s.subHighlight && (
                    <span className="w-2 h-2 bg-rose-400 rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-3xl font-bold text-white tabular-nums">{s.value.toLocaleString()}</p>
                <p className="text-white/70 text-xs mt-0.5 font-medium">{s.label}</p>
                <p className={`text-xs mt-2 ${s.subHighlight ? 'text-rose-400 font-semibold' : 'text-white/40'}`}>{s.sub}</p>
              </div>
            );
            return s.href ? <Link href={s.href} key={s.label}>{card}</Link> : <div key={s.label}>{card}</div>;
          })}
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin/dashboard/doctors?status=pending"
            className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] hover:border-rose-500/30 hover:bg-rose-500/5 text-white rounded-xl p-4 transition-all group">
            <div className="w-9 h-9 bg-rose-600/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-rose-600/30">
              <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold">Approve Doctors</p>
              <p className="text-xs text-gray-500">
                {analytics ? `${analytics.doctors.pending} pending` : '—'}
              </p>
            </div>
          </Link>
          <Link href="/admin/dashboard/shops?status=pending"
            className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] hover:border-rose-500/30 hover:bg-rose-500/5 text-white rounded-xl p-4 transition-all group">
            <div className="w-9 h-9 bg-rose-600/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-rose-600/30">
              <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold">Approve Shops</p>
              <p className="text-xs text-gray-500">
                {analytics ? `${analytics.shops.pending} pending` : '—'}
              </p>
            </div>
          </Link>
          <Link href="/admin/dashboard/users"
            className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] hover:border-rose-500/30 hover:bg-rose-500/5 text-white rounded-xl p-4 transition-all group">
            <div className="w-9 h-9 bg-rose-600/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-rose-600/30">
              <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold">All Users</p>
              <p className="text-xs text-gray-500">View platform users</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
