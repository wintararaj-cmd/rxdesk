'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billApi, prescriptionApi, inventoryApi, shopApi, medicinesApi } from '../../../lib/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

interface BillItem { id: string; medicine_name: string; quantity: number; mrp: number; line_total: number; }
interface BillData {
  id: string;
  bill_number: string;
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
  items: BillItem[];
  patient?: { full_name?: string; phone?: string; user_id?: string };
  customer_name?: string | null;
  customer_phone?: string | null;
}

interface BillStats {
  total_bills: number;
  total_revenue: number;
  total_gst: number;
  total_discount: number;
  paid: { count: number; amount: number };
  pending: { count: number; amount: number };
  partial: { count: number; amount: number };
}

interface Pagination { page: number; limit: number; total: number; total_pages: number; }

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

// ── Thermal Print & WhatsApp ─────────────────────────────────────────────────

function printThermalReceipt(bill: BillData, shopName = 'Medical Shop') {
  const displayName = bill.customer_name ?? bill.patient?.full_name ?? 'Walk-in Customer';
  const date = new Date(bill.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const isTax = Number(bill.gst_amount) > 0;
  const invoiceLabel = isTax ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  const cur = (v: number | string) => `Rs.${Number(v).toFixed(2)}`;
  const itemRows = bill.items.map(it =>
    `<tr>
      <td style="padding:2px 0;word-break:break-word">${it.medicine_name}</td>
      <td style="text-align:center;padding:2px 4px;white-space:nowrap">${it.quantity}</td>
      <td style="text-align:right;padding:2px 0;white-space:nowrap">${cur(it.mrp)}</td>
      <td style="text-align:right;padding:2px 0;white-space:nowrap">${cur(it.line_total)}</td>
    </tr>`
  ).join('');
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${bill.bill_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:80mm auto;margin:4mm}
  body{font-family:'Courier New',Courier,monospace;font-size:11px;width:72mm}
  .c{text-align:center}.b{font-weight:bold}
  .div{border-top:1px dashed #000;margin:4px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:9px;text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:2px}
  .tot td{border-top:1px solid #000;padding-top:3px;font-weight:bold;font-size:13px}
</style></head><body>
<div class="c b" style="font-size:14px">${shopName}</div>
<div class="c" style="font-size:9px;margin:2px 0">${date}</div>
<div class="div"></div>
<div class="c b" style="font-size:10px;letter-spacing:1px;margin:3px 0">${invoiceLabel}</div>
<div class="div"></div>
<div><b>Bill:</b> ${bill.bill_number}</div>
<div><b>Customer:</b> ${displayName}</div>
${bill.customer_phone ? `<div><b>Phone:</b> ${bill.customer_phone}</div>` : ''}
<div class="div"></div>
<table>
  <thead><tr>
    <th style="text-align:left;width:45%">Item</th>
    <th style="text-align:center;width:10%">Qty</th>
    <th style="text-align:right;width:22%">Rate</th>
    <th style="text-align:right;width:23%">Amt</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
  <tfoot>
    <tr><td colspan="3" style="padding-top:3px">Subtotal</td><td style="text-align:right;padding-top:3px">${cur(bill.subtotal)}</td></tr>
    ${bill.discount_amount > 0 ? `<tr><td colspan="3">Discount</td><td style="text-align:right">-${cur(bill.discount_amount)}</td></tr>` : ''}
    ${isTax ? `<tr><td colspan="3">GST</td><td style="text-align:right">${cur(bill.gst_amount)}</td></tr>` : ''}
    <tr class="tot"><td colspan="3">TOTAL</td><td style="text-align:right">${cur(bill.total_amount)}</td></tr>
  </tfoot>
</table>
<div class="div"></div>
<div><b>Payment:</b> ${(bill.payment_method ?? '').toUpperCase()} | <b>Status:</b> ${(bill.payment_status ?? '').toUpperCase()}</div>
<div class="div"></div>
<div class="c" style="margin-top:4px">Thank you for your purchase!</div>
<div class="c" style="font-size:9px;margin-top:2px">Powered by RxDesk</div>
</body></html>`;
  const w = window.open('', '_blank', 'width=440,height=680');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); setTimeout(() => w.close(), 600); }, 300);
}

function sendWhatsApp(bill: BillData, shopName = 'Medical Shop') {
  const displayName = bill.customer_name ?? bill.patient?.full_name ?? 'Walk-in Customer';
  const date = new Date(bill.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const cur = (v: number | string) => `Rs.${Number(v).toFixed(2)}`;
  const itemLines = bill.items
    .map(it => `  • ${it.medicine_name} x${it.quantity} = ${cur(it.line_total)}`)
    .join('\n');
  let msg = `🧾 *${shopName}*\n`;
  msg += `📋 Bill: *${bill.bill_number}*\n`;
  msg += `📅 Date: ${date}\n`;
  msg += `👤 Customer: ${displayName}\n`;
  if (bill.customer_phone) msg += `📞 Phone: ${bill.customer_phone}\n`;
  msg += `\n*Items:*\n${itemLines}\n\n`;
  msg += `Subtotal: ${cur(bill.subtotal)}\n`;
  if (bill.discount_amount > 0) msg += `Discount: -${cur(bill.discount_amount)}\n`;
  if (bill.gst_amount > 0) msg += `GST: ${cur(bill.gst_amount)}\n`;
  msg += `💰 *Total: ${cur(bill.total_amount)}*\n`;
  msg += `\nPayment: ${(bill.payment_method ?? '').toUpperCase()} | ${(bill.payment_status ?? '').toUpperCase()}\n`;
  msg += `\nThank you! 🙏`;
  const encoded = encodeURIComponent(msg);
  const raw = (bill.customer_phone ?? '').replace(/\D/g, '');
  const phone = raw.length === 10 ? `91${raw}` : raw;
  window.open(phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`, '_blank');
}

const STATUS_BADGE: Record<string, { bg: string; dot: string }> = {
  paid: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  partial: { bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
};

const METHOD_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  cash: { label: 'Cash', icon: '💵', color: 'text-emerald-600' },
  upi: { label: 'UPI', icon: '📱', color: 'text-violet-600' },
  card: { label: 'Card', icon: '💳', color: 'text-sky-600' },
  credit: { label: 'Credit', icon: '📝', color: 'text-amber-600' },
};

// ── Reusable Status Badge ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { bg: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-semibold capitalize ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ── New Bill Tab ─────────────────────────────────────────────────────────────

function NewBillTab() {
  const qc = useQueryClient();
  const [qrContent, setQrContent] = useState('');
  const [bill, setBill] = useState<BillData | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: () => shopApi.getMyShop().then(r => r.data.data), staleTime: 5 * 60 * 1000 });
  const shopName = (shopData as any)?.shop_name ?? 'Medical Shop';

  const verifyMutation = useMutation({
    mutationFn: (qr: string) => prescriptionApi.verifyQR(qr),
    onSuccess: (res) => {
      const d = res.data.data;
      const pid = d?.prescription?.id ?? d?.id;
      if (pid) setPrescriptionId(pid);
    },
  });

  const generateMutation = useMutation({
    mutationFn: (pid: string) => billApi.generate(pid),
    onSuccess: (res) => {
      setBill(res.data.data);
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => billApi.markPaid(id, method),
    onSuccess: (res) => {
      setBill(res.data.data);
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
    },
  });

  const reset = () => {
    setBill(null); setQrContent(''); setPrescriptionId(null);
    verifyMutation.reset(); generateMutation.reset();
  };

  return (
    <div className="max-w-xl mx-auto">
      {!bill ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-violet-100/50 to-transparent rounded-bl-full pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" /></svg>
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Scan Prescription</h2>
                <p className="text-gray-400 text-sm mt-0.5">Paste QR code content to generate a bill</p>
              </div>
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 resize-none h-28 transition-all placeholder:text-gray-300"
              placeholder="Paste the QR code content here..."
              value={qrContent}
              onChange={(e) => setQrContent(e.target.value)}
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => verifyMutation.mutate(qrContent)}
                disabled={!qrContent || verifyMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 transition-all duration-200"
              >
                {verifyMutation.isPending ? 'Verifying…' : 'Verify QR'}
              </button>
              {prescriptionId && (
                <button
                  onClick={() => generateMutation.mutate(prescriptionId)}
                  disabled={generateMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 transition-all duration-200"
                >
                  {generateMutation.isPending ? 'Generating…' : 'Generate Bill'}
                </button>
              )}
            </div>
            {verifyMutation.isSuccess && prescriptionId && (
              <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Prescription verified — ready to generate bill
              </div>
            )}
            {verifyMutation.isError && (
              <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2.5 rounded-xl text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                Invalid or tampered QR code
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-gray-900 text-xl">{bill.bill_number}</h2>
              <p className="text-gray-400 text-sm mt-0.5">{bill.patient?.full_name ?? bill.customer_name ?? 'Patient'}</p>
            </div>
            <StatusBadge status={bill.payment_status} />
          </div>

          <div className="bg-gray-50/80 rounded-xl p-4 mb-5">
            {bill.items.map((item, i) => (
              <div key={item.id} className={`flex items-center justify-between py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div>
                  <span className="text-gray-900 font-medium">{item.medicine_name}</span>
                  <span className="text-gray-400 ml-2">× {item.quantity}</span>
                </div>
                <span className="font-semibold text-gray-900">{fmtCurrency(item.line_total)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmtCurrency(bill.subtotal)}</span></div>
            {bill.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{fmtCurrency(bill.discount_amount)}</span></div>
            )}
            {bill.gst_amount > 0 && <div className="flex justify-between text-gray-500"><span>GST</span><span>{fmtCurrency(bill.gst_amount)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 text-lg mt-2 pt-3 border-t border-gray-200">
              <span>Total</span><span>{fmtCurrency(bill.total_amount)}</span>
            </div>
          </div>

          {bill.payment_status !== 'paid' && (
            <div className="flex gap-2 mt-6">
              {(['cash', 'upi', 'card'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => payMutation.mutate({ id: bill.id, method })}
                  disabled={payMutation.isPending}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 capitalize transition-all disabled:opacity-50 hover:shadow-sm"
                >
                  {METHOD_LABEL[method]?.icon} {method.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Print & WhatsApp */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => printThermalReceipt(bill!, shopName)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all"
            >
              🖨️ Print Receipt
            </button>
            <button
              onClick={() => sendWhatsApp(bill!, shopName)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 rounded-xl py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 transition-all"
            >
              💬 WhatsApp
            </button>
          </div>

          <button onClick={reset} className="w-full mt-3 text-sm text-gray-400 hover:text-violet-600 py-2 transition-colors font-medium">
            + Create New Bill
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bill Detail Modal ────────────────────────────────────────────────────────

function BillDetailModal({ bill, onClose, onPay }: {
  bill: BillData;
  onClose: () => void;
  onPay: (id: string, method: string) => void;
}) {
  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: () => shopApi.getMyShop().then(r => r.data.data), staleTime: 5 * 60 * 1000 });
  const shopName = (shopData as any)?.shop_name ?? 'Medical Shop';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-auto animate-in">
        {/* Header with gradient */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0f0f1a] to-[#1a1a2e] px-6 py-5 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">{bill.bill_number}</h3>
              <p className="text-violet-300/70 text-sm">{fmtDateTime(bill.created_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={bill.payment_status} />
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Patient */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">{(bill.customer_name ?? bill.patient?.full_name ?? 'W').charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{bill.customer_name ?? bill.patient?.full_name ?? 'Walk-in Customer'}</p>
              <p className="text-gray-400 text-xs flex items-center gap-1">
                <span>{METHOD_LABEL[bill.payment_method]?.icon ?? ''}</span>
                <span>{METHOD_LABEL[bill.payment_method]?.label ?? bill.payment_method}</span>
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Items ({bill.items.length})</p>
            <div className="bg-gray-50/80 rounded-xl p-4 space-y-0">
              {bill.items.map((item, i) => (
                <div key={item.id} className={`flex items-center justify-between py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div>
                    <span className="text-gray-900 font-medium">{item.medicine_name}</span>
                    <span className="text-gray-400 ml-2 text-xs">× {item.quantity} @ {fmtCurrency(item.mrp)}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{fmtCurrency(item.line_total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmtCurrency(bill.subtotal)}</span></div>
            {bill.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{fmtCurrency(bill.discount_amount)}</span></div>
            )}
            {bill.gst_amount > 0 && <div className="flex justify-between text-gray-500"><span>GST</span><span>{fmtCurrency(bill.gst_amount)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 text-xl mt-3 pt-4 border-t-2 border-gray-100">
              <span>Total</span><span className="text-violet-700">{fmtCurrency(bill.total_amount)}</span>
            </div>
          </div>

          {/* Pay */}
          {bill.payment_status !== 'paid' && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Record Payment</p>
              <div className="flex gap-2">
                {(['cash', 'upi', 'card'] as const).map((m) => (
                  <button key={m} onClick={() => onPay(bill.id, m)}
                    className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all hover:shadow-sm">
                    {METHOD_LABEL[m].icon} {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Print & WhatsApp */}
          <div className="flex gap-2">
            <button
              onClick={() => printThermalReceipt(bill, shopName)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all"
            >
              🖨️ Print Receipt
            </button>
            <button
              onClick={() => sendWhatsApp(bill, shopName)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 rounded-xl py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 transition-all"
            >
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bill History Tab ─────────────────────────────────────────────────────────

function BillHistoryTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBill, setSelectedBill] = useState<BillData | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const filters = {
    page, limit: 12,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(status && { status }),
    ...(method && { payment_method: method }),
    ...(fromDate && { from_date: fromDate }),
    ...(toDate && { to_date: toDate }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['bill-history', filters],
    queryFn: () => billApi.list(filters).then(r => r.data.data),
  });

  const { data: stats } = useQuery<BillStats>({
    queryKey: ['bill-stats', fromDate, toDate],
    queryFn: () => billApi.stats({ ...(fromDate && { from_date: fromDate }), ...(toDate && { to_date: toDate }) }).then(r => r.data.data),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => billApi.markPaid(id, method),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
      setSelectedBill(null);
    },
  });

  const bills: BillData[] = data?.bills ?? [];
  const pagination: Pagination | null = data?.pagination ?? null;

  const clearFilters = useCallback(() => {
    setSearch(''); setStatus(''); setMethod(''); setFromDate(''); setToDate(''); setPage(1);
  }, []);

  const hasFilters = search || status || method || fromDate || toDate;

  return (
    <>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Total Revenue', value: fmtCurrency(stats.total_revenue), sub: `${stats.total_bills} bills`, gradient: 'from-emerald-500 to-teal-600', iconBg: 'bg-emerald-400/20',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            },
            {
              label: 'Bills Generated', value: String(stats.total_bills), sub: `₹${(stats.total_gst).toFixed(0)} GST`, gradient: 'from-violet-500 to-indigo-600', iconBg: 'bg-violet-400/20',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2 6.75h6m-6 3h3.75m-3.75 3h6M6 18.75V15m0 0V6.75M6 15H3.375a1.125 1.125 0 01-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125H6z" /></svg>
            },
            {
              label: 'Collected', value: fmtCurrency(stats.paid.amount), sub: `${stats.paid.count} paid`, gradient: 'from-sky-500 to-blue-600', iconBg: 'bg-sky-400/20',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            },
            {
              label: 'Outstanding', value: fmtCurrency(stats.pending.amount + stats.partial.amount), sub: `${stats.pending.count + stats.partial.count} due`, gradient: 'from-amber-500 to-orange-600', iconBg: 'bg-amber-400/20',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            },
          ].map(({ label, value, sub, gradient, icon, iconBg }) => (
            <div key={label} className="group relative bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 overflow-hidden">
              {/* Gradient accent top */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-80`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1.5 tracking-tight">{value}</p>
                  {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
                </div>
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-gray-600 group-hover:scale-110 transition-transform duration-300`}>
                  {icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input
              type="text" placeholder="Search by bill number or patient..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all placeholder:text-gray-300"
            />
          </div>

          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600 outline-none focus:border-violet-400 bg-white min-w-[120px] cursor-pointer">
            <option value="">All Status</option>
            <option value="paid">✅ Paid</option>
            <option value="pending">⏳ Pending</option>
            <option value="partial">⚠️ Partial</option>
          </select>

          <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600 outline-none focus:border-violet-400 bg-white min-w-[120px] cursor-pointer">
            <option value="">All Methods</option>
            <option value="cash">💵 Cash</option>
            <option value="upi">📱 UPI</option>
            <option value="card">💳 Card</option>
            <option value="credit">📝 Credit</option>
          </select>

          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-200">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="bg-transparent text-sm text-gray-600 outline-none w-[120px]" />
            <span className="text-gray-300">–</span>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="bg-transparent text-sm text-gray-600 outline-none w-[120px]" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-600 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bill Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              {['Bill No.', 'Patient', 'Date', 'Items', 'Amount', 'Status', 'Method'].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-20 text-gray-400">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading bills…</span>
                </div>
              </td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  </div>
                  <p className="text-gray-400 font-medium text-sm">No bills found</p>
                  <p className="text-gray-300 text-xs">Try adjusting your search or filters</p>
                </div>
              </td></tr>
            ) : bills.map((bill) => (
              <tr
                key={bill.id}
                onClick={() => setSelectedBill(bill)}
                className="cursor-pointer hover:bg-violet-50/30 transition-colors duration-150 group"
              >
                <td className="px-5 py-4">
                  <span className="font-semibold text-violet-700 group-hover:text-violet-800 text-[13px]">{bill.bill_number}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shrink-0 group-hover:from-violet-100 group-hover:to-violet-200 transition-all duration-300">
                      <span className="text-gray-600 font-bold text-[11px] group-hover:text-violet-700">{(bill.patient?.full_name ?? 'P').charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-gray-900 font-medium truncate max-w-[140px]">{bill.patient?.full_name ?? 'Patient'}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-[13px]">{fmtDate(bill.created_at)}</td>
                <td className="px-5 py-4">
                  <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md text-[11px] font-medium">{bill.items.length}</span>
                </td>
                <td className="px-5 py-4 font-bold text-gray-900">{fmtCurrency(bill.total_amount)}</td>
                <td className="px-5 py-4">
                  <StatusBadge status={bill.payment_status} />
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-medium ${METHOD_LABEL[bill.payment_method]?.color ?? 'text-gray-500'}`}>
                    {METHOD_LABEL[bill.payment_method]?.icon ?? ''} {METHOD_LABEL[bill.payment_method]?.label ?? bill.payment_method}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/30">
            <p className="text-xs text-gray-400">
              {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white disabled:opacity-30 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              </button>
              {Array.from({ length: Math.min(pagination.total_pages, 5) }, (_, i) => {
                let pageNum: number;
                if (pagination.total_pages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= pagination.total_pages - 2) pageNum = pagination.total_pages - 4 + i;
                else pageNum = page - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${page === pageNum ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page >= pagination.total_pages}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white disabled:opacity-30 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedBill && (
        <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} onPay={(id, m) => payMutation.mutate({ id, method: m })} />
      )}
    </>
  );
}

// ── Walk-in Sale Tab ─────────────────────────────────────────────────────────

interface WalkInItem { medicine_name: string; unit: string; mrp: string; quantity: string; gst_rate: string; }
const EMPTY_ITEM: WalkInItem = { medicine_name: '', unit: 'strip', mrp: '', quantity: '1', gst_rate: '12' };

function WalkInSaleTab() {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit' | 'pending'>('cash');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState<WalkInItem[]>([{ ...EMPTY_ITEM }]);
  const [createdBill, setCreatedBill] = useState<BillData | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, { id: string; medicine_name: string; unit?: string; mrp: number; gst_rate: number }[]>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [customerSearchResults, setCustomerSearchResults] = useState<{ customer_name: string | null; customer_phone: string }[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const medicineInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const unitSelectRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mrpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addItemBtnRef = useRef<HTMLButtonElement | null>(null);
  const [customerHighlight, setCustomerHighlight] = useState(-1);
  const [suggHighlights, setSuggHighlights] = useState<Record<number, number>>({});
  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: () => shopApi.getMyShop().then(r => r.data.data), staleTime: 5 * 60 * 1000 });
  const shopName = (shopData as any)?.shop_name ?? 'Medical Shop';
  const isTaxInvoice = (shopData as any)?.gst_type === 'regular';

  const createMutation = useMutation({
    mutationFn: (payload: object) => billApi.createManual(payload),
    onSuccess: (res) => {
      setCreatedBill(res.data.data);
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => billApi.markPaid(id, method),
    onSuccess: (res) => {
      setCreatedBill(res.data.data);
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
    },
  });

  const reset = () => {
    setCreatedBill(null); setCustomerName(''); setCustomerPhone('');
    setPaymentMethod('cash'); setDiscount(''); setItems([{ ...EMPTY_ITEM }]);
    setCustomerSearchResults([]); setShowCustomerDropdown(false); setCustomerHighlight(-1); setSuggHighlights({});
    createMutation.reset();
  };

  const updateItem = (idx: number, field: keyof WalkInItem, value: string) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'medicine_name') {
      if (searchTimers.current[idx]) clearTimeout(searchTimers.current[idx]);
      if (value.length < 2) {
        setSuggestions((prev) => ({ ...prev, [idx]: [] }));
        setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
        return;
      }
      searchTimers.current[idx] = setTimeout(async () => {
        try {
          const res = await inventoryApi.list({ q: value, limit: 8 });
          const invItems = res.data.data ?? [];
          if (invItems.length > 0) {
            setSuggestions((prev) => ({ ...prev, [idx]: invItems }));
          } else {
            const medRes = await medicinesApi.catalog({ q: value });
            const catalogItems = (medRes.data.data ?? []).slice(0, 8).map((m: any) => ({
              id: m.id,
              medicine_name: m.name,
              unit: 'strip',
              mrp: 0,
              gst_rate: m.gst_rate ?? 12,
            }));
            setSuggestions((prev) => ({ ...prev, [idx]: catalogItems }));
          }
          setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
        } catch { /* ignore search errors */ }
      }, 250);
    }
  };

  const selectSuggestion = (idx: number, inv: { medicine_name: string; unit?: string; mrp: number; gst_rate: number }) => {
    setItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, medicine_name: inv.medicine_name, unit: inv.unit ?? it.unit, mrp: String(inv.mrp), gst_rate: String(inv.gst_rate ?? 12) } : it
    ));
    setSuggestions((prev) => ({ ...prev, [idx]: [] }));
    setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
    setTimeout(() => unitSelectRefs.current[idx]?.focus(), 0);
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // Live totals
  const calcSubtotal = items.reduce((s, it) => {
    const qty = Number(it.quantity) || 0;
    const mrp = Number(it.mrp) || 0;
    return s + qty * mrp;
  }, 0);
  const calcDiscount = Number(discount) || 0;
  const calcGst = isTaxInvoice ? items.reduce((s, it) => {
    const qty = Number(it.quantity) || 0;
    const mrp = Number(it.mrp) || 0;
    const gst = Number(it.gst_rate) || 0;
    return s + (qty * mrp * gst) / 100;
  }, 0) : 0;
  const calcTotal = calcSubtotal - calcDiscount + calcGst;

  const handleCreate = () => {
    const validItems = items.filter((it) => it.medicine_name && Number(it.mrp) > 0 && Number(it.quantity) > 0);
    if (validItems.length === 0) return;
    createMutation.mutate({
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      payment_method: paymentMethod,
      discount_amount: calcDiscount,
      items: validItems.map((it) => ({
        medicine_name: it.medicine_name,
        unit: it.unit || 'strip',
        mrp: Number(it.mrp),
        quantity: Number(it.quantity),
        gst_rate: Number(it.gst_rate) || 12,
      })),
    });
  };

  const METHODS: { id: 'cash' | 'upi' | 'card' | 'credit' | 'pending'; label: string; icon: string }[] = [
    { id: 'cash', label: 'Cash', icon: '💵' },
    { id: 'upi', label: 'UPI', icon: '📱' },
    { id: 'card', label: 'Card', icon: '💳' },
    { id: 'credit', label: 'Credit', icon: '📝' },
    { id: 'pending', label: 'Pay Later', icon: '⏳' },
  ];

  if (createdBill) {
    const displayName = createdBill.customer_name ?? createdBill.patient?.full_name ?? 'Walk-in Customer';
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          {/* Receipt header */}
          <div className="text-center mb-6 pb-6 border-b border-dashed border-gray-200">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="font-bold text-gray-900 text-xl">{createdBill.bill_number}</h2>
            <p className="text-gray-500 text-sm mt-1">{displayName}</p>
            {createdBill.customer_phone && <p className="text-gray-400 text-xs">{createdBill.customer_phone}</p>}
            <div className="mt-2"><StatusBadge status={createdBill.payment_status} /></div>
          </div>

          {/* Items */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-0">
            {createdBill.items.map((item, i) => (
              <div key={item.id} className={`flex justify-between py-2 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div>
                  <span className="text-gray-900 font-medium">{item.medicine_name}</span>
                  <span className="text-gray-400 text-xs ml-2">× {item.quantity} @ ₹{item.mrp}</span>
                </div>
                <span className="font-semibold text-gray-900">{fmtCurrency(item.line_total)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-sm mb-5">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmtCurrency(createdBill.subtotal)}</span></div>
            {createdBill.discount_amount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{fmtCurrency(createdBill.discount_amount)}</span></div>}
            {createdBill.gst_amount > 0 && <div className="flex justify-between text-gray-500"><span>GST</span><span>{fmtCurrency(createdBill.gst_amount)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 text-xl pt-3 border-t border-gray-200"><span>Total</span><span className="text-violet-700">{fmtCurrency(createdBill.total_amount)}</span></div>
          </div>

          {/* Pay now if pending */}
          {createdBill.payment_status === 'pending' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Record Payment</p>
              <div className="flex gap-2">
                {(['cash', 'upi', 'card'] as const).map((m) => (
                  <button key={m} onClick={() => payMutation.mutate({ id: createdBill.id, method: m })}
                    disabled={payMutation.isPending}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all">
                    {METHOD_LABEL[m].icon} {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Print & WhatsApp */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => printThermalReceipt(createdBill, shopName)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all"
            >
              🖨️ Print Receipt
            </button>
            <button
              onClick={() => sendWhatsApp(createdBill, shopName)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 rounded-xl py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 transition-all"
            >
              💬 WhatsApp
            </button>
          </div>

          <button onClick={reset} className="w-full mt-2 text-sm text-gray-400 hover:text-violet-600 py-2 transition-colors font-medium">
            + New Walk-in Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 space-y-6">
        {/* Customer Info */}
        <div>
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Customer Details <span className="text-gray-400 font-normal">(optional)</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone <span className="text-gray-300 font-normal">(search by number)</span></label>
              <input
                type="tel"
                placeholder="9XXXXXXXXX"
                value={customerPhone}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerPhone(val);
                  if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
                  if (val.length >= 3) {
                    customerSearchTimer.current = setTimeout(async () => {
                      try {
                        const res = await billApi.searchCustomers(val);
                        setCustomerSearchResults(res.data.data);
                        setCustomerHighlight(-1);
                        setShowCustomerDropdown(true);
                      } catch { /* ignore */ }
                    }, 250);
                  } else {
                    setCustomerSearchResults([]);
                    setShowCustomerDropdown(false);
                  }
                }}
                onKeyDown={(e) => {
                  const len = customerSearchResults.length;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCustomerHighlight((h) => Math.min(h + 1, len - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setCustomerHighlight((h) => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter' && customerHighlight >= 0 && customerSearchResults[customerHighlight]) {
                    e.preventDefault();
                    const c = customerSearchResults[customerHighlight];
                    setCustomerPhone(c.customer_phone); setCustomerName(c.customer_name ?? '');
                    setShowCustomerDropdown(false); setCustomerHighlight(-1);
                    setTimeout(() => medicineInputRefs.current[0]?.focus(), 0);
                  } else if (e.key === 'Escape') {
                    setCustomerName(''); setCustomerPhone('');
                    setCustomerSearchResults([]); setShowCustomerDropdown(false); setCustomerHighlight(-1);
                  }
                }}
                onBlur={() => setTimeout(() => { setShowCustomerDropdown(false); setCustomerHighlight(-1); }, 150)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
              {showCustomerDropdown && customerSearchResults.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {customerSearchResults.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => {
                        setCustomerPhone(c.customer_phone);
                        setCustomerName(c.customer_name ?? '');
                        setShowCustomerDropdown(false); setCustomerHighlight(-1);
                        setTimeout(() => medicineInputRefs.current[0]?.focus(), 0);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${i === customerHighlight ? 'bg-violet-100' : 'hover:bg-violet-50'}`}
                    >
                      <span className="text-gray-800">{c.customer_name ?? 'Unknown'}</span>
                      <span className="text-gray-400 text-xs">{c.customer_phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                placeholder="Walk-in customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setCustomerName(''); setCustomerPhone('');
                    setCustomerSearchResults([]); setShowCustomerDropdown(false);
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Medicines / Items
          </h3>
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid gap-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1" style={{gridTemplateColumns: isTaxInvoice ? '3fr 1.2fr 1.2fr 1.5fr 1.5fr 0.7fr' : '3fr 1.2fr 1.2fr 1.5fr 0.7fr'}}>
              <div>Medicine</div>
              <div>Unit</div>
              <div>Qty</div>
              <div>MRP (₹)</div>
              {isTaxInvoice && <div>GST %</div>}
              <div />
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="relative">
                <div className="grid gap-2 items-center" style={{gridTemplateColumns: isTaxInvoice ? '3fr 1.2fr 1.2fr 1.5fr 1.5fr 0.7fr' : '3fr 1.2fr 1.2fr 1.5fr 0.7fr'}}>
                  <div className="relative">
                    <input
                      ref={(el) => { medicineInputRefs.current[idx] = el; }}
                      type="text"
                      placeholder="Medicine name"
                      value={item.medicine_name}
                      onChange={(e) => updateItem(idx, 'medicine_name', e.target.value)}
                      onKeyDown={(e) => {
                        const suggs = suggestions[idx] ?? [];
                        const h = suggHighlights[idx] ?? -1;
                        if (e.key === 'ArrowDown') { e.preventDefault(); setSuggHighlights((p) => ({ ...p, [idx]: Math.min(h + 1, suggs.length - 1) })); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggHighlights((p) => ({ ...p, [idx]: Math.max(h - 1, 0) })); }
                        else if (e.key === 'Enter' && h >= 0 && suggs[h]) { e.preventDefault(); selectSuggestion(idx, suggs[h]); }
                        else if (e.key === 'Enter' && (h < 0 || suggs.length === 0)) { e.preventDefault(); setSuggestions((p) => ({ ...p, [idx]: [] })); unitSelectRefs.current[idx]?.focus(); }
                        else if (e.key === 'Escape') { setSuggestions((p) => ({ ...p, [idx]: [] })); setSuggHighlights((p) => ({ ...p, [idx]: -1 })); }
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                    {/* Autocomplete dropdown */}
                    {suggestions[idx] && suggestions[idx].length > 0 && (
                      <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {suggestions[idx].map((s, si) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectSuggestion(idx, s)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${si === (suggHighlights[idx] ?? -1) ? 'bg-violet-100' : 'hover:bg-violet-50'}`}
                          >
                            <span className="text-gray-800">{s.medicine_name}</span>
                            <span className="text-violet-600 font-medium text-xs">₹{s.mrp}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <select ref={(el) => { unitSelectRefs.current[idx] = el; }} value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[idx]?.focus(); } }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white">
                      {Array.from(new Set(['strip', 'tablet', 'capsule', 'bottle', 'syrup', 'injection', 'vial', 'tube', 'cream', 'ointment', 'sachet', 'packet', 'piece', 'box', item.unit].filter(Boolean))).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <input
                      ref={(el) => { qtyRefs.current[idx] = el; }}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); mrpRefs.current[idx]?.focus(); } }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 text-center"
                    />
                  </div>
                  <div>
                    <input
                      ref={(el) => { mrpRefs.current[idx] = el; }}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.mrp}
                      onChange={(e) => updateItem(idx, 'mrp', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItemBtnRef.current?.focus(); } }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-9 text-sm text-gray-900 outline-none focus:border-violet-500"
                    />
                  </div>
                  {isTaxInvoice && (
                  <div>
                    <select
                      value={item.gst_rate}
                      onChange={(e) => updateItem(idx, 'gst_rate', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 bg-white"
                    >
                      {['0', '5', '12', '18', '28'].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  )}
                  <div className="flex justify-center">
                    <button
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                {/* Line total hint */}
                {Number(item.mrp) > 0 && Number(item.quantity) > 0 && (
                  <div className="text-right text-xs text-violet-600 font-medium mt-0.5 pr-7">
                    = {fmtCurrency(Number(item.mrp) * Number(item.quantity))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            ref={addItemBtnRef}
            onClick={() => { addItem(); setTimeout(() => medicineInputRefs.current[items.length]?.focus(), 0); }}
            className="mt-3 flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Item
          </button>
        </div>

        {/* Discount & Payment */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Discount (₹) <span className="text-gray-400 font-normal">(optional)</span>
            </h3>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
              Payment Method
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    paymentMethod === m.id
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'
                  }`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live summary */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-5 border border-violet-100">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Bill Summary</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmtCurrency(calcSubtotal)}</span></div>
            {calcDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{fmtCurrency(calcDiscount)}</span></div>}
            {calcGst > 0 && <div className="flex justify-between text-gray-600"><span>GST</span><span>{fmtCurrency(calcGst)}</span></div>}
            <div className="flex justify-between font-bold text-violet-700 text-xl pt-2 border-t border-violet-200 mt-2">
              <span>Total</span><span>{fmtCurrency(calcTotal)}</span>
            </div>
          </div>
        </div>

        {createMutation.isError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {(createMutation.error as any)?.response?.data?.error?.message ?? 'Failed to create bill. Please try again.'}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending || calcSubtotal <= 0}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
        >
          {createMutation.isPending ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating Bill…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            Generate Bill</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'walkin' | 'new' | 'history';

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('walkin');

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Billing</h1>
          <p className="text-gray-400 text-sm mt-1">Walk-in sales, prescription bills and history</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 w-fit mb-7 border border-gray-200/50">
        {([
          {
            id: 'walkin' as Tab, label: 'Walk-in Sale',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
          },
          {
            id: 'history' as Tab, label: 'Bill History',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
          },
          {
            id: 'new' as Tab, label: 'Prescription Bill',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
          },
        ]).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${tab === id
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200/80'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === 'walkin' && <WalkInSaleTab />}
      {tab === 'new' && <NewBillTab />}
      {tab === 'history' && <BillHistoryTab />}
    </div>
  );
}
