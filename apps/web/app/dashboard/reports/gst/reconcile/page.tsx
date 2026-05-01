'use client';

import { useState, useCallback, useRef } from 'react';
import { accountingApi } from '../../../../../lib/apiClient';
import { useAuthStore } from '../../../../../store/authStore';
import Link from 'next/link';
import {
  Upload, Download, RefreshCw, CheckCircle2, AlertCircle,
  FileText, ArrowLeft, Database, GitCompare, ChevronRight,
  BarChart3, X, Info,
} from 'lucide-react';

const MONTHS = [
  { label: 'January', value: 1 }, { label: 'February', value: 2 }, { label: 'March', value: 3 },
  { label: 'April', value: 4 }, { label: 'May', value: 5 }, { label: 'June', value: 6 },
  { label: 'July', value: 7 }, { label: 'August', value: 8 }, { label: 'September', value: 9 },
  { label: 'October', value: 10 }, { label: 'November', value: 11 }, { label: 'December', value: 12 },
];
const YEARS = [2024, 2025, 2026];

type ReconType = '2A' | '2B';

interface ReconRow {
  supplier_name: string;
  gstin: string;
  b_doc_no: string;
  b_doc_date: string;
  b_taxable: number;
  b_igst: number;
  b_cgst_sgst: number;
  b_inv_val: number;
  p_doc_no: string;
  p_taxable: number;
  p_igst: number;
  diff_taxable: number;
  diff_igst: number;
  diff_cgst_sgst: number;
  match_status: string;
}

function parseTwoAPortal(json: any): any[] {
  const records: any[] = [];
  for (const sup of (json.b2b || [])) {
    const gstin = sup.ctin || '';
    const name = sup.tradeName || sup.lgnm || '';
    for (const inv of (sup.inv || [])) {
      let taxable = 0, igst = 0, cgst = 0, sgst = 0, cess = 0;
      for (const item of (inv.itms || [])) {
        const d = item.itm_det || {};
        taxable += Number(d.txval || 0);
        igst    += Number(d.iamt  || 0);
        cgst    += Number(d.camt  || 0);
        sgst    += Number(d.samt  || 0);
        cess    += Number(d.csamt || 0);
      }
      records.push({
        gstin, name,
        doc_no: inv.inum || '', doc_date: inv.idt || '',
        inv_val: Number(inv.val || 0),
        taxable, igst, cgst, sgst, cess,
        period: '', filing_date: '', gstr3b: '', irn: '',
        rcm: inv.rchrg === 'Y' ? 'Yes' : 'No',
        itc_avail: 'Inputs',
      });
    }
  }
  return records;
}

function parseTwoBPortal(json: any): any[] {
  const records: any[] = [];
  for (const sup of (json.data?.docdata?.b2b || json.b2b || [])) {
    const gstin = sup.ctin || '';
    const name = sup.tradeName || '';
    for (const inv of (sup.inv || [])) {
      records.push({
        gstin, name,
        doc_no: inv.inum || inv.doc_num || '',
        doc_date: inv.idt || '',
        inv_val: Number(inv.val || 0),
        taxable: Number(inv.txval || 0),
        igst:    Number(inv.iamt  || 0),
        cgst:    Number(inv.camt  || 0),
        sgst:    Number(inv.samt  || 0),
        cess:    Number(inv.csamt || 0),
        gstr1_period: inv.srctyp || '',
        itc_avail: inv.itcAv || 'Inputs',
        irn: '',
      });
    }
  }
  return records;
}

const STATUS_STYLE: Record<string, string> = {
  'Matched':          'bg-emerald-100 text-emerald-800 border border-emerald-200',
  'Partially Matched':'bg-amber-100 text-amber-800 border border-amber-200',
  'In Books Only':    'bg-orange-100 text-orange-800 border border-orange-200',
  'In 2A Only':       'bg-red-100 text-red-800 border border-red-200',
  'In 2B Only':       'bg-red-100 text-red-800 border border-red-200',
};

const STATUS_ROW: Record<string, string> = {
  'Matched':           'bg-emerald-50/40',
  'Partially Matched': 'bg-amber-50/60',
  'In Books Only':     'bg-orange-50/50',
  'In 2A Only':        'bg-red-50/40',
  'In 2B Only':        'bg-red-50/40',
};

function fmt(v: number) {
  return `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function GstReconcilePage() {
  const { user } = useAuthStore();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [activeType, setActiveType] = useState<ReconType>('2B');
  const [portalJson, setPortalJson] = useState<any>(null);
  const [portalFileName, setPortalFileName] = useState('');
  const [results, setResults] = useState<ReconRow[]>([]);
  const [booksCount, setBooksCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPortalFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        setPortalJson(parsed);
      } catch {
        setError('Invalid JSON file. Please upload a valid GSTR portal JSON.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setPortalFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        setPortalJson(JSON.parse(ev.target?.result as string));
        setError('');
      } catch {
        setError('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleReconcile = async () => {
    if (!portalJson) { setError('Please upload portal JSON first.'); return; }
    setLoading(true); setError(''); setResults([]);
    try {
      const portalData = activeType === '2A' ? parseTwoAPortal(portalJson) : parseTwoBPortal(portalJson);
      const fn = activeType === '2A'
        ? (accountingApi as any).reconcile2A
        : (accountingApi as any).reconcile2B;
      const res = await fn(month, year, portalData);
      const rows: ReconRow[] = res.data.data;
      setResults(rows);
      setBooksCount(rows.filter(r => r.b_doc_no && r.b_doc_no !== '-').length);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Reconciliation failed.');
    } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    if (!results.length || !portalJson) return;
    setDownloading(true);
    try {
      const portalData = activeType === '2A' ? parseTwoAPortal(portalJson) : parseTwoBPortal(portalJson);
      const fn = activeType === '2A'
        ? (accountingApi as any).reconcile2AExcel
        : (accountingApi as any).reconcile2BExcel;
      const res = await fn(month, year, portalData);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR${activeType}_Recon_${month}_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed.'); }
    finally { setDownloading(false); }
  };

  const filtered = filterStatus === 'All' ? results : results.filter(r => r.match_status === filterStatus);

  const summary = {
    total: results.length,
    matched: results.filter(r => r.match_status === 'Matched').length,
    partial: results.filter(r => r.match_status === 'Partially Matched').length,
    booksOnly: results.filter(r => r.match_status === 'In Books Only').length,
    portalOnly: results.filter(r => r.match_status.includes('Only') && !r.match_status.includes('Books')).length,
  };

  if (!user || user.role !== 'shop_owner') {
    return <div className="p-12 text-center text-gray-500">Shop owner access required.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports/gst" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">GST Reconciliation</h1>
            <p className="text-sm text-gray-400 mt-0.5">Books (DB) vs Portal (GSTR-2A/2B) — auto-matched, discrepancy flagged</p>
          </div>
        </div>
        {results.length > 0 && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Preparing...' : `Download GSTR-${activeType} Recon Excel`}
          </button>
        )}
      </div>

      {/* Config Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Type Selector */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">Reconciliation Type</label>
            <div className="flex gap-2">
              {(['2A', '2B'] as ReconType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setActiveType(t); setResults([]); setPortalJson(null); setPortalFileName(''); }}
                  className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all border ${
                    activeType === t
                      ? t === '2A' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  GSTR-{t}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              {activeType === '2A' ? '2A = Auto-drafted from supplier returns (real-time)' : '2B = Static ITC statement (monthly cutoff)'}
            </p>
          </div>

          {/* Period */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">Period</label>
            <div className="flex gap-2">
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-indigo-300 outline-none">
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="w-28 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-indigo-300 outline-none">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
              <Database className="w-3 h-3" />
              <span>Books data auto-fetched from your database</span>
            </div>
          </div>

          {/* Portal File Upload */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">
              GSTR-{activeType} Portal JSON
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
                portalJson
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
              }`}
            >
              <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              {portalJson ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-700 truncate">{portalFileName}</p>
                    <p className="text-[10px] text-emerald-500">JSON loaded ✓</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setPortalJson(null); setPortalFileName(''); setResults([]); }}
                    className="ml-auto p-1 hover:bg-emerald-100 rounded-lg">
                    <X className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-500">Drop or click to upload</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">GSTR-{activeType} JSON from GST portal</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleReconcile}
            disabled={loading || !portalJson}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg disabled:opacity-40 ${
              activeType === '2A'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Reconciling...</>
            ) : (
              <><GitCompare className="w-4 h-4" /> Run Reconciliation</>
            )}
          </button>
        </div>
      </div>

      {/* Info box when no results yet */}
      {!results.length && !loading && (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GitCompare className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-lg font-black text-gray-900 mb-2">How Reconciliation Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-left">
              {[
                { icon: Database, title: 'Books Auto-Fetched', desc: 'Purchase entries with GSTIN from your database are used as "Books" — no file upload needed.' },
                { icon: Upload, title: 'Upload Portal JSON', desc: `Download GSTR-${activeType} JSON from GST portal (gst.gov.in → Returns → GSTR-${activeType})` },
                { icon: BarChart3, title: 'Instant Match', desc: 'Records matched by GSTIN + Invoice No. Differences highlighted in colour-coded table.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white rounded-xl p-4 border border-indigo-100">
                  <Icon className="w-5 h-5 text-indigo-600 mb-2" />
                  <p className="text-sm font-black text-gray-800 mb-1">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Records', value: summary.total, color: 'from-slate-700 to-slate-800', textColor: 'text-white' },
              { label: 'Matched', value: summary.matched, color: 'from-emerald-500 to-emerald-600', textColor: 'text-white' },
              { label: 'Partial Match', value: summary.partial, color: 'from-amber-500 to-amber-600', textColor: 'text-white' },
              { label: 'Books Only', value: summary.booksOnly, color: 'from-orange-500 to-orange-600', textColor: 'text-white' },
              { label: `${activeType} Only`, value: summary.portalOnly, color: 'from-red-500 to-red-600', textColor: 'text-white' },
            ].map(card => (
              <div key={card.label} className={`rounded-2xl p-4 bg-gradient-to-br ${card.color}`}>
                <p className={`text-2xl font-black ${card.textColor}`}>{card.value}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${card.textColor} opacity-80`}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* Filter + Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-50">
              <div className="flex items-center gap-2 flex-wrap">
                {['All', 'Matched', 'Partially Matched', 'In Books Only', `In ${activeType} Only`].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterStatus === s
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s} {s !== 'All' && `(${results.filter(r => r.match_status === s).length})`}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">{filtered.length} records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-4 py-3 text-left">Supplier</th>
                    <th className="px-3 py-3 text-left">GSTIN</th>
                    <th className="px-3 py-3 text-left">Books Doc No</th>
                    <th className="px-3 py-3 text-left">Books Date</th>
                    <th className="px-3 py-3 text-right">Books Taxable</th>
                    <th className="px-3 py-3 text-right">Books IGST</th>
                    <th className="px-3 py-3 text-right">Books CGST+SGST</th>
                    <th className="px-3 py-3 text-left">{activeType} Doc No</th>
                    <th className="px-3 py-3 text-right">{activeType} Taxable</th>
                    <th className="px-3 py-3 text-right">{activeType} IGST</th>
                    <th className="px-3 py-3 text-right bg-amber-50">Diff Taxable</th>
                    <th className="px-3 py-3 text-right bg-amber-50">Diff IGST</th>
                    <th className="px-3 py-3 text-right bg-amber-50">Diff CGST+SGST</th>
                    <th className="px-3 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r, i) => {
                    const isAnomalous = Math.abs(r.diff_taxable) > 0.5 || Math.abs(r.diff_igst) > 0.5 || Math.abs(r.diff_cgst_sgst) > 0.5;
                    return (
                      <tr key={i} className={`${STATUS_ROW[r.match_status] || ''} hover:brightness-95 transition-all`}>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 max-w-[160px] truncate">{r.supplier_name}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-500 text-[10px]">{r.gstin}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-700">{r.b_doc_no}</td>
                        <td className="px-3 py-2.5 text-gray-500">{r.b_doc_date}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.b_taxable ? fmt(r.b_taxable) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.b_igst ? fmt(r.b_igst) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.b_cgst_sgst ? fmt(r.b_cgst_sgst) : '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-700">{r.p_doc_no}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.p_taxable ? fmt(r.p_taxable as number) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.p_igst ? fmt(r.p_igst as number) : '—'}</td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold bg-amber-50/50 ${Math.abs(r.diff_taxable) > 0.5 ? 'text-red-600' : 'text-gray-400'}`}>
                          {r.diff_taxable !== 0 ? fmt(r.diff_taxable) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold bg-amber-50/50 ${Math.abs(r.diff_igst) > 0.5 ? 'text-red-600' : 'text-gray-400'}`}>
                          {r.diff_igst !== 0 ? fmt(r.diff_igst) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold bg-amber-50/50 ${Math.abs(r.diff_cgst_sgst) > 0.5 ? 'text-red-600' : 'text-gray-400'}`}>
                          {r.diff_cgst_sgst !== 0 ? fmt(r.diff_cgst_sgst) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${STATUS_STYLE[r.match_status] || 'bg-gray-100 text-gray-600'}`}>
                            {r.match_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">No records for this filter.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
