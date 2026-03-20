'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, LogOut, User, Search, Calendar, Home,
  Bell, Settings, ChevronRight, Menu, X,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { authApi, patientApi } from '../../../lib/apiClient';

const NAV = [
  { tab: 'home', href: '/patient/dashboard', label: 'Home', icon: Home },
  { tab: 'search', href: '/patient/dashboard?tab=search', label: 'Find Doctors', icon: Search },
  { tab: 'appointments', href: '/patient/dashboard?tab=appointments', label: 'Appointments', icon: Calendar },
  { tab: 'profile', href: '/patient/dashboard?tab=profile', label: 'My Profile', icon: User },
];

function PatientDashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, accessToken, clearAuth } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'home';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!accessToken) { router.replace('/patient/login'); return; }
    if (user && user.role !== 'patient') { router.replace('/patient/login'); }
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    patientApi.getProfile().then((res) => {
      const p = res.data?.data;
      if (p?.full_name) setPatientName(p.full_name);
    }).catch(() => {});
  }, [accessToken]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    router.replace('/');
  };

  if (!accessToken) return null;

  const displayName = patientName ?? user?.phone ?? 'Patient';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-[#07070e] text-white flex">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0d0d1a] border-r border-white/[0.06] flex flex-col transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Activity className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-white">RxDesk</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Patient Portal</p>
          </div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Patient card */}
        <div className="mx-4 mt-4 mb-2 bg-gradient-to-br from-blue-600/15 to-violet-600/10 border border-blue-500/15 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-gray-500 truncate">{user?.phone}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ tab, href, label, icon: Icon }) => {
            const active = currentTab === tab;
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  active
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-600/25'
                    : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-500/50" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all group"
          >
            <LogOut className="w-4 h-4 text-gray-600 group-hover:text-red-400 transition-colors" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-[#07070e]/90 backdrop-blur-xl border-b border-white/[0.05] flex items-center px-4 sm:px-6 gap-4">
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-500 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 hidden sm:flex">
            <span className="text-blue-400 font-medium">Patient</span>
            <span>/</span>
            <span>Dashboard</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notification bell */}
            <button className="relative p-2 text-gray-500 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all">
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {/* Avatar */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center text-xs font-bold shadow shadow-blue-500/20">
              {initials}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.04] px-6 py-3 text-center text-xs text-gray-700">
          © 2026 RxDesk · Your trusted medical companion
        </footer>
      </div>
    </div>
  );
}

export default function PatientDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07070e] text-white flex items-center justify-center">Loading...</div>}>
      <PatientDashboardLayoutContent>{children}</PatientDashboardLayoutContent>
    </Suspense>
  );
}
