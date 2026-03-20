'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../../lib/apiClient';
import { useAuthStore } from '../../../../store/authStore';
import Link from 'next/link';

interface DailySale {
    date: string;
    bills: number;
    sales: number;
    gst: number;
    discount: number;
}

interface TopMedicine {
    name: string;
    quantity_sold: number;
    revenue: number;
}

interface SalesReport {
    date_range: { from: string; to: string };
    summary: {
        total_bills: number;
        total_sales: number;
        total_gst_collected: number;
        total_discount_given: number;
        average_bill_value: number;
    };
    status_breakdown: { paid: number; pending: number; partial: number };
    payment_breakdown: { method: string; count: number; amount: number }[];
    daily_sales: DailySale[];
    top_medicines: TopMedicine[];
}

const PERIOD_PRESETS = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'This Month', days: -1 },
    { label: 'Last Month', days: -2 },
    { label: 'Custom', days: -99 },
];

function getDateRange(preset: number): { from: string; to: string } {
    const today = new Date();
    let resultTo = today.toISOString().split('T')[0];
    let resultFrom: string;

    if (preset === 0) {
        // Today
        resultFrom = resultTo;
    } else if (preset === 1) {
        // Yesterday
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        resultFrom = d.toISOString().split('T')[0];
    } else if (preset === 7 || preset === 30) {
        // Last N days
        const d = new Date(today);
        d.setDate(d.getDate() - preset);
        resultFrom = d.toISOString().split('T')[0];
    } else if (preset === -1) {
        // This month
        resultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (preset === -2) {
        // Last month
        const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const e = new Date(today.getFullYear(), today.getMonth(), 0);
        resultFrom = d.toISOString().split('T')[0];
        resultTo = e.toISOString().split('T')[0];
    } else {
        // Default to last 30 days
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        resultFrom = d.toISOString().split('T')[0];
    }

    return { from: resultFrom, to: resultTo };
}

const PAYMENT_COLORS: Record<string, string> = {
    cash: 'bg-emerald-100 text-emerald-700',
    upi: 'bg-violet-100 text-violet-700',
    card: 'bg-sky-100 text-sky-700',
    credit: 'bg-amber-100 text-amber-700',
};

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
    const step = data.length > 14 ? Math.ceil(data.length / 7) : 1;

    return (
        <div className="w-full">
            <div className="flex items-end gap-0.5 h-36 w-full">
                {data.map((d, i) => {
                    const val = Number(d[valueKey]);
                    const pct = max > 0 ? (val / max) * 100 : 0;
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative">
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

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
    );
}

export default function SalesReportPage() {
    const { user } = useAuthStore();
    const [preset, setPreset] = useState(30);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const dateRange = useMemo(() => {
        if (preset === -99 && customFrom && customTo) {
            return { from: customFrom, to: customTo };
        }
        return getDateRange(preset);
    }, [preset, customFrom, customTo]);

    const { data: report, isLoading, isError, refetch } = useQuery<SalesReport>({
        queryKey: ['sales-report', dateRange.from, dateRange.to],
        queryFn: () =>
            accountingApi
                .getDetailedSalesReport(dateRange.from, dateRange.to)
                .then((r) => r.data.data),
        enabled: !!user && user.role === 'shop_owner',
    });

    const fmtCurrency = (v: number) =>
        `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    if (!user || user.role !== 'shop_owner') {
        return (
            <div className="p-6 flex flex-col items-center justify-center h-64 gap-3 text-center">
                <p className="text-gray-700 font-semibold">Shop owner access required</p>
                <p className="text-gray-400 text-sm">This report is available for shop owners only.</p>
                <Link href="/dashboard" className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700">
                    Go to Dashboard →
                </Link>
            </div>
        );
    }

    const maxDailySale = report ? Math.max(...report.daily_sales.map((d) => d.sales), 1) : 1;
    const maxMedQty = report ? Math.max(...report.top_medicines.map((m) => m.quantity_sold), 1) : 1;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Detailed analysis of your sales performance</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Date Range Selector */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">Period:</span>
                    <div className="flex flex-wrap gap-2">
                        {PERIOD_PRESETS.map((p) => (
                            <button
                                key={p.label}
                                onClick={() => setPreset(p.days)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${preset === p.days
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {preset === -99 && (
                        <div className="flex items-center gap-2 ml-2">
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                            />
                        </div>
                    )}
                </div>
                {report && (
                    <p className="text-sm text-gray-500 mt-3">
                        Showing data from <span className="font-medium">{fmtDate(dateRange.from)}</span> to{' '}
                        <span className="font-medium">{fmtDate(dateRange.to)}</span>
                    </p>
                )}
            </div>

            {isLoading && (
                <div className="flex items-center justify-center h-64 text-gray-400">Loading sales report...</div>
            )}
            {isError && (
                <div className="flex items-center justify-center h-64 text-red-400">Failed to load sales report.</div>
            )}

            {report && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">🧾</div>
                            <div className="text-xl font-bold text-gray-900">{report.summary.total_bills}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Total Bills</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">💰</div>
                            <div className="text-xl font-bold text-emerald-600">{fmtCurrency(report.summary.total_sales)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Total Sales</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">📊</div>
                            <div className="text-xl font-bold text-sky-600">{fmtCurrency(report.summary.average_bill_value)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Avg. Bill Value</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">🏷️</div>
                            <div className="text-xl font-bold text-violet-600">{fmtCurrency(report.summary.total_discount_given)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Discount Given</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">📋</div>
                            <div className="text-xl font-bold text-amber-600">{fmtCurrency(report.summary.total_gst_collected)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">GST Collected</div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Daily Sales Chart */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="font-semibold text-gray-900 mb-4">Daily Sales (₹)</h2>
                            {report.daily_sales.length === 0 ? (
                                <p className="text-gray-400 text-sm">No sales data for this period.</p>
                            ) : (
                                <BarChart
                                    data={report.daily_sales as unknown as Record<string, string | number>[]}
                                    valueKey="sales"
                                    labelKey="date"
                                    color="bg-emerald-400"
                                    formatValue={fmtCurrency}
                                />
                            )}
                        </div>

                        {/* Payment Method Breakdown */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="font-semibold text-gray-900 mb-4">Payment Method Breakdown</h2>
                            {report.payment_breakdown.length === 0 ? (
                                <p className="text-gray-400 text-sm">No payment data for this period.</p>
                            ) : (
                                <div className="space-y-4">
                                    {report.payment_breakdown.map((p) => (
                                        <div key={p.method} className="flex items-center gap-3">
                                            <span
                                                className={`px-3 py-1 rounded-lg text-sm font-semibold capitalize ${PAYMENT_COLORS[p.method] || 'bg-gray-100 text-gray-700'
                                                    }`}
                                            >
                                                {p.method}
                                            </span>
                                            <ProgressBar value={p.amount} max={report.summary.total_sales} color={PAYMENT_COLORS[p.method]?.replace('bg-', 'bg-').replace('100', '400') || 'bg-gray-400'} />
                                            <div className="w-24 text-right">
                                                <div className="text-sm font-bold text-gray-900">{fmtCurrency(p.amount)}</div>
                                                <div className="text-xs text-gray-400">{p.count} bills</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bill Status & Top Medicines Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bill Status */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="font-semibold text-gray-900 mb-4">Bill Status</h2>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <span className="text-sm text-gray-600">Paid</span>
                                    </div>
                                    <span className="font-semibold text-gray-900">{report.status_breakdown.paid}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                                        <span className="text-sm text-gray-600">Pending</span>
                                    </div>
                                    <span className="font-semibold text-gray-900">{report.status_breakdown.pending}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                                        <span className="text-sm text-gray-600">Partial</span>
                                    </div>
                                    <span className="font-semibold text-gray-900">{report.status_breakdown.partial}</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Collection Rate</span>
                                    <span className="font-semibold text-emerald-600">
                                        {report.summary.total_bills > 0
                                            ? Math.round((report.status_breakdown.paid / report.summary.total_bills) * 100)
                                            : 0}
                                        %
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top Medicines */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="font-semibold text-gray-900 mb-4">Top Selling Medicines</h2>
                            {report.top_medicines.length === 0 ? (
                                <p className="text-gray-400 text-sm">No medicines sold in this period.</p>
                            ) : (
                                <div className="space-y-3">
                                    {report.top_medicines.slice(0, 10).map((med, idx) => (
                                        <div key={med.name} className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-900 font-medium truncate">{med.name}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-sky-400 rounded-full"
                                                            style={{ width: `${(med.quantity_sold / maxMedQty) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500 w-16 text-right">{med.quantity_sold} units</span>
                                                </div>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900 w-20 text-right">
                                                {fmtCurrency(med.revenue)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Daily Sales Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <h2 className="font-semibold text-gray-900 mb-4">Daily Sales Details</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="text-left py-3 px-2 font-semibold text-gray-600">Date</th>
                                        <th className="text-right py-3 px-2 font-semibold text-gray-600">Bills</th>
                                        <th className="text-right py-3 px-2 font-semibold text-gray-600">Sales</th>
                                        <th className="text-right py-3 px-2 font-semibold text-gray-600">GST</th>
                                        <th className="text-right py-3 px-2 font-semibold text-gray-600">Discount</th>
                                        <th className="text-right py-3 px-2 font-semibold text-gray-600">Avg. Bill</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.daily_sales.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-gray-400">
                                                No sales data for this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        report.daily_sales.map((day) => (
                                            <tr key={day.date} className="border-b border-gray-50 hover:bg-gray-50">
                                                <td className="py-3 px-2 text-gray-900">{fmtDate(day.date)}</td>
                                                <td className="py-3 px-2 text-right font-medium">{day.bills}</td>
                                                <td className="py-3 px-2 text-right font-semibold text-emerald-600">{fmtCurrency(day.sales)}</td>
                                                <td className="py-3 px-2 text-right text-gray-600">{fmtCurrency(day.gst)}</td>
                                                <td className="py-3 px-2 text-right text-gray-600">{fmtCurrency(day.discount)}</td>
                                                <td className="py-3 px-2 text-right text-gray-600">
                                                    {day.bills > 0 ? fmtCurrency(day.sales / day.bills) : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
