'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useConfigStore } from '../../store/configStore';
import { authApi, shopApi } from '../../lib/apiClient';
import { Shortcut, useKeyboardShortcuts } from '../../hooks/useShortcuts';
import { ShortcutsHelp, ShortcutItem } from '../../components/dashboard/ShortcutsHelp';
import { Keyboard } from 'lucide-react';

const NAV = [
  {
    href: '/dashboard', label: 'Dashboard', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
    )
  },
  {
    href: '/dashboard/appointments', label: 'Appointments', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
    )
  },
  {
    href: '/dashboard/doctors', label: 'Doctors', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
    )
  },
  {
    href: '/dashboard/inventory', label: 'Inventory', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
    )
  },
  {
    href: '/dashboard/billing', label: 'Billing', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
    )
  },
  {
    href: '/dashboard/reports', label: 'Reports', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
    )
  },
  {
    href: '/dashboard/accounting', label: 'Accounting', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )
  },
  {
    href: '/dashboard/settings', label: 'Settings', icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    )
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth, accessToken } = useAuthStore();
  const { financialYear, setFinancialYear, getAvailableFYs } = useConfigStore();
  const qc = useQueryClient();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const shortcuts: Shortcut[] = [
    { key: 'd', altKey: true, label: 'Dashboard', category: 'Navigation', action: () => router.push('/dashboard') },
    { key: 'a', altKey: true, label: 'Appointments', category: 'Navigation', action: () => router.push('/dashboard/appointments') },
    { key: 'o', altKey: true, label: 'Doctors', category: 'Navigation', action: () => router.push('/dashboard/doctors') },
    { key: 'i', altKey: true, label: 'Inventory', category: 'Navigation', action: () => router.push('/dashboard/inventory') },
    { key: 'b', altKey: true, label: 'Billing', category: 'Navigation', action: () => router.push('/dashboard/billing') },
    { key: 'r', altKey: true, label: 'Reports', category: 'Navigation', action: () => router.push('/dashboard/reports') },
    { key: 'c', altKey: true, label: 'Accounting', category: 'Navigation', action: () => router.push('/dashboard/accounting') },
    { key: 's', altKey: true, label: 'Settings', category: 'Navigation', action: () => router.push('/dashboard/settings') },
    { key: 'k', altKey: true, label: 'Keyboard Shortcuts', category: 'System', action: () => setShowShortcuts(true) },
    { key: 'Escape', label: 'Close Modal', category: 'System', action: () => setShowShortcuts(false) },
  ];

  const helpItems: ShortcutItem[] = shortcuts.map(s => ({
    key: s.key,
    combination: `${s.altKey ? 'Alt + ' : ''}${s.ctrlKey ? 'Ctrl + ' : ''}${s.shiftKey ? 'Shift + ' : ''}${s.key.toUpperCase()}`,
    label: s.label,
    category: s.category
  }));

  useKeyboardShortcuts(shortcuts);

  const { data: shop } = useQuery<{ shop_name: string }>({
    queryKey: ['web-shop'],
    queryFn: () => shopApi.getMyShop().then((r) => r.data.data),
    enabled: !!accessToken,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
    } else if (user && user.role !== 'shop_owner') {
      // A doctor or admin who somehow lands on the shop dashboard should be redirected
      router.replace('/login');
    }
  }, [accessToken, user, router]);

  useEffect(() => {
    if (accessToken) {
      qc.invalidateQueries();
    }
  }, [financialYear, accessToken, qc]);

  if (!accessToken || user?.role !== 'shop_owner') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* noop */ }
    clearAuth();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-[#f8f9fb]">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#0f0f1a] flex flex-col relative overflow-hidden shrink-0">
        {/* Decorative gradient blob */}
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand */}
        <div className="relative z-10 px-6 pt-7 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                <span className="text-white font-bold text-sm tracking-tight">RX</span>
              </div>
              <div>
                <p className="font-semibold text-white text-[15px] tracking-tight">RxDesk</p>
                <p className="text-violet-300/60 text-[11px] font-medium">Shop Panel</p>
              </div>
            </div>
            
            {/* Financial Year Selector */}
            <div className="relative">
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="appearance-none bg-white/[0.05] border border-white/10 text-[11px] font-bold text-violet-300 px-2 py-1 rounded-lg outline-none cursor-pointer hover:bg-white/[0.08] transition-colors pr-6"
              >
                {getAvailableFYs().map(fy => (
                  <option key={fy} value={fy} className="bg-[#1a1a2e] text-white font-medium">
                    FY {fy}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-violet-300/60">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 mb-2">Menu</p>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            const isHovered = hovered === href;
            return (
              <Link
                key={href}
                href={href}
                onMouseEnter={() => setHovered(href)}
                onMouseLeave={() => setHovered(null)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative group
                  ${active
                    ? 'bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-white shadow-lg shadow-violet-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full" />
                )}
                <span className={`transition-transform duration-200 ${isHovered && !active ? 'scale-110' : ''}`}>
                  {icon}
                </span>
                {label}
                {isHovered && (
                  <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-bold group-hover:text-white transition-colors">
                    Alt + {
                      label === 'Dashboard' ? 'D' :
                      label === 'Appointments' ? 'A' :
                      label === 'Doctors' ? 'O' :
                      label === 'Inventory' ? 'I' :
                      label === 'Billing' ? 'B' :
                      label === 'Reports' ? 'R' :
                      label === 'Accounting' ? 'C' :
                      label === 'Settings' ? 'S' : ''
                    }
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="relative z-10 p-4 mt-auto">
          {shop?.shop_name && (
            <div className="px-3 mb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Shop</p>
              <p className="text-sm font-medium text-white/80 truncate">{shop.shop_name}</p>
            </div>
          )}
          <div className="bg-white/[0.05] rounded-xl p-3 mb-3 border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500/80 to-indigo-500/80 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.phone?.slice(-2) ?? 'U'}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white/90 truncate">{user?.phone}</p>
                <p className="text-[11px] text-gray-500">Shop Owner</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowShortcuts(true)}
              title="Shortcut Keys (Alt+K)"
              className="flex-1 flex items-center justify-center gap-2 text-[12px] text-gray-400 hover:text-violet-300 py-2 rounded-lg hover:bg-white/[0.04] transition-all duration-200"
            >
              <Keyboard className="w-4 h-4" />
              Shortcuts
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 text-[12px] text-gray-500 hover:text-red-400 py-2 rounded-lg hover:bg-red-500/10 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Shortcuts Modal */}
      <ShortcutsHelp
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={helpItems}
      />

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
