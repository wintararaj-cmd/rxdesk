'use client';

import { useState } from 'react';
import { adminApi } from '../../../../lib/apiClient';

const ROLES = [
  { label: 'All Users', value: '' },
  { label: 'Patients Only', value: 'patient' },
  { label: 'Doctors Only', value: 'doctor' },
  { label: 'Shop Owners Only', value: 'shop_owner' },
];

export default function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; message: string } | null>(null);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return setError('Title and message are required.');
    if (!confirm(`Send "${title}" to ${targetRole ? targetRole + 's' : 'ALL users'}? This cannot be undone.`)) return;
    setSending(true); setError(''); setResult(null);
    try {
      const res = await adminApi.broadcast({ title: title.trim(), body: body.trim(), target_role: targetRole || undefined });
      setResult(res.data.data);
      setTitle(''); setBody('');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to send broadcast');
    } finally { setSending(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Broadcast Notification</h1>
        <p className="text-gray-500 text-sm mt-1">Send in-app notifications to users by role</p>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        {/* Target audience */}
        <div>
          <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Target Audience</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(r => (
              <button key={r.value} onClick={() => setTargetRole(r.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${targetRole === r.value ? 'bg-rose-600/20 border-rose-500/30 text-rose-400' : 'bg-white/[0.04] border-white/[0.06] text-gray-400 hover:border-white/15 hover:text-gray-300'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Notification Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
            placeholder="e.g. System Maintenance on Sunday"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-rose-500/50 placeholder:text-gray-600 transition-all" />
          <p className="text-gray-700 text-xs mt-1 text-right">{title.length}/80</p>
        </div>

        {/* Body */}
        <div>
          <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={500}
            placeholder="Write your notification message here…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-rose-500/50 placeholder:text-gray-600 resize-none transition-all" />
          <p className="text-gray-700 text-xs mt-1 text-right">{body.length}/500</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-xl text-sm border border-red-500/20">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="text-emerald-400 font-semibold text-sm">Sent successfully!</p>
              <p className="text-emerald-600 text-xs">{result.sent} users notified</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <div className="text-xs text-gray-600">
            {targetRole ? `Sending to: ${ROLES.find(r => r.value === targetRole)?.label}` : 'Sending to: All active users'}
          </div>
          <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>Send Notification</>
            )}
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-4 bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 text-xs text-amber-600 space-y-1">
        <p className="font-semibold text-amber-400">⚠️ Tips before sending:</p>
        <p>• Broadcasts are delivered as in-app notifications immediately</p>
        <p>• This action cannot be undone — double-check the audience</p>
        <p>• Keep titles short (under 50 chars) for best mobile display</p>
      </div>
    </div>
  );
}
