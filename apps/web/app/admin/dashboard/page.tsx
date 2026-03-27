'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '../../../lib/apiClient';

type Analytics = {
  doctors: { total: number; pending: number };
  shops: { total: number; pending: number; new_this_month: number };
  patients: { total: number };
  appointments: { total: number };
  users: { new_this_month: number };
  subscriptions: { active: number; expired: number };
};

export default function AdminOverviewPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [flushLoading, setFlushLoading] = useState(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = () => adminApi.getAnalytics()
      .then((r) => setAnalytics(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleFlushSessions = async () => {
    if (flushLoading) return;
    const confirmed = window.confirm('Force all users to re-login by clearing active sessions?');
    if (!confirmed) return;
    setFlushMessage(null);
    setFlushLoading(true);
    try {
      const res = await adminApi.flushSessions();
      const deleted = res.data.data?.deleted ?? 0;
      setFlushMessage(res.data.message ?? `Cleared ${deleted} active session(s).`);
    } catch (err: any) {
      setFlushMessage(err?.response?.data?.error?.message ?? 'Failed to clear sessions.');
    } finally {
      setFlushLoading(false);
    }
  };

  const stats = analytics ? [
    { label: 'Total Doctors', value: analytics.doctors.total, sub: `${analytics.doctors.pending} pending approval`, subHighlight: analytics.doctors.pending > 0, href: '/admin/dashboard/doctors', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400', icon: (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>) },
    { label: 'Total Shops', value: analytics.shops.total, sub: `${analytics.shops.pending} pending · ${analytics.shops.new_this_month} new this month`, subHighlight: analytics.shops.pending > 0, href: '/admin/dashboard/shops', color: 'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400', icon: (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614" /></svg>) },
    { label: 'Total Patients', value: analytics.patients.total, sub: `${analytics.users.new_this_month} new users this month`, subHighlight: false, href: '/admin/dashboard/users', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400', icon: (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>) },
    { label: 'Appointments', value: analytics.appointments.total, sub: 'All time bookings', subHighlight: false, href: null, color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400', icon: (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>) },
    { label: 'Active Subscriptions', value: analytics.subscriptions?.active ?? 0, sub: `${analytics.subscriptions?.expired ?? 0} expired`, subHighlight: (analytics.subscriptions?.expired ?? 0) > 0, href: '/admin/dashboard/subscriptions', color: 'from-teal-500/20 to-teal-600/10 border-teal-500/20 text-teal-400', icon: (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>) },
  ] : [];

  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
          <p className="text-gray-500 text-sm mt-1">RxDesk platform statistics · auto-refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-600 font-medium">Live</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 animate-pulse h-28" />
          ))
          : stats.map((s) => {
            const card = (
              <div key={s.label} className={`bg-gradient-to-br ${s.color} border rounded-2xl p-5 transition-all hover:scale-[1.01] ${s.href ? 'cursor-pointer' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="opacity-80">{s.icon}</span>
                  {s.subHighlight && <span className="w-2 h-2 bg-rose-400 rounded-full animate-pulse" />}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: '/admin/dashboard/doctors?status=pending', label: 'Approve Doctors', sub: analytics ? `${analytics.doctors.pending} pending` : '—', icon: '🩺' },
            { href: '/admin/dashboard/shops?status=pending', label: 'Approve Shops', sub: analytics ? `${analytics.shops.pending} pending` : '—', icon: '🏪' },
            { href: '/admin/dashboard/subscriptions?filter=soon', label: 'Expiring Subs', sub: 'Renew in 30 days', icon: '⏰' },
            { href: '/admin/dashboard/broadcast', label: 'Send Notification', sub: 'Broadcast to users', icon: '📢' },
            { href: '/admin/dashboard/catalog', label: 'Medicine Catalog', sub: 'Add or edit medicines', icon: '💊' },
            { href: '/admin/dashboard/activity', label: 'Activity Log', sub: 'Audit trail', icon: '🕐' },
            { href: '/admin/dashboard/users', label: 'All Users', sub: 'Manage platform users', icon: '👥' },
            { href: '/admin/dashboard/banners', label: 'App Banners', sub: 'Manage promotions', icon: '🖼️' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] hover:border-rose-500/30 hover:bg-rose-500/5 text-white rounded-xl p-4 transition-all group">
              <div className="w-9 h-9 bg-rose-600/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-rose-600/30 text-lg">
                {a.icon}
              </div>
              <div>
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="text-xs text-gray-500">{a.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">⚠️ Danger Zone</h2>
        <div className="bg-white/[0.02] border border-red-500/10 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Clear Active Sessions</p>
            <p className="text-xs text-gray-500">Forces all users to log in again immediately</p>
            {flushMessage && <p className="text-xs text-gray-400 mt-1">{flushMessage}</p>}
          </div>
          <button onClick={handleFlushSessions} disabled={flushLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold rounded-xl border border-red-500/30 transition-all disabled:opacity-60 whitespace-nowrap">
            {flushLoading ? '…' : '🔒 Flush Sessions'}
          </button>
        </div>
      </div>
    </div>
  );
}
