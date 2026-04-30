'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi, shopApi } from '../../../../lib/apiClient';
import { useAuthStore } from '../../../../store/authStore';
import Link from 'next/link';
import { 
  FileText, Download, RefreshCw, AlertCircle, CheckCircle2, 
  Clock, TrendingUp, TrendingDown, Calculator, ArrowRight,
  ChevronRight, ShieldCheck, Calendar, Wallet, Info, Zap
} from 'lucide-react';

const MONTHS = [
  { label: 'January', value: 1 }, { label: 'February', value: 2 }, { label: 'March', value: 3 },
  { label: 'April', value: 4 }, { label: 'May', value: 5 }, { label: 'June', value: 6 },
  { label: 'July', value: 7 }, { label: 'August', value: 8 }, { label: 'September', value: 9 },
  { label: 'October', value: 10 }, { label: 'November', value: 11 }, { label: 'December', value: 12 },
];
const QUARTERS = [
  { label: 'Q1 (Apr–Jun)', value: 1 }, { label: 'Q2 (Jul–Sep)', value: 2 },
  { label: 'Q3 (Oct–Dec)', value: 3 }, { label: 'Q4 (Jan–Mar)', value: 4 },
];
const YEARS = [2024, 2025, 2026];

/** Returns the filing due date for GSTR-3B (20th of next month) */
function getFilingDeadline(month: number, year: number) {
  const due = new Date(year, month, 20); // month is 0-indexed in Date, so month (1-12) → next month
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  return { date: due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), daysLeft: diffDays };
}

export default function GstReportPage() {
  const { user } = useAuthStore();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor((today.getMonth()) / 3) + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b' | 'gstr2'>('gstr3b');

  const { data: shopRes, isLoading: isLoadingShop } = useQuery<any>({ 
    queryKey: ['shop-profile'], queryFn: () => shopApi.getMyShop(),
    enabled: !!user && user.role === 'shop_owner'
  });
  const shop = shopRes?.data?.data;
  const isComposite = shop?.gst_type === 'composite';

  const { data: report, isLoading, isError, refetch } = useQuery<any>({
    queryKey: isComposite ? ['gst-report-comp', quarter, year] : ['gst-report', month, year],
    queryFn: () =>
      isComposite 
        ? accountingApi.getCompositionGstReport(quarter, year).then(r => r.data.data)
        : accountingApi.getGstSummary(month, year).then(r => r.data.data),
    enabled: !!user && user.role === 'shop_owner' && !!shop,
  });

  const deadline = useMemo(() => getFilingDeadline(month, year), [month, year]);

  const fmt = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtShort = (v: number) => {
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
    if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
    return fmt(v);
  };

  const handleDownload = async (type: 'gstr1' | 'gstr2' | 'gstr3b' | 'cmp08' | 'gstr4') => {
    setDownloading(type);
    try {
      let res;
      let filename = `${type.toUpperCase()}_${year}.xlsx`;
      if (type === 'gstr1') res = await accountingApi.getGstr1Excel(month, year);
      else if (type === 'gstr2') res = await accountingApi.getGstr2Excel(month, year);
      else if (type === 'gstr3b') res = await accountingApi.getGstr3bExcel(month, year);
      else if (type === 'cmp08') { res = await accountingApi.getCompositionGstExcel(quarter, year); filename = `CMP08_Q${quarter}_${year}.xlsx`; }
      else if (type === 'gstr4') {
        const fySelector = document.getElementById('gstr4-fy-sidebar') as HTMLSelectElement;
        const fy = fySelector?.value || year;
        res = await accountingApi.getGstr4Excel(Number(fy)); filename = `GSTR4_FY${fy}.xlsx`;
      }
      if (res) {
        const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch { alert('Failed to download excel report.'); }
    finally { setDownloading(null); }
  };

  if (!user || user.role !== 'shop_owner') {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-gray-700 font-semibold">Shop owner access required</p>
        <Link href="/dashboard" className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700">Go to Dashboard →</Link>
      </div>
    );
  }
  if (isLoadingShop) return <div className="p-12 text-center text-gray-400">Loading shop profile...</div>;

  // ── Regular filer layout ────────────────────────────────────────────
  const out = report?.outward_supplies;
  const inw = report?.inward_supplies;
  const netTax = report?.net_tax_payable ?? 0;
  const itcTotal = inw?.total_itc ?? 0;
  const itcUtilised = inw?.itc_utilised ?? 0;
  const itcCarryFwd = inw?.itc_carry_forward ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">GST Returns Centre</h1>
            {isComposite && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-indigo-200">Composition</span>}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Automated calculations, ITC tracking & one-click filing exports</p>
        </div>
        <div className="flex items-center gap-3">
          {isComposite ? (
            <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-700">
              {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          ) : (
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => refetch()} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400 font-medium animate-pulse uppercase tracking-[0.2em] text-[10px]">Preparing GST Insights...</div>}
      {isError  && <div className="text-center py-12 text-red-500">Failed to load GST data.</div>}

      {report && !isComposite && (
        <>
          {/* ── View Toggle ─────────────────────────────────────────── */}
          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-2xl w-fit mb-4">
            <button 
              onClick={() => setActiveTab('gstr3b')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'gstr3b' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Dashboard View
            </button>
            <button 
              onClick={() => setActiveTab('gstr3b_official' as any)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === ('gstr3b_official' as any) ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Official Table (3.1 & 4)
            </button>
          </div>

          {activeTab === 'gstr3b' && (
            <>
              {/* ── GSTR-3B Live Dashboard ──────────────────────────────── */}
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-800 p-8 shadow-2xl shadow-violet-500/20">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-black/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-violet-200/70 text-[10px] font-black uppercase tracking-[0.2em]">GSTR-3B — Net Tax Summary</p>
                      <h2 className="text-white text-xl font-black mt-1">
                        {MONTHS.find(m => m.value === month)?.label} {year}
                      </h2>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold ${
                      deadline.daysLeft < 0  ? 'bg-red-500/20 border-red-400/30 text-red-200' :
                      deadline.daysLeft <= 5 ? 'bg-amber-500/20 border-amber-400/30 text-amber-200' :
                      'bg-white/10 border-white/20 text-white/80'
                    }`}>
                      <Clock className="w-4 h-4" />
                      <span>
                        {deadline.daysLeft < 0  ? 'Filing overdue!' :
                         deadline.daysLeft === 0 ? 'Due today!' :
                         `${deadline.daysLeft}d left — ${deadline.date}`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* GST Collected */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-300" />
                        <span className="text-white/60 text-[10px] font-black uppercase">GST Collected</span>
                      </div>
                      <p className="text-white text-2xl font-black">{fmtShort(out?.total_gst_collected ?? 0)}</p>
                      <p className="text-white/50 text-[10px] mt-1">Outward supplies</p>
                    </div>
                    {/* ITC Available */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-sky-300" />
                        <span className="text-white/60 text-[10px] font-black uppercase">ITC Available</span>
                      </div>
                      <p className="text-sky-300 text-2xl font-black">{fmtShort(itcTotal)}</p>
                      <p className="text-white/50 text-[10px] mt-1">Inward purchases</p>
                    </div>
                    {/* ITC Utilised */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-violet-300" />
                        <span className="text-white/60 text-[10px] font-black uppercase">ITC Utilised</span>
                      </div>
                      <p className="text-violet-300 text-2xl font-black">{fmtShort(itcUtilised)}</p>
                      <p className="text-white/50 text-[10px] mt-1">Against tax liability</p>
                    </div>
                    {/* Net Payable */}
                    <div className={`rounded-2xl p-4 border ${netTax > 0 ? 'bg-red-500/20 border-red-400/30' : 'bg-emerald-500/20 border-emerald-400/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="w-4 h-4 text-white" />
                        <span className="text-white/60 text-[10px] font-black uppercase">Net Payable</span>
                      </div>
                      <p className={`text-2xl font-black ${netTax > 0 ? 'text-red-200' : 'text-emerald-200'}`}>{fmtShort(netTax)}</p>
                      <p className="text-white/50 text-[10px] mt-1">{netTax <= 0 ? '✓ Fully offset by ITC' : 'Pay via GST portal'}</p>
                    </div>
                  </div>

                  {/* ITC Carry Forward */}
                  {itcCarryFwd > 0 && (
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 mb-4">
                      <Info className="w-4 h-4 text-sky-300 flex-shrink-0" />
                      <p className="text-white/80 text-xs font-medium">
                        <span className="font-black text-sky-300">{fmt(itcCarryFwd)}</span> of ITC carries forward to next month due to excess credit.
                      </p>
                    </div>
                  )}

                  {/* GSTR-3B Download CTA */}
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleDownload('gstr3b')} disabled={!!downloading}
                      className="flex items-center gap-2 bg-white text-violet-700 px-6 py-3 rounded-2xl font-black text-sm hover:bg-violet-50 transition-all shadow-lg disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {downloading === 'gstr3b' ? 'Preparing...' : 'Download GSTR-3B Excel'}
                    </button>
                    <div className="flex items-center gap-2 text-white/50 text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Ready for GST portal filing
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CGST / SGST Breakup ────────────────────────────────── */}
              {(out?.gst_collected?.cgst > 0 || out?.gst_collected?.igst > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <TaxBreakCard label="CGST Collected" amount={out?.gst_collected?.cgst ?? 0} fmt={fmt} color="border-l-emerald-500" />
                  <TaxBreakCard label="SGST Collected" amount={out?.gst_collected?.sgst ?? 0} fmt={fmt} color="border-l-sky-500" />
                  <TaxBreakCard label="IGST Collected" amount={out?.gst_collected?.igst ?? 0} fmt={fmt} color="border-l-violet-500" />
                </div>
              )}
            </>
          )}

          {activeTab === ('gstr3b_official' as any) && (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">GSTR-3B Return View</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Standard Government Format</p>
                </div>
                <button onClick={() => handleDownload('gstr3b')} disabled={!!downloading} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                  <Download className="w-4 h-4" />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/80 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200">
                      <th className="px-6 py-4 w-1/3">Particulars</th>
                      <th className="px-4 py-4 text-right">Taxable Value</th>
                      <th className="px-4 py-4 text-right">Integrated Tax (IGST)</th>
                      <th className="px-4 py-4 text-right">Central Tax (CGST)</th>
                      <th className="px-4 py-4 text-right">State/UT Tax (SGST)</th>
                      <th className="px-4 py-4 text-right">Cess</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {/* SECTION 3.1 */}
                    <tr className="bg-indigo-50/30">
                      <td colSpan={6} className="px-6 py-3 font-black text-indigo-700 uppercase tracking-wider bg-indigo-50/50">
                        3.1 Details of Outward Supplies and inward supplies liable to reverse charge
                      </td>
                    </tr>
                    <GstrRow 
                      label="(a) Outward taxable supplies (other than zero rated, nil rated and exempted)"
                      taxable={out?.taxable_value ?? 0}
                      igst={out?.gst_collected?.igst ?? 0}
                      cgst={out?.gst_collected?.cgst ?? 0}
                      sgst={out?.gst_collected?.sgst ?? 0}
                      fmt={fmt}
                    />
                    <GstrRow label="(b) Outward taxable supplies (zero rated)" fmt={fmt} />
                    <GstrRow label="(c) Other outward supplies (Nil rated, exempted)" fmt={fmt} />
                    <GstrRow label="(d) Inward supplies (applicable for Reverse Charge)" fmt={fmt} />
                    <GstrRow label="(e) Non-GST outward supplies" fmt={fmt} />

                    {/* SECTION 4 */}
                    <tr className="bg-indigo-50/30">
                      <td colSpan={6} className="px-6 py-3 font-black text-indigo-700 uppercase tracking-wider bg-indigo-50/50">
                        4. Eligible Input Tax Credit (ITC)
                      </td>
                    </tr>
                    <GstrRow 
                      label="(A) ITC Available (whether in full or part)"
                      igst={inw?.itc_available?.igst ?? 0}
                      cgst={inw?.itc_available?.cgst ?? 0}
                      sgst={inw?.itc_available?.sgst ?? 0}
                      fmt={fmt}
                      isHeader
                    />
                    <GstrRow label="1. Import of goods" depth={1} fmt={fmt} />
                    <GstrRow label="2. Import of services" depth={1} fmt={fmt} />
                    <GstrRow label="3. Inward supplies liable to reverse charge (other than 1 & 2 above)" depth={1} fmt={fmt} />
                    <GstrRow label="4. Inward supplies from ISD" depth={1} fmt={fmt} />
                    <GstrRow 
                      label="5. All other ITC" depth={1} 
                      igst={inw?.itc_available?.igst ?? 0}
                      cgst={inw?.itc_available?.cgst ?? 0}
                      sgst={inw?.itc_available?.sgst ?? 0}
                      fmt={fmt}
                    />
                    <GstrRow label="(B) ITC Reversed" isHeader fmt={fmt} />
                    <GstrRow 
                      label="(C) Net ITC Available (A) - (B)"
                      igst={inw?.itc_available?.igst ?? 0}
                      cgst={inw?.itc_available?.cgst ?? 0}
                      sgst={inw?.itc_available?.sgst ?? 0}
                      fmt={fmt}
                      isHeader
                      highlight
                    />
                    <GstrRow label="(D) Ineligible ITC" isHeader fmt={fmt} />
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab Navigation: GSTR-1 / GSTR-2 / Rate Table ──────── */}

          {/* ── Tab Navigation: GSTR-1 / GSTR-2 / Rate Table ──────── */}
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              {([ 
                { id: 'gstr3b', label: 'GSTR-3B Net', icon: Calculator },
                { id: 'gstr1',  label: 'GSTR-1 Outward', icon: TrendingUp },
                { id: 'gstr2',  label: 'GSTR-2 ITC', icon: TrendingDown },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors border-b-2 ${
                    activeTab === tab.id ? 'border-violet-600 text-violet-700 bg-violet-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'gstr3b' && (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">GSTR-3B Computation Summary</p>
                  <GstRow label="Gross Tax Liability" value={fmt(out?.total_gst_collected ?? 0)} color="text-gray-900" />
                  <GstRow label="Less: ITC CGST" value={`- ${fmt(inw?.itc_available?.cgst ?? 0)}`} color="text-emerald-600" />
                  <GstRow label="Less: ITC SGST" value={`- ${fmt(inw?.itc_available?.sgst ?? 0)}`} color="text-emerald-600" />
                  <GstRow label="Less: ITC IGST" value={`- ${fmt(inw?.itc_available?.igst ?? 0)}`} color="text-emerald-600" />
                  <div className="h-px bg-gray-100 my-2" />
                  <GstRow label="Net Tax Payable (Cash Ledger)" value={fmt(netTax)} color={netTax > 0 ? 'text-red-600 font-black' : 'text-emerald-600 font-black'} bold />
                  {itcCarryFwd > 0 && <GstRow label="ITC Carry Forward to Next Month" value={fmt(itcCarryFwd)} color="text-sky-600" />}
                </div>
              )}

              {activeTab === 'gstr1' && (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Outward Supplies (GSTR-1)</p>
                  <GstRow label="Taxable Value" value={fmt(out?.taxable_value ?? 0)} />
                  <GstRow label="CGST" value={fmt(out?.gst_collected?.cgst ?? 0)} />
                  <GstRow label="SGST" value={fmt(out?.gst_collected?.sgst ?? 0)} />
                  <GstRow label="IGST" value={fmt(out?.gst_collected?.igst ?? 0)} />
                  <div className="h-px bg-gray-100 my-2" />
                  <GstRow label="Total GST Collected" value={fmt(out?.total_gst_collected ?? 0)} bold color="text-emerald-700" />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => handleDownload('gstr1')} disabled={!!downloading}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                      <Download className="w-3.5 h-3.5" />
                      {downloading === 'gstr1' ? 'Preparing...' : 'Download GSTR-1 Excel'}
                    </button>
                    <button onClick={async () => {
                      setDownloading('gstr1-json');
                      try {
                        const res = await (accountingApi as any).getGstr1Json(month, year);
                        const data = res.data.data;
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `GSTR1_${month}_${year}.json`; a.click();
                      } catch (e) { alert('JSON export failed'); }
                      finally { setDownloading(null); }
                    }} disabled={!!downloading}
                      className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors disabled:opacity-50">
                      <FileText className="w-3.5 h-3.5" />
                      {downloading === 'gstr1-json' ? 'Generating...' : 'Download JSON (Govt Utility)'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'gstr2' && (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Inward Supplies & ITC (GSTR-2)</p>
                  <GstRow label="ITC CGST Available" value={fmt(inw?.itc_available?.cgst ?? 0)} color="text-sky-700" />
                  <GstRow label="ITC SGST Available" value={fmt(inw?.itc_available?.sgst ?? 0)} color="text-sky-700" />
                  <GstRow label="ITC IGST Available" value={fmt(inw?.itc_available?.igst ?? 0)} color="text-sky-700" />
                  <div className="h-px bg-gray-100 my-2" />
                  <GstRow label="Total ITC Available" value={fmt(itcTotal)} bold color="text-sky-700" />
                  <GstRow label="ITC Utilised" value={fmt(itcUtilised)} color="text-violet-600" />
                  <GstRow label="ITC Carry Forward" value={fmt(itcCarryFwd)} color="text-violet-400" />
                  <div className="mt-4">
                    <button onClick={() => handleDownload('gstr2')} disabled={!!downloading}
                      className="flex items-center gap-2 bg-sky-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-sky-700 transition-colors disabled:opacity-50">
                      <Download className="w-3.5 h-3.5" />
                      {downloading === 'gstr2' ? 'Preparing...' : 'Download GSTR-2 Excel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Rate-wise Summary ──────────────────────────────────── */}
          {report.rate_wise_summary?.length > 0 && (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Rate-wise GST Summary</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Breakdown by applicable GST slab</p>
                </div>
                <span className="text-xs text-gray-400">Outward supplies</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['GST Rate (%)', 'Taxable Value', 'Total GST', 'CGST (50%)', 'SGST (50%)'].map(h => (
                        <th key={h} className={`py-3 px-4 font-semibold text-gray-600 ${h === 'GST Rate (%)' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-700">
                    {report.rate_wise_summary.sort((a: any, b: any) => a.gst_rate - b.gst_rate).map((rate: any) => (
                      <tr key={rate.gst_rate} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-gray-900">{rate.gst_rate}%</td>
                        <td className="py-3 px-4 text-right">{fmt(rate.taxable_value)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-violet-600">{fmt(rate.gst_amount)}</td>
                        <td className="py-3 px-4 text-right text-gray-500">{fmt(rate.gst_amount / 2)}</td>
                        <td className="py-3 px-4 text-right text-gray-500">{fmt(rate.gst_amount / 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Composition scheme ─────────────────────────────────────── */}
      {report && isComposite && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CMP-08 Card */}
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-50/50 p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12" />
            <div className="flex items-center justify-between relative z-10">
              <h3 className="font-black text-gray-900 border-l-4 border-indigo-500 pl-3 uppercase text-xs tracking-widest">Quarterly Summary</h3>
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">CMP-08</span>
            </div>
            <div className="space-y-4 pt-2 relative z-10">
              <div className="flex justify-between items-end border-b border-gray-50 pb-4">
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Total Sales Turnover</p>
                  <p className="text-2xl font-black text-gray-900 tracking-tighter">{fmt(report.total_turnover)}</p>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Tax Liability (1%)</p>
                  <p className="text-3xl font-black text-indigo-600 tracking-tighter">{fmt(report.tax_payable)}</p>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-black uppercase tracking-widest">Rate: 1%</span>
              </div>
            </div>
            <button onClick={() => handleDownload('cmp08')} disabled={!!downloading}
              className="w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              {downloading === 'cmp08' ? 'Preparing File...' : 'Download CMP-08 Excel'}
            </button>
          </div>

          {/* GSTR-4 Annual Card */}
          <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
            <div className="relative z-10 mb-8 flex justify-between items-start">
              <div>
                <p className="text-[10px] text-emerald-400/60 font-black uppercase tracking-[0.2em] mb-1">Annual Compliance</p>
                <h3 className="text-xl font-black text-white tracking-tight uppercase">GSTR-4 Report</h3>
              </div>
              <span className="text-[10px] border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full font-black uppercase">Filing</span>
            </div>
            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Select Financial Year</label>
                <select id="gstr4-fy-sidebar"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-black text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
                  defaultValue={today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear()}>
                  <option value={2024}>FY 2024-25</option>
                  <option value={2025}>FY 2025-26</option>
                  <option value={2026}>FY 2026-27</option>
                </select>
              </div>
              <button onClick={() => handleDownload('gstr4')} disabled={!!downloading}
                className="w-full py-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                {downloading === 'gstr4' ? 'Processing...' : 'Export GSTR-4 (Annual)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ───────────────────────────────────────────────────────────
function TaxBreakCard({ label, amount, fmt, color }: any) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 border-l-4 ${color}`}>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-black text-gray-900">{fmt(amount)}</p>
    </div>
  );
}

function GstRow({ label, value, color = 'text-gray-700', bold = false }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${bold ? 'bg-gray-50 -mx-2 px-2 rounded-xl' : ''}`}>
      <span className={`text-sm ${bold ? 'font-black text-gray-900' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-black' : 'font-semibold'} ${color}`}>{value}</span>
    </div>
  );
}

function GstrRow({ 
  label, taxable = 0, igst = 0, cgst = 0, sgst = 0, cess = 0, fmt, isHeader = false, depth = 0, highlight = false 
}: any) {
  return (
    <tr className={`${isHeader ? 'bg-gray-50/50 font-bold' : ''} ${highlight ? 'bg-indigo-50/50' : 'hover:bg-gray-50/30'} transition-colors`}>
      <td className={`px-6 py-3 text-gray-700 ${depth > 0 ? 'pl-10' : ''} ${isHeader ? 'font-black text-gray-900' : ''}`}>
        {label}
      </td>
      <td className="px-4 py-3 text-right font-mono text-gray-600">{taxable > 0 ? fmt(taxable) : '0.00'}</td>
      <td className={`px-4 py-3 text-right font-mono ${igst > 0 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>{igst > 0 ? fmt(igst) : '0.00'}</td>
      <td className={`px-4 py-3 text-right font-mono ${cgst > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{cgst > 0 ? fmt(cgst) : '0.00'}</td>
      <td className={`px-4 py-3 text-right font-mono ${sgst > 0 ? 'text-sky-600 font-bold' : 'text-gray-400'}`}>{sgst > 0 ? fmt(sgst) : '0.00'}</td>
      <td className="px-4 py-3 text-right font-mono text-gray-400">{cess > 0 ? fmt(cess) : '0.00'}</td>
    </tr>
  );
}
