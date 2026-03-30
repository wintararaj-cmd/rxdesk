'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../../lib/apiClient';
import { useAuthStore } from '../../../../store/authStore';
import Link from 'next/link';

interface GstRateSummary {
    gst_rate: number;
    taxable_value: number;
    gst_amount: number;
}

interface GstReport {
    period: { month: number; year: number };
    outward_supplies: {
        taxable_value: number;
        gst_collected: { cgst: number; sgst: number; igst: number };
        total_gst_collected: number;
    };
    inward_supplies: {
        itc_available: { cgst: number; sgst: number; igst: number };
        total_itc: number;
        itc_utilised: number;
        itc_carry_forward: number;
    };
    net_tax_payable: number;
    rate_wise_summary: GstRateSummary[];
}

const MONTHS = [
    { label: 'January', value: 1 }, { label: 'February', value: 2 }, { label: 'March', value: 3 },
    { label: 'April', value: 4 }, { label: 'May', value: 5 }, { label: 'June', value: 6 },
    { label: 'July', value: 7 }, { label: 'August', value: 8 }, { label: 'September', value: 9 },
    { label: 'October', value: 10 }, { label: 'November', value: 11 }, { label: 'December', value: 12 },
];

const YEARS = [2024, 2025, 2026];

export default function GstReportPage() {
    const { user } = useAuthStore();
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [downloading, setDownloading] = useState<string | null>(null);

    const { data: report, isLoading, isError, refetch } = useQuery<GstReport>({
        queryKey: ['gst-report', month, year],
        queryFn: () =>
            accountingApi
                .getGstSummary(month, year)
                .then((r) => r.data.data),
        enabled: !!user && user.role === 'shop_owner',
    });

    const fmtCurrency = (v: number) =>
        `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleDownload = async (type: 'gstr1' | 'gstr2' | 'gstr3b') => {
        setDownloading(type);
        try {
            const apiCall = type === 'gstr1' ? accountingApi.getGstr1Excel : type === 'gstr2' ? accountingApi.getGstr2Excel : accountingApi.getGstr3bExcel;
            const res = await apiCall(month, year);
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type.toUpperCase()}_${month}_${year}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download excel report.');
        } finally {
            setDownloading(null);
        }
    };

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
                    <h1 className="text-2xl font-bold text-gray-900">GST Report</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Automated GST calculations and returns filing exports</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    >
                        {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    >
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button
                        onClick={() => refetch()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {isLoading && <div className="text-center py-12 text-gray-400">Loading GST summary...</div>}
            {isError && <div className="text-center py-12 text-red-500">Failed to load GST data.</div>}

            {report && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900 border-l-4 border-emerald-500 pl-3">Outward Supplies</h3>
                                <span className="text-xs text-gray-400 font-medium">(GSTR-1)</span>
                            </div>
                            <div className="space-y-2 pt-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Taxable Value</span>
                                    <span className="font-semibold text-gray-900">{fmtCurrency(report.outward_supplies.taxable_value)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">CGST</span>
                                    <span className="font-medium text-gray-700">{fmtCurrency(report.outward_supplies.gst_collected.cgst)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">SGST</span>
                                    <span className="font-medium text-gray-700">{fmtCurrency(report.outward_supplies.gst_collected.sgst)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">IGST</span>
                                    <span className="font-medium text-gray-700">{fmtCurrency(report.outward_supplies.gst_collected.igst)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-50">
                                    <span className="text-sm font-bold text-gray-900">Total GST Coll.</span>
                                    <span className="font-bold text-emerald-600">{fmtCurrency(report.outward_supplies.total_gst_collected)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDownload('gstr1')}
                                disabled={!!downloading}
                                className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5m0 0L16.5 12M12 16.5V3" />
                                </svg>
                                {downloading === 'gstr1' ? 'Preparing...' : 'GSTR-1 Excel'}
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900 border-l-4 border-sky-500 pl-3">Inward Supplies (ITC)</h3>
                                <span className="text-xs text-gray-400 font-medium">(GSTR-2)</span>
                            </div>
                            <div className="space-y-2 pt-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">ITC CGST</span>
                                    <span className="font-medium text-gray-700">{fmtCurrency(report.inward_supplies.itc_available.cgst)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">ITC SGST</span>
                                    <span className="font-medium text-gray-700">{fmtCurrency(report.inward_supplies.itc_available.sgst)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">ITC IGST</span>
                                    <span className="font-medium text-gray-700">{fmtCurrency(report.inward_supplies.itc_available.igst)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-50">
                                    <span className="text-sm font-bold text-gray-900">Total ITC Avail.</span>
                                    <span className="font-bold text-sky-600">{fmtCurrency(report.inward_supplies.total_itc)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDownload('gstr2')}
                                disabled={!!downloading}
                                className="w-full py-2.5 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5m0 0L16.5 12M12 16.5V3" />
                                </svg>
                                {downloading === 'gstr2' ? 'Preparing...' : 'GSTR-2 Excel'}
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900 border-l-4 border-violet-500 pl-3">Net Tax Payable</h3>
                                <span className="text-xs text-gray-400 font-medium">(GSTR-3B)</span>
                            </div>
                            <div className="space-y-4 pt-4 text-center">
                                <div className="text-3xl font-black text-violet-700">{fmtCurrency(report.net_tax_payable)}</div>
                                <div className="flex items-center justify-center gap-4 text-xs font-medium">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-violet-300" />
                                        <span className="text-gray-500">Utilised: {fmtCurrency(report.inward_supplies.itc_utilised)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-300" />
                                        <span className="text-gray-500">Forward: {fmtCurrency(report.inward_supplies.itc_carry_forward)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button
                                    onClick={() => handleDownload('gstr3b')}
                                    disabled={!!downloading}
                                    className="w-full py-2.5 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5m0 0L16.5 12M12 16.5V3" />
                                    </svg>
                                    {downloading === 'gstr3b' ? 'Preparing...' : 'GSTR-3B Excel'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900">Rate-wise GST Summary</h2>
                            <span className="text-xs text-gray-500">Calculated from outward supplies</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">GST Rate (%)</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-600">Taxable Value</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-600">Total GST</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-600">CGST (50%)</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-600">SGST (50%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-gray-700">
                                    {report.rate_wise_summary.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-gray-400 font-medium">No taxable transactions for this month.</td></tr>
                                    ) : (
                                        report.rate_wise_summary.sort((a,b) => a.gst_rate - b.gst_rate).map((rate) => (
                                            <tr key={rate.gst_rate} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4 font-bold text-gray-900">{rate.gst_rate}%</td>
                                                <td className="py-3 px-4 text-right">{fmtCurrency(rate.taxable_value)}</td>
                                                <td className="py-3 px-4 text-right font-semibold text-violet-600">{fmtCurrency(rate.gst_amount)}</td>
                                                <td className="py-3 px-4 text-right text-gray-500">{fmtCurrency(rate.gst_amount / 2)}</td>
                                                <td className="py-3 px-4 text-right text-gray-500">{fmtCurrency(rate.gst_amount / 2)}</td>
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
