'use client';

import { useState, useCallback, useEffect } from 'react';
import { Shield, Download, Search, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { adminApi } from '@/lib/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  action: string;
  actor_role: string | null;
  resource: string | null;
  resource_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: { phone: string; role: string } | null;
  shop: { shop_name: string; city: string } | null;
}

interface Pagination {
  total: number;
  page: number;
  totalPages: number;
}

// ─── Action badge config ──────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  'bill':          { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'prescription':  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  'auth':          { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'purchase':      { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  'supplier_payment': { bg: 'bg-rose-50',  text: 'text-rose-700',    dot: 'bg-rose-500' },
  'customer_credit':  { bg: 'bg-cyan-50',  text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  'default':       { bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400' },
};

function getActionStyle(action: string) {
  const prefix = action.split('.')[0];
  return ACTION_STYLES[prefix] ?? ACTION_STYLES['default'];
}

const ACTION_OPTIONS = [
  { value: '',                       label: 'All Actions' },
  { value: 'bill.created',           label: 'Bill Created' },
  { value: 'bill.voided',            label: 'Bill Voided' },
  { value: 'prescription.created',   label: 'Prescription Created' },
  { value: 'prescription.viewed',    label: 'Prescription Viewed' },
  { value: 'prescription.deleted',   label: 'Prescription Deleted' },
  { value: 'purchase.created',       label: 'Purchase Created' },
  { value: 'purchase.updated',       label: 'Purchase Updated' },
  { value: 'purchase.voided',        label: 'Purchase Voided' },
  { value: 'supplier_payment.recorded', label: 'Supplier Payment' },
  { value: 'customer_credit.payment',   label: 'Credit Payment' },
  { value: 'auth.login',             label: 'Login' },
];

const ROLE_OPTIONS = [
  { value: '',            label: 'All Roles' },
  { value: 'shop_owner',  label: 'Shop Owner' },
  { value: 'doctor',      label: 'Doctor' },
  { value: 'patient',     label: 'Patient' },
  { value: 'admin',       label: 'Admin' },
];

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchLogs(params: {
  action?: string; actor_role?: string; from?: string; to?: string; page: number;
}): Promise<{ logs: AuditEntry[]; pagination: Pagination }> {
  const { data } = await adminApi.getAuditLogs(params);
  return { logs: data.data, pagination: data.pagination };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [logs, setLogs]             = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<AuditEntry | null>(null);

  // Filters
  const [action, setAction]       = useState('');
  const [actorRole, setActorRole] = useState('');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [page, setPage]           = useState(1);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const { logs, pagination } = await fetchLogs({ action, actor_role: actorRole, from, to, page: p });
      setLogs(logs);
      setPagination(pagination);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [action, actorRole, from, to, page]);

  useEffect(() => { load(1); setPage(1); }, [action, actorRole, from, to]);
  useEffect(() => { load(page); }, [page]);

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function buildExportUrl() {
    return adminApi.getAuditLogsExportUrl({ action, actor_role: actorRole, from, to });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audit Trail</h1>
            <p className="text-xs text-gray-500">
              {pagination.total.toLocaleString('en-IN')} events logged · DPDP Act compliance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(page)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg border border-gray-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={buildExportUrl()}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Action</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
          >
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Role</label>
          <select
            value={actorRole}
            onChange={e => setActorRole(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
          >
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">From</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">To</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
          />
        </div>

        {(action || actorRole || from || to) && (
          <button
            onClick={() => { setAction(''); setActorRole(''); setFrom(''); setTo(''); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600 mt-4 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {error && (
          <div className="px-6 py-4 text-sm text-rose-600 bg-rose-50 border-b border-rose-100">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Timestamp</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Actor</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Shop</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Resource</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">IP</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && !logs.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-400" />
                    Loading audit logs...
                  </td>
                </tr>
              )}
              {!loading && !logs.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    No audit events found for the selected filters
                  </td>
                </tr>
              )}
              {logs.map(log => {
                const style = getActionStyle(log.action);
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="hover:bg-violet-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {fmtDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${style.bg} ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{log.user?.phone ?? '—'}</div>
                      <div className="text-xs text-gray-400">{log.actor_role ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      {log.shop ? (
                        <>
                          <div className="font-medium text-gray-800 text-xs">{log.shop.shop_name}</div>
                          <div className="text-xs text-gray-400">{log.shop.city}</div>
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {log.resource && <>{log.resource}</>}
                      {log.resource_id && <div className="font-mono text-gray-300 text-[10px] truncate max-w-[120px]">{log.resource_id}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.ip_address ?? '—'}</td>
                    <td className="px-4 py-3">
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <button className="text-xs text-violet-600 hover:underline font-medium">View →</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>{pagination.total.toLocaleString('en-IN')} total events · Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getActionStyle(selected.action).bg} ${getActionStyle(selected.action).text} mb-2`}>
                  <span className={`w-2 h-2 rounded-full ${getActionStyle(selected.action).dot}`} />
                  {selected.action}
                </span>
                <p className="text-xs text-gray-400">{fmtDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-800 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              {[
                ['Actor', `${selected.user?.phone ?? '—'} (${selected.actor_role ?? ''})`],
                ['Shop', selected.shop ? `${selected.shop.shop_name}, ${selected.shop.city}` : '—'],
                ['Resource', selected.resource ?? '—'],
                ['Resource ID', selected.resource_id ?? '—'],
                ['IP Address', selected.ip_address ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-gray-400 w-28 shrink-0 font-medium">{label}</span>
                  <span className="text-gray-700 font-mono text-xs break-all">{String(value)}</span>
                </div>
              ))}

              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div>
                  <p className="text-gray-400 font-medium mb-1">Metadata</p>
                  <pre className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
