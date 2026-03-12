'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, CalendarDays, Receipt, AlertTriangle,
  Plus, UserPlus, Package,
} from 'lucide-react';
import { shopApi, appointmentApi, reportsApi } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace('/api/v1', '');

interface QueueItem {
  id: string;
  token_number: number;
  status: string;
  patient?: { full_name?: string; phone?: string };
  chief_complaint?: string;
}

interface ShopData {
  id: string;
  shop_name: string;
}

interface Dashboard {
  today_revenue: number;
  today_appointments: number;
  pending_bills: number;
  low_stock_count: number;
}

interface DailyRevenue { date: string; amount: number; }
interface Analytics { revenue: DailyRevenue[]; }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtRevenue(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

const STATUS_COLORS: Record<string, string> = {
  in_consultation: 'bg-emerald-100 text-emerald-700',
  arrived: 'bg-sky-100 text-sky-700',
  confirmed: 'bg-violet-100 text-violet-700',
  booked: 'bg-amber-100 text-amber-700',
};

const QUICK_ACTIONS = [
  { label: 'New Bill', href: '/dashboard/billing', icon: Plus, bg: 'bg-violet-600 hover:bg-violet-700' },
  { label: 'Walk-in Appt', href: '/dashboard/appointments', icon: UserPlus, bg: 'bg-sky-600 hover:bg-sky-700' },
  { label: 'Add Stock', href: '/dashboard/inventory', icon: Package, bg: 'bg-emerald-600 hover:bg-emerald-700' },
];

export default function DashboardPage() {
  const { accessToken } = useAuthStore();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const { data: shop } = useQuery<ShopData>({
    queryKey: ['web-shop'],
    queryFn: () => shopApi.getMyShop().then((r) => r.data.data),
    enabled: !!accessToken,
  });

  const { data: dashboard } = useQuery<Dashboard>({
    queryKey: ['web-dashboard'],
    queryFn: () => shopApi.getDashboard().then((r) => r.data.data),
    enabled: !!shop,
    refetchInterval: 60_000,
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ['web-analytics-7'],
    queryFn: () => reportsApi.getAnalytics(7).then((r) => r.data.data),
    enabled: !!shop,
    staleTime: 5 * 60_000,
  });

  // Real-time socket
  useEffect(() => {
    if (!accessToken || !shop?.id) return;

    const socket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
    });

    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join_shop', { shop_id: shop.id }));
    socket.on('appointment:new', (data: QueueItem) => setQueue((p) => [...p, data]));
    socket.on('appointment:status_updated', (data: { id: string; status: string }) => {
      setQueue((p) => p.map((q) => (q.id === data.id ? { ...q, status: data.status } : q)));
    });

    return () => { socket.disconnect(); };
  }, [accessToken, shop?.id]);

  const waitingQueue = queue.filter((q) =>
    ['booked', 'confirmed', 'arrived', 'in_consultation'].includes(q.status)
  );

  const sparkData = (analytics?.revenue ?? []).map((d) => ({
    day: d.date.slice(5),
    amt: d.amount,
  }));

  const stats = [
    {
      label: "Today's Revenue",
      value: fmtRevenue(dashboard?.today_revenue ?? 0),
      raw: dashboard?.today_revenue ?? 0,
      Icon: TrendingUp,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      bar: 'bg-emerald-500',
    },
    {
      label: "Today's Appointments",
      value: dashboard?.today_appointments ?? 0,
      Icon: CalendarDays,
      accent: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-100',
      bar: 'bg-sky-500',
    },
    {
      label: 'Pending Bills',
      value: dashboard?.pending_bills ?? 0,
      Icon: Receipt,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      bar: 'bg-amber-500',
    },
    {
      label: 'Low Stock Items',
      value: dashboard?.low_stock_count ?? 0,
      Icon: AlertTriangle,
      accent: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
      bar: 'bg-red-500',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-sm text-gray-400 font-medium mb-0.5">{fmtDate()}</p>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, <span className="text-violet-600">{shop?.shop_name ?? '…'}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Here&apos;s what&apos;s happening at your shop today.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full mt-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Live
        </span>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-7">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon, bg }) => (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-2 ${bg} text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {stats.map(({ label, value, Icon, accent, bg, border, bar }) => (
          <div key={label} className={`rounded-2xl border ${border} ${bg} p-5 relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${bar} rounded-l-2xl`} />
            <div className={`w-9 h-9 rounded-xl ${bg} border ${border} flex items-center justify-center mb-3 ml-1`}>
              <Icon className={`w-5 h-5 ${accent}`} />
            </div>
            <div className={`text-2xl font-bold ml-1 ${accent}`}>{String(value)}</div>
            <div className="text-xs text-gray-500 font-medium ml-1 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Bottom row: Revenue chart + Queue */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* 7-day Revenue Sparkline */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Revenue Trend</p>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
            </div>
            <Link
              href="/dashboard/reports"
              className="text-xs text-violet-600 hover:text-violet-700 font-medium"
            >
              View full report →
            </Link>
          </div>
          {sparkData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="amt"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#7c3aed' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-gray-300 text-sm">
              No data yet
            </div>
          )}
        </div>

        {/* Live Appointment Queue */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Live Appointment Queue</h2>
            {waitingQueue.length > 0 && (
              <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-2.5 py-0.5 rounded-full">
                {waitingQueue.length} waiting
              </span>
            )}
          </div>

          {waitingQueue.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">All clear — no patients waiting</p>
              <Link
                href="/dashboard/appointments"
                className="mt-3 inline-block text-xs text-violet-600 hover:underline font-medium"
              >
                Add walk-in appointment →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {waitingQueue.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-violet-700 font-bold text-xs">#{item.token_number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {item.patient?.full_name ?? item.patient?.phone ?? 'Patient'}
                    </p>
                    {item.chief_complaint && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate">{item.chief_complaint}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => appointmentApi.updateStatus(item.id, 'completed')}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors shrink-0"
                  >
                    Done
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
