'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '../../../../lib/apiClient';

type LogEntry = {
  id: string; action: string; target_type?: string; target_id?: string;
  notes?: string; created_at: string; admin: { phone: string };
};

const ACTION_COLORS: Record<string, string> = {
  doctor_approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  doctor_rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
  shop_approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  shop_rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
  shop_recharge: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  user_activated: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  user_deactivated: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  broadcast: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  bulk_shop_approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  bulk_doctor_approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number } | null>(null);

  const load = (pg = page) => {
    setLoading(true);
    adminApi.getActivityLog(pg)
      .then(r => { setLogs(r.data.data); setPagination(r.data.pagination); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Activity Log</h1>
        <p className="text-gray-500 text-sm mt-1">Audit trail of all admin actions · {pagination?.total?.toLocaleString() ?? '…'} events</p>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-14 bg-white/[0.04] border border-white/[0.06] rounded-xl animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-600">No activity yet</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Time', 'Admin', 'Action', 'Target', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-gray-600 text-xs tabular-nums whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{log.admin.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ACTION_COLORS[log.action] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
                      {actionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {log.target_type && <span className="capitalize">{log.target_type}</span>}
                    {log.target_id && <span className="text-gray-700 font-mono ml-1 text-[10px]">#{log.target_id.substring(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{log.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-600">Page {page} of {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 bg-white/[0.05] hover:bg-white/10 text-gray-400 text-xs rounded-lg border border-white/[0.08] disabled:opacity-40 transition-all">Previous</button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="px-3 py-1 bg-white/[0.05] hover:bg-white/10 text-gray-400 text-xs rounded-lg border border-white/[0.08] disabled:opacity-40 transition-all">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
