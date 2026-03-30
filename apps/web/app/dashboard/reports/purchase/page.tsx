'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../../lib/apiClient';
import { useAuthStore } from '../../../../store/authStore';
import Link from 'next/link';

interface PurchaseEntry {
    id: string;
    invoice_number: string;
    invoice_date: string;
    received_date: string;
    total_amount: number;
    amount_paid: number;
    payment_status: string;
    supplier?: { id: string, name: string };
}

interface PurchaseReport {
    items: PurchaseEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    total_amount_sum: number;
    total_due_sum: number;
    top_supplier: string;
}

const PERIOD_PRESETS = [
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

    if (preset === 7 || preset === 30) {
        const d = new Date(today);
        d.setDate(d.getDate() - preset);
        resultFrom = d.toISOString().split('T')[0];
    } else if (preset === -1) {
        resultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (preset === -2) {
        const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const e = new Date(today.getFullYear(), today.getMonth(), 0);
        resultFrom = d.toISOString().split('T')[0];
        resultTo = e.toISOString().split('T')[0];
    } else {
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        resultFrom = d.toISOString().split('T')[0];
    }

    return { from: resultFrom, to: resultTo };
}

export default function PurchaseReportPage() {
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

    const { data: report, isLoading, isError, refetch } = useQuery<PurchaseReport>({
        queryKey: ['purchase-report', dateRange.from, dateRange.to],
        queryFn: () =>
            accountingApi
                .listPurchases({ from: dateRange.from, to: dateRange.to, limit: 100 })
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

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Purchase Report</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Detailed history of stock inward and payments</p>
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
                </div>
                {report && (
                    <p className="text-sm text-gray-500 mt-3">
                        From <span className="font-medium">{fmtDate(dateRange.from)}</span> to <span className="font-medium">{fmtDate(dateRange.to)}</span>
                    </p>
                )}
            </div>

            {isLoading && <div className="text-center py-12 text-gray-400">Loading purchase report...</div>}
            {isError && <div className="text-center py-12 text-red-500">Failed to load purchase data.</div>}

            {report && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">📦</div>
                            <div className="text-xl font-bold text-gray-900">{report.total}</div>
                            <div className="text-xs text-gray-500">Total Invoices</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">💸</div>
                            <div className="text-xl font-bold text-emerald-600">{fmtCurrency(report.total_amount_sum)}</div>
                            <div className="text-xs text-gray-500">Total Purchase</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">⚖️</div>
                            <div className="text-xl font-bold text-red-600">{fmtCurrency(report.total_due_sum)}</div>
                            <div className="text-xs text-gray-500">Total Outstanding</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="text-2xl mb-1">🏢</div>
                            <div className="text-xl font-bold text-gray-900 truncate">{report.top_supplier}</div>
                            <div className="text-xs text-gray-500">Top Supplier</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-50">
                            <h2 className="font-semibold text-gray-900">Purchase Invoices</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Date</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Invoice No.</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Supplier</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-600">Amount</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-600">Paid</th>
                                        <th className="text-center py-3 px-4 font-semibold text-gray-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {report.items.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">No purchases found for this period.</td></tr>
                                    ) : (
                                        report.items.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4">{fmtDate(item.invoice_date)}</td>
                                                <td className="py-3 px-4 font-medium">{item.invoice_number}</td>
                                                <td className="py-3 px-4 text-gray-700">{item.supplier?.name || '-'}</td>
                                                <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmtCurrency(item.total_amount)}</td>
                                                <td className="py-3 px-4 text-right text-emerald-600">{fmtCurrency(item.amount_paid)}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                        item.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                                        item.payment_status === 'partial' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {item.payment_status?.toUpperCase()}
                                                    </span>
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
