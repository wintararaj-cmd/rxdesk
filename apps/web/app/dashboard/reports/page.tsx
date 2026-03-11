'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../lib/apiClient';

interface DailyRevenue { date: string; amount: number; }
interface DailyAppointments { date: string; count: number; }
interface TopMedicine { medicine_name: string; quantity: number; }
interface Summary {
  total_revenue: number;
  avg_daily_revenue: number;
  total_appointments: number;
  completed_appointments: number;
  low_stock_count: number;
  total_bills: number;
}
interface Analytics {
  period_days: number;
  summary: Summary;
  revenue: DailyRevenue[];
  appointments_by_day: DailyAppointments[];
  top_medicines: TopMedicine[];
}

const PERIODS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

function BarChart({
  data,
  valueKey,
  labelKey,
  color,
  formatValue,
}: {
  data: Record<string, number | string>[];
  valueKey: string;
  labelKey: string;
  color: string;
  formatValue?: (v: number) => string;
}) {
  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 1);
  const fmt = formatValue ?? ((v: number) => String(v));
  // Show every N-th label to avoid clutter
  const step = data.length > 14 ? Math.ceil(data.length / 7) : 1;

  return (
    <div className="w-full">
      <div className="flex items-end gap-0.5 h-36 w-full">
        {data.map((d, i) => {
          const val = Number(d[valueKey]);
          const pct = max > 0 ? (val / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none">
                {String(d[labelKey]).slice(5)}<br />{fmt(val)}
              </div>
              <div
                className={`w-full rounded-t transition-all ${color}`}
                style={{ height: `${Math.max(pct, val > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-0.5 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-gray-400" style={{ fontSize: '9px' }}>
            {i % step === 0 ? String(d[labelKey]).slice(5) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState(30);

  const { data: analytics, isLoading, isError } = useQuery<Analytics>({
    queryKey: ['shop-analytics', period],
    queryFn: () => reportsApi.getAnalytics(period).then((r) => r.data.data),
  });

  const fmtCurrency = (v: number) =>
    `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const maxMedQty = analytics?.top_medicines[0]?.quantity ?? 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Performance overview for your shop</p>
        </div>
        {/* Period selector */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 font-medium transition-colors ${
                period === p.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading analytics…</div>
      )}
      {isError && (
        <div className="flex items-center justify-center h-48 text-red-400">Failed to load analytics.</div>
      )}

      {analytics && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Revenue', value: fmtCurrency(analytics.summary.total_revenue), icon: '💰', color: 'text-emerald-600' },
              { label: 'Avg Daily Revenue', value: fmtCurrency(analytics.summary.avg_daily_revenue), icon: '📊', color: 'text-sky-600' },
              { label: 'Total Appointments', value: String(analytics.summary.total_appointments), icon: '📅', color: 'text-violet-600' },
              { label: 'Completed', value: String(analytics.summary.completed_appointments), icon: '✅', color: 'text-emerald-600' },
              { label: 'Bills Generated', value: String(analytics.summary.total_bills), icon: '🧾', color: 'text-amber-600' },
              { label: 'Low Stock Items', value: String(analytics.summary.low_stock_count), icon: '⚠️', color: analytics.summary.low_stock_count > 0 ? 'text-red-500' : 'text-gray-400' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-2xl mb-2">{icon}</div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Revenue (₹)</h2>
              <BarChart
                data={analytics.revenue as unknown as Record<string, string | number>[]}
                valueKey="amount"
                labelKey="date"
                color="bg-emerald-400"
                formatValue={fmtCurrency}
              />
            </div>

            {/* Appointments chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Appointments</h2>
              <BarChart
                data={analytics.appointments_by_day as unknown as Record<string, string | number>[]}
                valueKey="count"
                labelKey="date"
                color="bg-violet-400"
              />
            </div>
          </div>

          {/* Top medicines */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Top Dispensed Medicines</h2>
            {analytics.top_medicines.length === 0 ? (
              <p className="text-gray-400 text-sm">No dispensed medicines in this period.</p>
            ) : (
              <div className="space-y-3">
                {analytics.top_medicines.map((med: TopMedicine) => (
                  <div key={med.medicine_name} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 text-sm text-gray-700 truncate">{med.medicine_name}</div>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-400 rounded-full transition-all"
                        style={{ width: `${(med.quantity / maxMedQty) * 100}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-sm font-medium text-gray-700">{med.quantity}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
