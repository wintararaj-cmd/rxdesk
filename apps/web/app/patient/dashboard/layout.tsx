'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { authApi } from '../../../lib/apiClient';

export default function PatientDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, clearAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!accessToken) { router.replace('/patient/login'); return; }
    if (user && user.role !== 'patient') { router.replace('/patient/login'); }
  }, [accessToken, user, router]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    router.replace('/');
  };

  if (!accessToken) return null;

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      {/* Top nav */}
      <header className="sticky top-0 z-40 h-14 bg-[#09090f]/90 backdrop-blur-xl border-b border-white/[0.06] flex items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 mr-auto">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold">RxDesk</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline truncate max-w-[140px]">{user?.phone ?? 'Patient'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 rounded-lg transition-all"
          >
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
