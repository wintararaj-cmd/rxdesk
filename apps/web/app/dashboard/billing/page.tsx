'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billApi, prescriptionApi, inventoryApi, shopApi, medicinesApi } from '../../../lib/apiClient';
import { socket, connectSocket, disconnectSocket } from '../../../lib/socket';
import { useAuthStore } from '../../../store/authStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface BillItem {
  id: string;
  medicine_name: string;
  hsn_code?: string;
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  mrp: number;
  discount_type: string;
  discount_value: number;
  line_total: number;
  gst_rate?: number;
}
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
  customer_gstin?: string | null;
  billing_address?: string | null;
  billing_state?: string | null;
  ewb_status?: 'generated' | 'pending' | 'not_required';
  ewb_number?: string | null;
  ewb_valid_till?: string | null;
  ewb_transport_mode?: string | null;
  ewb_vehicle_number?: string | null;
  ewb_transporter_name?: string | null;
  ewb_transport_doc_no?: string | null;
  ewb_transport_date?: string | null;
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

const STATE_MAP: Record<string, string> = {
  'wb': 'west bengal', 'mh': 'maharashtra', 'ka': 'karnataka', 'tn': 'tamil nadu',
  'dl': 'delhi', 'up': 'uttar pradesh', 'ap': 'andhra pradesh', 'ts': 'telangana',
  'tg': 'telangana', 'gj': 'gujarat', 'rj': 'rajasthan', 'mp': 'madhya pradesh',
  'br': 'bihar', 'hr': 'haryana', 'pb': 'punjab', 'jk': 'jammu and kashmir',
  'kl': 'kerala', 'od': 'odisha', 'as': 'assam', 'ct': 'chhattisgarh',
  'jh': 'jharkhand', 'uk': 'uttarakhand', 'hp': 'himachal pradesh', 'ga': 'goa',
  'tr': 'tripura', 'ml': 'meghalaya', 'mn': 'manipur', 'nl': 'nagaland',
  'ar': 'arunachal pradesh', 'sk': 'sikkim', 'mz': 'mizoram', 'py': 'puducherry',
  'an': 'andaman and nicobar islands', 'ch': 'chandigarh',
  'dn': 'dadra and nagar haveli and daman and diu', 'ld': 'lakshadweep'
};

function normalizeState(s?: string | null): string {
  if (!s) return '';
  const cleaned = s.trim().toLowerCase();
  return STATE_MAP[cleaned] || cleaned;
}

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// ── Thermal Print & WhatsApp ─────────────────────────────────────────────────

function printInvoice(bill: BillData, shopData: any) {
  const isA4 = shopData?.printer_type === 'a4';
  if (isA4) return printA4Invoice(bill, shopData);
  return printThermalReceipt(bill, shopData);
}

function printA4Invoice(bill: BillData, shopData: any) {
  const shopName = shopData?.shop_name ?? 'Medical Shop';
  const shopAddress = [shopData?.address_line, shopData?.city, shopData?.state, shopData?.pin_code].filter(Boolean).join(', ');
  const shopPhone = shopData?.contact_phone ?? '';
  const shopGst = shopData?.gst_number ?? '';
  const drugLicense = shopData?.drug_license_no ?? '';

  const displayName = bill.customer_name ?? bill.patient?.full_name ?? 'Walk-in Customer';
  const displayPhone = bill.customer_phone ?? bill.patient?.phone ?? '';
  const customerGstin = bill.customer_gstin ?? '';
  const customerAddress = [bill.billing_address, bill.billing_state].filter(Boolean).join(', ');

  const shopStateNormalized = normalizeState(shopData?.state);
  const billingStateNormalized = normalizeState(bill.billing_state);
  const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;

  const date = new Date(bill.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const isTax = Number(bill.gst_amount) > 0;
  const invoiceLabel = isTax ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  const cur = (v: number | string) => `Rs.${Number(v).toFixed(2)}`;

  const showHsn = shopData?.show_hsn_code !== false;
  const showBatch = shopData?.show_batch_no !== false;

  const itemRows = (bill.items || []).map((it, idx) =>
    `<tr>
      <td style="padding:8px 6px;text-align:center;">${idx + 1}</td>
      <td style="padding:8px 6px;">
        <div style="font-weight:bold;">${it.medicine_name}</div>
        <div style="font-size:10px;color:#555;margin-top:2px;">
          ${showBatch && it.batch_number ? `Batch: ${it.batch_number} &middot; ` : ''}
          ${it.expiry_date ? `Exp: ${new Date(it.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}
        </div>
      </td>
      ${showHsn ? `<td style="padding:8px 6px;text-align:center;">${it.hsn_code || '-'}</td>` : ''}
      <td style="padding:8px 6px;text-align:center;">${it.quantity}</td>
      <td style="padding:8px 6px;text-align:right;">${cur(it.mrp)}</td>
      <td style="padding:8px 6px;text-align:right;">${cur(Number(it.mrp) * it.quantity)}</td>
    </tr>`
  ).join('');

  const hsnColHtml = showHsn ? `<th style="text-align:center;padding:10px 8px;border-bottom:2px solid #e5e7eb;">HSN Code</th>` : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${bill.bill_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 15mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #111827; }
  table { width: 100%; border-collapse: collapse; margin-top: 25px; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #4b5563; }
  td { border-bottom: 1px solid #f3f4f6; }
</style></head>
<body>
  <div style="text-align:center;border-bottom:1px solid #d1d5db;padding-bottom:15px;margin-bottom:25px">
    <h1 style="font-size:24px;margin-bottom:4px;font-weight:900;">${shopName}</h1>
    ${shopAddress ? `<p style="color:#4b5563;font-size:13px">${shopAddress}</p>` : ''}
    <div style="font-size:12px;color:#4b5563;margin-top:8px;display:flex;justify-content:center;gap:20px">
      ${shopPhone ? `<span><b>Phone:</b> ${shopPhone}</span>` : ''}
      ${shopGst && shopData?.gst_type === 'regular' ? `<span><b>GSTIN:</b> ${shopGst}</span>` : ''}
      ${drugLicense ? `<span><b>DL No:</b> ${drugLicense}</span>` : ''}
    </div>
  </div>

  <div style="text-align:center;font-weight:900;font-size:16px;letter-spacing:1px;margin-bottom:25px;">
    ${invoiceLabel}
  </div>

  <div style="display:flex;justify-content:space-between;border:1px solid #e5e7eb;padding:20px;border-radius:8px;background:#f9fafb;">
    <div>
      <p style="margin-bottom:4px;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:bold;">Billed To</p>
      <div style="font-size:12px;color:#555;">
        <div><b>Bill To:</b> ${displayName}</div>
        ${displayPhone ? `<div>Ph: ${displayPhone}</div>` : ''}
        ${customerGstin ? `<div>GSTIN: <b>${customerGstin}</b></div>` : ''}
        ${customerGstin && bill.billing_state ? `<div>Place of Supply: <b>${bill.billing_state}</b></div>` : ''}
        ${customerAddress ? `<div>Add: ${customerAddress}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <p style="margin-bottom:4px"><b>Invoice No:</b> ${bill.bill_number}</p>
      <p style="margin-bottom:4px"><b>Date:</b> ${date}</p>
      <p><b>Payment:</b> ${(bill.payment_method ?? '').toUpperCase()} <span style="color:#9ca3af;margin:0 4px;">|</span> ${(bill.payment_status ?? '').toUpperCase()}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="padding:10px 8px;border-bottom:2px solid #e5e7eb;width:5%;text-align:center;">#</th>
        <th style="text-align:left;padding:10px 8px;border-bottom:2px solid #e5e7eb;width:${showHsn ? '38%' : '50%'}">Description</th>
        ${hsnColHtml}
        <th style="text-align:center;padding:10px 8px;border-bottom:2px solid #e5e7eb;width:10%">Qty</th>
        <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #e5e7eb;width:15%">Rate</th>
        <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #e5e7eb;width:20%">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-top:30px">
    <div style="width:320px;background:#f8fafc;padding:20px;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;color:#475569;">
        <span>Subtotal</span><span style="font-weight:600;">${cur(bill.subtotal)}</span>
      </div>
      ${bill.discount_amount > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;color:#059669;">
        <span>Discount</span><span style="font-weight:600;">-${cur(bill.discount_amount)}</span>
      </div>` : ''}
      ${isTax ? `
      ${isInterState ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;color:#475569;">
        <span>IGST</span><span style="font-weight:600;">${cur(bill.gst_amount)}</span>
      </div>` : `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;color:#475569;">
        <span>CGST</span><span style="font-weight:600;">${cur(bill.gst_amount / 2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;color:#475569;">
        <span>SGST</span><span style="font-weight:600;">${cur(bill.gst_amount / 2)}</span>
      </div>`}
      ` : ''}
      <div style="display:flex;justify-content:space-between;padding-top:12px;margin-top:6px;font-size:18px;font-weight:900;">
        <span>Total Amount</span><span>${cur(Math.round(bill.total_amount))}</span>
      </div>
    </div>
  </div>

  <div style="margin-top:60px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">
    <p>Thank you for your purchase!</p>
    ${shopData?.gst_type === 'composite' ? `<p style="margin-top:4px;font-weight:bold;color:#374151;">Composition taxable person, not eligible to collect tax on supplies</p>` : ''}
    <p style="margin-top:4px;">Powered by <b>RxDesk</b></p>
  </div>
</body></html>`;


  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); setTimeout(() => w.close(), 600); }, 300);
}

function printThermalReceipt(bill: BillData, shopData: any) {
  const shopName = shopData?.shop_name ?? 'Medical Shop';
  const showHsn = shopData?.show_hsn_code !== false;
  const showBatch = shopData?.show_batch_no !== false;

  const displayName = bill.customer_name ?? bill.patient?.full_name ?? 'Walk-in Customer';
  const customerGstin = bill.customer_gstin ?? '';

  const shopStateNormalized = normalizeState(shopData?.state);
  const billingStateNormalized = normalizeState(bill.billing_state);
  const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;

  const date = new Date(bill.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const isTax = Number(bill.gst_amount) > 0;
  const invoiceLabel = isTax ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  const cur = (v: number | string) => `Rs.${Number(v).toFixed(2)}`;
  const itemRows = bill.items.map(it =>
    `<tr>
      <td style="padding:2px 0;word-break:break-word">
        ${it.medicine_name}
        ${showBatch && it.batch_number ? `<div style="font-size:8px;color:#666;margin-top:1px">Batch: ${it.batch_number}</div>` : ''}
        ${showHsn && it.hsn_code ? `<div style="font-size:8px;color:#666;margin-top:1px">HSN: ${it.hsn_code}</div>` : ''}
      </td>
      <td style="text-align:center;padding:2px 4px;white-space:nowrap">${it.quantity}</td>
      <td style="text-align:right;padding:2px 0;white-space:nowrap">${cur(it.mrp)}</td>
      <td style="text-align:right;padding:2px 0;white-space:nowrap">${cur(Number(it.mrp) * it.quantity)}</td>
    </tr>`
  ).join('');
  const shopAddress = [shopData?.address_line, shopData?.city].filter(Boolean).join(', ');
  const shopPhone = shopData?.contact_phone;
  const shopGst = shopData?.gst_number;

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
${shopAddress ? `<div class="c" style="font-size:9px;margin-top:2px">${shopAddress}</div>` : ''}
${shopPhone ? `<div class="c" style="font-size:9px">Ph: ${shopPhone}</div>` : ''}
${shopGst && shopData?.gst_type === 'regular' ? `<div class="c" style="font-size:9px">GSTIN: ${shopGst}</div>` : ''}
<div class="c" style="font-size:9px;margin:2px 0">${date}</div>
<div class="div"></div>
<div class="c b" style="font-size:10px;letter-spacing:1px;margin:3px 0">${invoiceLabel}</div>
<div class="div"></div>
<div><b>Bill:</b> ${bill.bill_number}</div>
<div><b>Customer:</b> ${displayName}</div>
${bill.customer_phone ? `<div><b>Phone:</b> ${bill.customer_phone}</div>` : ''}
${customerGstin ? `<div><b>GSTIN:</b> ${customerGstin}</div>` : ''}
${customerGstin && bill.billing_state ? `<div><b>Place of Supply:</b> ${bill.billing_state}</div>` : ''}
<div class="div"></div>
<table>
  <thead><tr>
    <th style="text-align:left;width:45%">Item</th>
    <th style="text-align:center;width:10%">Qty</th>
    <th style="text-align:right;width:22%">Rate</th>
    <th style="text-align:right;width:23%">Amt</th>
  </tr></thead>
  <tbody>${(bill.items || []).map(it => `<tr><td>${it.medicine_name}</td><td class="c">${it.quantity}</td><td class="r">${cur(it.mrp)}</td><td class="r">${cur(it.line_total)}</td></tr>`).join('')}</tbody>
  <tfoot>
    <tr><td colspan="3" style="padding-top:3px">Subtotal</td><td style="text-align:right;padding-top:3px">${cur(bill.subtotal)}</td></tr>
    ${bill.discount_amount > 0 ? `<tr><td colspan="3">Discount</td><td style="text-align:right">-${cur(bill.discount_amount)}</td></tr>` : ''}
    ${isTax ? `
    ${isInterState ? `<tr><td colspan="3">IGST</td><td style="text-align:right">${cur(bill.gst_amount)}</td></tr>` : `
    <tr><td colspan="3">CGST</td><td style="text-align:right">${cur(bill.gst_amount / 2)}</td></tr>
    <tr><td colspan="3">SGST</td><td style="text-align:right">${cur(bill.gst_amount / 2)}</td></tr>`}
    ` : ''}
    <tr class="tot"><td colspan="3">TOTAL</td><td style="text-align:right">${cur(Math.round(bill.total_amount))}</td></tr>
  </tfoot>
</table>
<div class="div"></div>
<div><b>Payment:</b> ${(bill.payment_method ?? '').toUpperCase()} | <b>Status:</b> ${(bill.payment_status ?? '').toUpperCase()}</div>
<div class="div"></div>
<div class="c" style="margin-top:4px">Thank you for your purchase!</div>
${shopData?.gst_type === 'composite' ? `<div class="c b" style="margin-top:3px;font-size:8px">Composition taxable person,<br/>not eligible to collect tax on supplies</div>` : ''}
<div class="c" style="font-size:9px;margin-top:2px">Powered by RxDesk</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=440,height=680');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); setTimeout(() => w.close(), 600); }, 300);
}

function sendWhatsApp(bill: BillData, shopName = 'Medical Shop', shopData?: any) {
  const displayName = bill.customer_name ?? bill.patient?.full_name ?? 'Walk-in Customer';
  const customerGstin = bill.customer_gstin ?? '';

  const shopStateNormalized = normalizeState(shopData?.state || 'West Bengal');
  const billingStateNormalized = normalizeState(bill.billing_state);
  const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;

  const date = new Date(bill.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const cur = (v: number | string) => `Rs.${Number(v).toFixed(2)}`;
  const itemLines = (bill.items || [])
    .map(it => `  • ${it.medicine_name} x${it.quantity} = ${cur(it.line_total)}`)
    .join('\n');
  let msg = `🧾 *${shopName}*\n`;
  msg += `📋 Bill: *${bill.bill_number}*\n`;
  msg += `📅 Date: ${date}\n`;
  msg += `👤 Customer: ${displayName}\n`;
  if (customerGstin) msg += `🆔 GSTIN: ${customerGstin}\n`;
  if (customerGstin && bill.billing_state) msg += `📍 Place of Supply: ${bill.billing_state}\n`;
  if (bill.customer_phone) msg += `📞 Phone: ${bill.customer_phone}\n`;
  msg += `\n*Items:*\n${itemLines}\n\n`;
  msg += `Subtotal: ${cur(bill.subtotal)}\n`;
  if (bill.discount_amount > 0) msg += `Discount: -${cur(bill.discount_amount)}\n`;
  if (bill.gst_amount > 0) {
    if (isInterState) {
      msg += `IGST: ${cur(bill.gst_amount)}\n`;
    } else {
      msg += `CGST: ${cur(bill.gst_amount / 2)}\n`;
      msg += `SGST: ${cur(bill.gst_amount / 2)}\n`;
    }
  }
  msg += `💰 *Total: ${cur(Math.round(bill.total_amount))}*\n`;
  if (bill.ewb_status === 'generated') {
    msg += `\n🚛 *E-Way Bill Details:*\n`;
    msg += `EWB No: ${bill.ewb_number}\n`;
    if (bill.ewb_transport_mode) msg += `Mode: ${bill.ewb_transport_mode}\n`;
    if (bill.ewb_vehicle_number) msg += `Vehicle: ${bill.ewb_vehicle_number}\n`;
  }
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
  const barcodeRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if focus is in an input/textarea (unless it's deliberate, but for global scanner it's usually outside)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      
      // If interval between keys is too long, it's manual typing, reset
      if (currentTime - lastKeyTimeRef.current > 50) {
        barcodeRef.current = '';
      }

      if (e.key === 'Enter') {
        if (barcodeRef.current.length >= 8) {
          const barcode = barcodeRef.current;
          barcodeRef.current = '';
          try {
            const res = await inventoryApi.getByBarcode(barcode);
            const inv = res.data.data;
            if (inv) {
              // If we already have a bill, we could add to it, but NewBillTab initially creates one.
              // For now, let's show an alert or toast that item found.
              // In a real POS, this would append to an 'items' state.
              alert(`Scanned: ${inv.medicine_name} (Batch: ${inv.batch_number})`);
            }
          } catch {
            console.error('Barcode not found');
          }
        }
        barcodeRef.current = '';
      } else if (/^\d$/.test(e.key)) {
        barcodeRef.current += e.key;
      }

      lastKeyTimeRef.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
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

  const verifyByIdMutation = useMutation({
    mutationFn: (id: string) => prescriptionApi.getById(id),
    onSuccess: (res) => {
      const d = res.data.data;
      if (d?.id) setPrescriptionId(d.id);
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
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
              </div>
              <div>
                <h2 className="font-black text-gray-900 text-xl tracking-tight">Prescription Billing</h2>
                <p className="text-gray-400 text-sm">Convert a doctor's prescription into a bill</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Option 1: Paste QR Data</label>
                <textarea
                  className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 resize-none h-24 transition-all placeholder:text-gray-300 font-mono"
                  placeholder="Paste the hash or JSON from the patient's app..."
                  value={qrContent}
                  onChange={(e) => setQrContent(e.target.value)}
                />
                <button
                  onClick={() => verifyMutation.mutate(qrContent)}
                  disabled={!qrContent || verifyMutation.isPending}
                  className="mt-2 w-full bg-violet-50 text-violet-700 py-3 rounded-xl text-sm font-bold hover:bg-violet-100 transition-all flex items-center justify-center gap-2"
                >
                  {verifyMutation.isPending ? <div className="w-4 h-4 border-2 border-violet-400 border-t-violet-700 rounded-full animate-spin" /> : 'Verify QR Content'}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-300 font-bold tracking-widest">OR</span></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Option 2: Prescription ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 550e8400-e29b..."
                    className="flex-1 border-2 border-gray-100 rounded-xl px-4 h-12 text-sm text-gray-900 outline-none focus:border-violet-500 transition-all font-mono"
                    onKeyDown={(e) => { if (e.key === 'Enter') verifyByIdMutation.mutate((e.target as any).value); }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousSibling as HTMLInputElement);
                      if (input.value) verifyByIdMutation.mutate(input.value);
                    }}
                    disabled={verifyByIdMutation.isPending}
                    className="bg-gray-900 text-white px-5 rounded-xl text-sm font-bold hover:bg-black transition-all"
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>

            {prescriptionId && (
              <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <button
                  onClick={() => generateMutation.mutate(prescriptionId)}
                  disabled={generateMutation.isPending}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl text-base font-black shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide"
                >
                  {generateMutation.isPending ? 'Processing…' : 'Generate Full Bill Now'}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            )}

            {(verifyMutation.isError || verifyByIdMutation.isError) && (
              <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm font-bold border border-red-100 animate-shake">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                Invalid prescription data or access denied.
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
            {(bill?.items || []).map((item, i) => (
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
            {(() => {
              if (bill.gst_amount <= 0) return null;
              const shopStateNormalized = normalizeState(shopData?.state);
              const billingStateNormalized = normalizeState(bill.billing_state);
              const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;

              if (isInterState) {
                return <div className="flex justify-between text-gray-500"><span>IGST</span><span>{fmtCurrency(bill.gst_amount)}</span></div>;
              }
              return (
                <>
                  <div className="flex justify-between text-gray-500"><span>CGST</span><span>{fmtCurrency(bill.gst_amount / 2)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>SGST</span><span>{fmtCurrency(bill.gst_amount / 2)}</span></div>
                </>
              );
            })()}
            <div className="flex justify-between font-bold text-gray-900 text-lg mt-2 pt-3 border-t border-gray-200">
              <span>Total</span><span>{fmtCurrency(Math.round(bill.total_amount))}</span>
            </div>
          </div>

          {bill.payment_status !== 'paid' && (
            <div className="flex gap-2 mt-6">
              {(['cash', 'upi', 'card', 'credit'] as const).map((method) => (
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
              onClick={() => printInvoice(bill!, shopData)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all"
            >
              🖨️ Print Receipt
            </button>
            <button
              onClick={() => sendWhatsApp(bill!, shopName, shopData)}
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
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: bill.customer_name ?? '',
    customer_phone: bill.customer_phone ?? '',
    customer_gstin: bill.customer_gstin ?? '',
    billing_address: bill.billing_address ?? '',
    billing_state: bill.billing_state ?? '',
    payment_method: bill.payment_method,
    payment_status: bill.payment_status,
    discount_amount: String(bill.discount_amount || 0),
    items: (bill.items || []).map(it => ({
      ...it,
      inventory_id: (it as any).inventory_id || '',
      mrp: String(it.mrp),
      quantity: String(it.quantity),
      discount_value: String(it.discount_value || 0),
      gst_rate: String((it as any).gst_rate || 12)
    }))
  });

  const [suggestions, setSuggestions] = useState<Record<number, any[]>>({});
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const searchTimers = useRef<Record<number, any>>({});
  const customerSearchTimer = useRef<any>(null);

  const updateMutation = useMutation({
    mutationFn: (data: any) => billApi.update(bill.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
      qc.invalidateQueries({ queryKey: ['billing-today-stats'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditing(false);
      onClose();
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Update failed')
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => billApi.void(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
      qc.invalidateQueries({ queryKey: ['billing-today-stats'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    }
  });

  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: () => shopApi.getMyShop().then(r => r.data.data), staleTime: 5 * 60 * 1000 });
  const shopName = (shopData as any)?.shop_name ?? 'Medical Shop';
  const isTaxInvoice = (shopData as any)?.gst_type === 'regular';

  const onCustomerChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'customer_name' || field === 'customer_phone') {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
      if (value.length < 2) {
        setCustomerSuggestions([]);
        return;
      }
      customerSearchTimer.current = setTimeout(async () => {
        try {
          const res = await billApi.searchCustomers(value);
          setCustomerSuggestions(res.data.data || []);
        } catch { /* ignore */ }
      }, 300);
    }
  };

  const selectCustomer = (c: any) => {
    setFormData(prev => ({
      ...prev,
      customer_name: c.customer_name || prev.customer_name,
      customer_phone: c.customer_phone || prev.customer_phone,
      customer_gstin: c.customer_gstin || prev.customer_gstin,
      billing_address: c.billing_address || prev.billing_address,
      billing_state: c.billing_state || prev.billing_state
    }));
    setCustomerSuggestions([]);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        medicine_name: '', inventory_id: '', batch_number: '', expiry_date: '',
        mrp: '', quantity: '1', discount_type: 'percentage', discount_value: '0', gst_rate: '12', line_total: 0
      } as any]
    }));
  };

  const removeItem = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const updateItemField = (idx: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[idx] = { ...newItems[idx], [field]: value };
      return { ...prev, items: newItems };
    });

    if (field === 'medicine_name') {
      if (searchTimers.current[idx]) clearTimeout(searchTimers.current[idx]);
      if (value.length < 2) {
        setSuggestions(p => ({ ...p, [idx]: [] }));
        return;
      }
      searchTimers.current[idx] = setTimeout(async () => {
        try {
          const res = await inventoryApi.list({ q: value, limit: 8 });
          setSuggestions(p => ({ ...p, [idx]: res.data.data ?? [] }));
        } catch { /* ignore */ }
      }, 250);
    }
  };

  const selectSuggestion = (idx: number, inv: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[idx] = {
        ...newItems[idx],
        medicine_name: inv.medicine_name,
        inventory_id: inv.id,
        batch_number: inv.batch_number,
        expiry_date: inv.expiry_date ? inv.expiry_date.split('T')[0] : '',
        mrp: String(inv.mrp),
        gst_rate: String(inv.gst_rate || 12)
      };
      return { ...prev, items: newItems };
    });
    setSuggestions(p => ({ ...p, [idx]: [] }));
  };

  const editSubtotal = formData.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.mrp) || 0), 0);
  const editGst = isTaxInvoice ? formData.items.reduce((s, it) => {
    const sub = (Number(it.quantity) || 0) * (Number(it.mrp) || 0);
    const disc = it.discount_type === 'percentage' ? (sub * (Number(it.discount_value) || 0)) / 100 : (Number(it.quantity) || 0) * (Number(it.discount_value) || 0);
    return s + ((sub - disc) * (Number(it.gst_rate) || 0)) / 100;
  }, 0) : 0;
  const editTotal = editSubtotal - (Number(formData.discount_amount) || 0) + editGst;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />

      <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${isEditing ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] overflow-auto animate-in transition-all duration-300`}>
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

        <div className="px-6 py-6 space-y-6">
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${isEditing ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-violet-50 text-violet-600 border border-violet-100'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
              {isEditing ? 'Cancel Edit' : 'Edit Bill'}
            </button>
            <button
              onClick={() => { if(confirm('Confirm Voiding this bill? Inventory will be reversed.')) voidMutation.mutate(bill.id); }}
              disabled={voidMutation.isPending}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-all flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.34 9m-4.74 0L9.26 9m9.96-2.14c.88.14 1.53.58 1.53 1.14v0c0 .56-.65 1-1.53 1.14m-16.92 0c-.88-.14-1.53-.58-1.53-1.14v0c0-.56.65-1 1.53-1.14m1.14-2.14A1.875 1.875 0 015.25 4.5h11.5a1.875 1.875 0 011.875 1.875v14.25A1.875 1.875 0 0116.75 22.5H7.25A1.875 1.875 0 015.375 20.625V6.375z" /></svg>
              Void Bill
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="col-span-2 lg:col-span-1 relative">
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Customer Name</label>
                  <input type="text" value={formData.customer_name} onChange={e => onCustomerChange('customer_name', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
                  {customerSuggestions.length > 0 && (
                    <div className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden mt-1 max-h-48 overflow-y-auto">
                      {customerSuggestions.map((c, ci) => (
                        <button key={ci} onMouseDown={() => selectCustomer(c)} className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 border-b border-gray-50 last:border-0">
                          <p className="font-bold text-gray-900">{c.customer_name}</p>
                          <p className="text-[10px] text-gray-500">{c.customer_phone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Phone</label>
                  <input type="text" value={formData.customer_phone} onChange={e => onCustomerChange('customer_phone', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">GSTIN</label>
                  <input 
                    type="text" 
                    maxLength={15}
                    placeholder="e.g. 29AABCT1332L1ZX"
                    value={formData.customer_gstin} 
                    onChange={e => setFormData({...formData, customer_gstin: e.target.value.toUpperCase()})} 
                    className={`w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 uppercase font-mono ${
                      formData.customer_gstin && !GSTIN_REGEX.test(formData.customer_gstin)
                        ? 'border-red-400 focus:ring-red-100'
                        : formData.customer_gstin && GSTIN_REGEX.test(formData.customer_gstin)
                        ? 'border-green-400'
                        : 'border-gray-200'
                    }`}
                  />
                  {formData.customer_gstin && !GSTIN_REGEX.test(formData.customer_gstin) && (
                    <p className="text-[10px] text-red-500 mt-1">Invalid GSTIN format (13th char must be Z)</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Address</label>
                  <input type="text" value={formData.billing_address} onChange={e => setFormData({...formData, billing_address: e.target.value})} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
                </div>
                <div>
                  <select value={formData.billing_state} onChange={e => setFormData({...formData, billing_state: e.target.value})} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500">
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Payment Method</label>
                  <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value as any})} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit/Pay Later</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Status</label>
                  <select value={formData.payment_status} onChange={e => setFormData({...formData, payment_status: e.target.value as any})} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500">
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                      <th className="pb-2 w-[40%]">Medicine</th>
                      <th className="pb-2 text-center">Batch</th>
                      <th className="pb-2 text-center w-16">Qty</th>
                      <th className="pb-2 text-center w-24">MRP</th>
                      <th className="pb-2 text-center w-20">Disc</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {formData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-2 relative">
                          <input 
                            type="text" value={item.medicine_name}
                            onChange={e => updateItemField(idx, 'medicine_name', e.target.value)}
                            placeholder="Medicine Name"
                            className="w-full bg-transparent border-0 font-medium text-gray-900 focus:ring-0 p-0"
                          />
                          {suggestions[idx]?.length > 0 && (
                            <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden mt-1">
                              {suggestions[idx].map((s, si) => (
                                <button key={si} onMouseDown={() => selectSuggestion(idx, s)} className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 border-b border-gray-50 last:border-0 flex justify-between">
                                  <span>{s.medicine_name} <span className="text-[10px] text-gray-400">(Stock: {s.stock_qty})</span></span>
                                  <span className="font-bold">₹{s.mrp}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-center text-[11px] font-mono text-gray-500">
                          <input type="text" value={item.batch_number} onChange={e => updateItemField(idx, 'batch_number', e.target.value)} className="w-full bg-transparent border-0 text-center focus:ring-0 p-0" />
                        </td>
                        <td className="py-2 text-center">
                          <input type="number" value={item.quantity} onChange={e => updateItemField(idx, 'quantity', e.target.value)} className="w-full bg-transparent border-0 text-center font-bold focus:ring-0 p-0" />
                        </td>
                        <td className="py-2 text-center">
                          <input type="number" value={item.mrp} onChange={e => updateItemField(idx, 'mrp', e.target.value)} className="w-full bg-transparent border-0 text-center font-bold text-violet-600 focus:ring-0 p-0" />
                        </td>
                        <td className="py-2 text-center">
                           <input type="number" value={item.discount_value} onChange={e => updateItemField(idx, 'discount_value', e.target.value)} className="w-full bg-transparent border-0 text-center text-emerald-600 font-bold focus:ring-0 p-0" />
                        </td>
                        <td className="py-2 text-right font-black">
                          {fmtCurrency((Number(item.quantity) || 0) * (Number(item.mrp) || 0) * (1 - (item.discount_type === 'percentage' ? (Number(item.discount_value) || 0)/100 : 0)))}
                        </td>
                        <td className="py-2 text-right">
                          <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={addItem} className="mt-3 text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1.5 ml-1">+ Add New Item</button>
              </div>

              <div className="bg-violet-50 rounded-2xl p-5 border border-violet-100 flex flex-col md:flex-row gap-6 justify-between items-center">
                <div className="flex gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Items Total</p>
                    <p className="text-lg font-black text-violet-900">{fmtCurrency(editSubtotal)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1 block">Global Discount</label>
                    <input type="number" value={formData.discount_amount} onChange={e => setFormData({...formData, discount_amount: e.target.value})} className="bg-white border border-violet-200 rounded-lg px-2 py-1 w-20 text-sm font-bold text-emerald-600 outline-none" />
                  </div>
                  {isTaxInvoice && (
                    <div>
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Est. GST</p>
                      <p className="text-lg font-black text-violet-900">{fmtCurrency(editGst)}</p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Adjusted Bill Total</p>
                   <p className="text-3xl font-black text-violet-800">{fmtCurrency(Math.round(editTotal))}</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  const payload = {
                    ...formData,
                    discount_amount: Number(formData.discount_amount),
                    items: formData.items.map(it => ({
                      ...it,
                      inventory_id: (it as any).inventory_id && (it as any).inventory_id !== '' ? (it as any).inventory_id : null,
                      quantity: Number(it.quantity),
                      mrp: Number(it.mrp),
                      discount_value: Number(it.discount_value),
                      gst_rate: Number(it.gst_rate)
                    }))
                  };
                  updateMutation.mutate(payload);
                }}
                disabled={updateMutation.isPending}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-700 text-white py-4 rounded-2xl text-base font-black shadow-xl shadow-violet-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {updateMutation.isPending ? 'Saving Changes...' : 'Confirm & Update Bill'}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <span className="text-white font-bold text-lg">{(bill.customer_name ?? bill.patient?.full_name ?? 'W').charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">{bill.customer_name ?? bill.patient?.full_name ?? 'Walk-in Customer'}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-gray-400 text-xs flex items-center gap-1">
                      <span>{METHOD_LABEL[bill.payment_method]?.icon ?? ''}</span>
                      <span className="font-medium">{METHOD_LABEL[bill.payment_method]?.label ?? bill.payment_method}</span>
                    </p>
                    {(bill.customer_phone || bill.patient?.phone) && <p className="text-gray-400 text-xs text-nowrap truncate">📞 {bill.customer_phone || bill.patient?.phone}</p>}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Items ({bill.items.length})</p>
                </div>
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                  {(bill.items || []).map((item, i) => (
                    <div key={item.id} className={`flex items-start justify-between py-3 ${i > 0 ? 'border-t border-gray-200/50' : ''}`}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-900 font-bold text-sm tracking-tight">{item.medicine_name}</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-gray-400">Qty: <span className="text-gray-900 font-semibold">{item.quantity}</span></span>
                          {item.batch_number && <span className="text-gray-400">Batch: <span className="text-gray-600 font-mono">{item.batch_number}</span></span>}
                          {item.expiry_date && <span className="text-orange-500 font-medium">Exp: {fmtDate(item.expiry_date)}</span>}
                        </div>
                      </div>
                      <span className="font-bold text-gray-900 text-sm whitespace-nowrap">{fmtCurrency(item.line_total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-violet-50 rounded-2xl p-5 border border-violet-100/50 space-y-2.5">
                <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span className="font-medium">{fmtCurrency(bill.subtotal)}</span></div>
                {bill.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span className="font-medium">−{fmtCurrency(bill.discount_amount)}</span></div>
                )}
                {(() => {
                  if (bill.gst_amount <= 0) return null;
                  const shopStateNormalized = normalizeState(shopData?.state);
                  const billingStateNormalized = normalizeState(bill.billing_state);
                  const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;

                  if (isInterState) {
                    return <div className="flex justify-between text-sm text-gray-500"><span>IGST</span><span className="font-medium">{fmtCurrency(bill.gst_amount)}</span></div>;
                  }
                  return (
                    <>
                      <div className="flex justify-between text-sm text-gray-500"><span>CGST</span><span className="font-medium">{fmtCurrency(bill.gst_amount / 2)}</span></div>
                      <div className="flex justify-between text-sm text-gray-500"><span>SGST</span><span className="font-medium">{fmtCurrency(bill.gst_amount / 2)}</span></div>
                    </>
                  );
                })()}
                <div className="flex justify-between font-black text-violet-800 text-2xl pt-3 border-t border-violet-200/50 mt-1">
                  <span>Total</span><span>{fmtCurrency(Math.round(bill.total_amount))}</span>
                </div>
              </div>

              {bill.payment_status !== 'paid' && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Record Final Payment</p>
                  <div className="flex gap-2">
                    {(['cash', 'upi', 'card', 'credit'] as const).map((m) => (
                      <button key={m} onClick={() => onPay(bill.id, m)}
                        className="flex-1 border-2 border-gray-100 rounded-xl py-3 text-sm font-bold text-gray-700 hover:border-violet-600 hover:text-violet-600 hover:bg-violet-50 transition-all active:scale-95">
                        {METHOD_LABEL[m]?.icon} {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

                {bill.ewb_status === 'generated' && (
                  <div className="bg-yellow-50/50 border border-yellow-200/60 rounded-2xl p-5 text-sm text-yellow-800 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />
                    <h4 className="font-bold flex items-center gap-2 text-yellow-900">
                       <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                       E-Way Bill Details
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div><p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">EWB Number</p><p className="font-mono font-bold text-gray-900">{bill.ewb_number}</p></div>
                      <div><p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Valid Till</p><p className="font-bold text-gray-900">{bill.ewb_valid_till ? fmtDateTime(bill.ewb_valid_till) : 'N/A'}</p></div>
                      <div><p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Transport Mode</p><p className="font-bold text-gray-900">{bill.ewb_transport_mode || 'Road'}</p></div>
                      <div><p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Vehicle Number</p><p className="font-bold text-gray-900 uppercase">{bill.ewb_vehicle_number || 'N/A'}</p></div>
                      <div className="col-span-2"><p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Transporter</p><p className="font-bold text-gray-900">{bill.ewb_transporter_name || 'Self / Local'}</p></div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                <button
                  onClick={() => printInvoice(bill, shopData)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-3 text-sm font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.821l.821-.821L12 16.179l3.459-3.459.821.821L12 17.821l-5.28-5.28zM6 18h12V6H6v12z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                  Print Invoice
                </button>
                <button
                  onClick={() => sendWhatsApp(bill, shopName, shopData)}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                  WhatsApp
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
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

  const voidMutation = useMutation({
    mutationFn: (id: string) => billApi.void(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      alert('Bill voided successfully');
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Failed to void bill')
  });

  const payMutation = useMutation({
    mutationFn: ({ id, method }: { id: string, method: string }) => billApi.update(id, { payment_status: 'paid', payment_method: method }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-history'] });
      qc.invalidateQueries({ queryKey: ['bill-stats'] });
      alert('Payment recorded successfully');
      setSelectedBill(null);
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Failed to record payment')
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
            <div key={label} className="group relative bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 overflow-hidden min-h-[180px] flex flex-col justify-between">
              {/* Gradient accent top */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-80`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1.5 tracking-tight">{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-gray-600 group-hover:scale-110 transition-transform duration-300`}>
                  {icon}
                </div>
              </div>
              {sub && <p className="text-xs text-gray-400 mt-auto">{sub}</p>}
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
              {['Bill No.', 'Patient', 'Date', 'Items', 'Amount', 'Status', 'EWB Status', 'Method', 'Actions'].map(h => (
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
                <td className="px-5 py-4 font-bold text-gray-900">{fmtCurrency(Math.round(bill.total_amount))}</td>
                <td className="px-5 py-4">
                  <StatusBadge status={bill.payment_status} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {bill.ewb_status === 'generated' ? (
                    <span className="bg-green-100 text-green-700 font-bold px-2 py-1 rounded text-[10px] uppercase flex items-center justify-center w-fit gap-1 shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-green-200/50"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>Generated</span>
                  ) : bill.ewb_status === 'pending' ? (
                    <span className="bg-yellow-100 text-yellow-700 font-bold px-2 py-1 rounded text-[10px] uppercase flex items-center justify-center w-fit gap-1 shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-yellow-200/50"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>Pending</span>
                  ) : (
                    <span className="bg-gray-100 text-gray-500 font-bold px-2 py-1 rounded text-[10px] uppercase flex items-center justify-center w-fit gap-1 shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-gray-200/50"><span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Not Req.</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-medium ${METHOD_LABEL[bill.payment_method]?.color ?? 'text-gray-500'}`}>
                    {METHOD_LABEL[bill.payment_method]?.icon ?? ''} {METHOD_LABEL[bill.payment_method]?.label ?? bill.payment_method}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedBill(bill); }} className="p-1.5 hover:bg-violet-100 rounded-lg text-violet-600 transition-colors tooltip" title="Edit/View">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to VOID this bill? This cannot be undone.')) {
                          voidMutation.mutate(bill.id);
                        }
                      }}
                      className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.34 9m-4.74 0L9.26 9m9.96-2.14c.88.14 1.53.58 1.53 1.14v0c0 .56-.65 1-1.53 1.14m-16.92 0c-.88-.14-1.53-.58-1.53-1.14v0c0-.56.65-1 1.53-1.14m1.14-2.14A1.875 1.875 0 015.25 4.5h11.5a1.875 1.875 0 011.875 1.875v14.25A1.875 1.875 0 0116.75 22.5H7.25A1.875 1.875 0 015.375 20.625V6.375z" /></svg>
                    </button>
                  </div>
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

function EWayBillDashboardTab() {
  const qc = useQueryClient();
  const [selectedBill, setSelectedBill] = useState<BillData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bill-history', { ewb_status: 'generated' }],
    queryFn: () => billApi.list({ ewb_status: 'generated', limit: 50 }).then(r => r.data.data),
  });

  const bills: BillData[] = data?.bills ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">E-Way Bill Dashboard</h2>
            <p className="text-gray-400 text-sm font-medium">Track your generated transportation permits</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Permits</p>
             <p className="text-lg font-black text-gray-900">{bills.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              {['Bill No.', 'EWB Details', 'Transport', 'Status', 'Transporter', 'Amount', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-20 text-gray-400">Loading EWBs...</td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-20 text-gray-400">No generated E-Way bills found.</td></tr>
            ) : bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 font-bold text-violet-700">{bill.bill_number}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-col">
                    <span className="font-mono text-gray-900 font-bold">{bill.ewb_number}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Valid Till: {bill.ewb_valid_till ? fmtDateTime(bill.ewb_valid_till) : 'N/A'}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                   <div className="flex flex-col">
                     <span className="text-xs font-bold text-gray-800 uppercase">{bill.ewb_transport_mode || 'Road'}</span>
                     <span className="text-[10px] text-violet-600 font-medium uppercase font-mono">{bill.ewb_vehicle_number || 'N/A'}</span>
                   </div>
                </td>
                <td className="px-5 py-4">
                  <span className="bg-green-100 text-green-700 font-bold px-2 py-1 rounded text-[10px] uppercase flex items-center justify-center w-fit gap-1 border border-green-200/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>Generated
                  </span>
                </td>
                <td className="px-5 py-4">
                   <span className="text-xs font-medium text-gray-500 truncate max-w-[120px] block" title={bill.ewb_transporter_name || ''}>{bill.ewb_transporter_name || 'N/A'}</span>
                </td>
                <td className="px-5 py-4 font-bold text-gray-900">{fmtCurrency(bill.total_amount)}</td>
                <td className="px-5 py-4">
                   <button onClick={() => setSelectedBill(bill)} className="text-violet-600 hover:text-violet-800 font-bold text-xs uppercase tracking-wider">View Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBill && (
        <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} onPay={() => {}} />
      )}
    </div>
  );
}

// ── Walk-in Sale Tab ─────────────────────────────────────────────────────────

interface WalkInItem {
  medicine_name: string;
  unit: string;
  mrp: string;
  quantity: string;
  gst_rate: string;
  discount_type: 'percentage' | 'amount';
  discount_value: string;
  batch_number?: string;
  expiry_date?: string;
  inventory_id?: string;
  stock_qty?: number;
  available_batches?: any[];
}



const EMPTY_ITEM: WalkInItem = {
  medicine_name: '',
  unit: 'strip',
  mrp: '',
  quantity: '1',
  gst_rate: '12',
  discount_type: 'percentage',
  discount_value: '0',
  batch_number: '',
  expiry_date: '',
  inventory_id: '',
  stock_qty: 0,
  available_batches: []
};

function WalkInSaleTab() {
  const qc = useQueryClient();
  const accessToken = useAuthStore(s => s.accessToken);
  const [scannerStatus, setScannerStatus] = useState<'connected' | 'error' | 'scanning' | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit' | 'pending'>('cash');
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [items, setItems] = useState<WalkInItem[]>([{ ...EMPTY_ITEM }]);
  const [createdBill, setCreatedBill] = useState<BillData | null>(null);
  const [ewbData, setEwbData] = useState({ transport_mode: 'Road', vehicle_number: '', transporter_name: '', transport_doc_no: '', transport_date: new Date().toISOString().split('T')[0] });
  const [showEwbModal, setShowEwbModal] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<number, any[]>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [customerSearchResults, setCustomerSearchResults] = useState<{ customer_name: string | null; customer_phone: string; customer_gstin?: string; billing_address?: string; billing_state?: string }[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const medicineInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const unitSelectRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mrpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const discountRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addItemBtnRef = useRef<HTMLButtonElement | null>(null);
  const globalDiscountRef = useRef<HTMLInputElement | null>(null);
  const paymentMethodRef = useRef<HTMLDivElement | null>(null);
  const generateBillBtnRef = useRef<HTMLButtonElement | null>(null);
  const [customerHighlight, setCustomerHighlight] = useState(-1);
  const [suggHighlights, setSuggHighlights] = useState<Record<number, number>>({});
  const [triedToSubmit, setTriedToSubmit] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const barcodeRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: () => shopApi.getMyShop().then(r => r.data.data), staleTime: 5 * 60 * 1000 });
  const shopName = (shopData as any)?.shop_name ?? 'Medical Shop';
  const isTaxInvoice = (shopData as any)?.gst_type === 'regular';

  const ewbMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => billApi.generateEWayBill(data.id, data.payload),
    onSuccess: (res) => {
      setCreatedBill(res.data.data);
      setShowEwbModal(false);
      qc.invalidateQueries({ queryKey: ['bill-history'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to generate E-Way bill');
    }
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => billApi.createManual(payload),
    onSuccess: (res) => {
      const newBill = res.data.data;
      setCreatedBill(newBill);
      if (Number(newBill.total_amount) > 50000 && !ewbMutation.isSuccess && newBill.ewb_status !== 'generated') {
        setShowEwbModal(true);
      }
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

  const processBarcode = useCallback(async (barcode: string) => {
    setScannerStatus('scanning');
    try {
      const res = await inventoryApi.getByBarcode(barcode);
      const inv = res.data.data;
      const catalogMed = (res.data as any).medicine;

      if (inv) {
        setItems(prev => {
          const lastIdx = prev.length - 1;
          const lastItem = prev[lastIdx];
          const newItem: WalkInItem = {
            medicine_name: inv.medicine_name,
            unit: inv.unit || 'strip',
            mrp: String(inv.mrp),
            quantity: '1',
            gst_rate: String(inv.gst_rate || 5),
            discount_type: (inv.discount_type as any) || 'percentage',
            discount_value: String(inv.discount_value || 0),
            batch_number: inv.batch_number,
            expiry_date: inv.expiry_date,
            inventory_id: inv.id,
            stock_qty: inv.stock_qty,
          };

          if (!lastItem.medicine_name && prev.length === 1) {
            return [newItem];
          } else if (!lastItem.medicine_name) {
            const updated = [...prev];
            updated[lastIdx] = newItem;
            return updated;
          } else {
            const existingIdx = prev.findIndex(it => it.inventory_id === inv.id);
            if (existingIdx > -1) {
               const updated = [...prev];
               updated[existingIdx].quantity = String(Number(updated[existingIdx].quantity) + 1);
               return updated;
            }
            return [...prev, newItem];
          }
        });
        setScannerStatus('connected');
      } else if (catalogMed) {
        // Fallback to catalog: load the name but user fills the rest
        setItems(prev => {
          const newItem: WalkInItem = {
            ...EMPTY_ITEM,
            medicine_name: catalogMed.name,
            gst_rate: String(catalogMed.gst_rate || 12),
          };
          const lastItem = prev[prev.length - 1];
          if (!lastItem.medicine_name) {
            const updated = [...prev];
            updated[prev.length - 1] = newItem;
            return updated;
          }
          return [...prev, newItem];
        });
        setScannerStatus('connected');
        alert(`${catalogMed.name} পাওয়া গেছে, কিন্তু আপনার ইনভেন্টরিতে নেই। দয়া করে ব্যাচ ও দাম বসিয়ে দিন।`);
      } else {
        setScannerStatus('error');
        alert(`Barcode ${barcode} found but no matching item in your inventory or catalog.`);
      }
    } catch (err) {
      console.error('Barcode processing error', err);
      setScannerStatus('error');
      alert(`Error scanning barcode ${barcode}: Item may not exist.`);
    }
  }, [setItems]);

  useEffect(() => {
    // 1. Initial Connection & Heartbeat
    const token = accessToken;
    const establishConnection = () => {
      if (token && !socket.connected) {
        console.log('🔗 Attempting scanner connection...');
        connectSocket(token);
      }
    };

    establishConnection();
    const heartbeat = setInterval(establishConnection, 5000);

    // 2. Room Joining
    const joinRooms = () => {
      if (shopData?.id) {
        console.log('🏠 Joining shop room:', shopData.id);
        socket.emit('join_shop', { shop_id: shopData.id });
        setScannerStatus('connected');
      }
    };

    // 3. Status Mapping
    const handleConnect = () => {
      console.log('✅ Remote Scanner Connected | ID:', socket.id);
      joinRooms();
    };

    const handleConnectError = (err: any) => {
      console.error('❌ Scanner Connection Error:', err.message);
      setScannerStatus('error');
    };

    const handleDisconnect = (reason: string) => {
      console.warn('⚠️ Scanner Disconnected:', reason);
      setScannerStatus(null);
      if (reason === 'io server disconnect') socket.connect();
    };

    const handleRemoteScan = (data: { barcode: string; scanned_by?: string }) => {
      console.log('📥 BARCODE RECEIVED:', data.barcode);
      processBarcode(data.barcode);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    socket.on('item_scanned', handleRemoteScan);

    // If shopData loaded after connection
    if (socket.connected && shopData?.id) joinRooms();

    return () => {
      clearInterval(heartbeat);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('item_scanned', handleRemoteScan);
    };
  }, [shopData?.id, processBarcode, accessToken]);

  useEffect(() => {
    const handleGlobalKeys = async (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        addItem();
        setTimeout(() => medicineInputRefs.current[items.length]?.focus(), 50);
        return;
      }
      if (e.altKey && e.key === 'g') {
        e.preventDefault();
        handleCreate();
        return;
      }

      // Barcode Scanner Logic
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTimeRef.current > 70) {
        barcodeRef.current = '';
      }

      if (e.key === 'Enter') {
        if (barcodeRef.current.length >= 8) {
          processBarcode(barcodeRef.current);
        }
        barcodeRef.current = '';
      } else if (/^\d$/.test(e.key)) {
        barcodeRef.current += e.key;
      }
      lastKeyTimeRef.current = currentTime;
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [items, customerName, customerPhone, paymentMethod, globalDiscount, processBarcode]);

  const reset = () => {
    setCreatedBill(null); setCustomerName(''); setCustomerPhone('');
    setPaymentMethod('cash'); setGlobalDiscount(''); setItems([{ ...EMPTY_ITEM }]);
    setCustomerSearchResults([]); setShowCustomerDropdown(false); setCustomerHighlight(-1); setSuggHighlights({});
    setTriedToSubmit(false); setValidationError(null);
    setEwbData({ transport_mode: 'Road', vehicle_number: '', transporter_name: '', transport_doc_no: '', transport_date: new Date().toISOString().split('T')[0] });
    setShowEwbModal(false);
    ewbMutation.reset();
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
          const res = await inventoryApi.list({ q: value, limit: 20 });
          const invItems = res.data.data ?? [];
          
          if (invItems.length > 0) {
            // Group by medicine name to show total stock
            const grouped = invItems.reduce((acc: any, inv: any) => {
              const name = inv.medicine_name.toLowerCase().trim();
              if (!acc[name]) {
                acc[name] = { 
                  ...inv, 
                  total_stock: 0, 
                  batches: [] 
                };
              }
              acc[name].total_stock += inv.stock_qty || 0;
              acc[name].batches.push(inv);
              return acc;
            }, {});
            
            const results = Object.values(grouped).map((g: any) => {
              // Sort batches by expiry date (FEFO) - earliest first
              g.batches.sort((a: any, b: any) => {
                if (!a.expiry_date) return 1;
                if (!b.expiry_date) return -1;
                return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
              });
              return g;
            });
            
            setSuggestions((prev) => ({ ...prev, [idx]: results }));
          } else {
            const medRes = await medicinesApi.catalog({ q: value });
            const catalogItems = (medRes.data.data ?? []).slice(0, 8).map((m: any) => ({
              id: m.id,
              medicine_name: m.name,
              unit: 'strip',
              mrp: 0,
              gst_rate: m.gst_rate ?? 12,
              batch_number: 'N/A',
              expiry_date: null,
              stock_qty: 0,
              total_stock: 0,
              batches: []
            }));
            setSuggestions((prev) => ({ ...prev, [idx]: catalogItems }));
          }
          setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
        } catch { /* ignore */ }
      }, 250);
    }
  };

  const selectSuggestion = (idx: number, group: any) => {
    // FEFO Selection: pick the first batch with stock_qty > 0, else pick the first batch at all
    const bestBatch = group.batches?.find((b: any) => b.stock_qty > 0) || group.batches?.[0] || group;
    
    setItems((prev) => prev.map((it, i) =>
      i === idx ? {
        ...it,
        medicine_name: group.medicine_name,
        unit: bestBatch.unit ?? it.unit,
        mrp: String(bestBatch.mrp),
        gst_rate: String(bestBatch.gst_rate ?? 12),
        batch_number: bestBatch.batch_number ?? '',
        expiry_date: bestBatch.expiry_date ?? '',
        inventory_id: bestBatch.id,
        stock_qty: bestBatch.stock_qty ?? 0,
        available_batches: group.batches ?? []
      } : it
    ));
    setSuggestions((prev) => ({ ...prev, [idx]: [] }));
    setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
    setTimeout(() => {
      if (bestBatch.stock_qty > 0) {
        qtyRefs.current[idx]?.focus();
      } else {
        mrpRefs.current[idx]?.focus();
      }
    }, 0);
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // Live totals
  const calcSubtotal = items.reduce((s, it) => {
    const qty = Number(it.quantity) || 0;
    const mrp = Number(it.mrp) || 0;
    return s + qty * mrp;
  }, 0);

  const totalItemLevelDiscount = items.reduce((s, it) => {
    const qty = Number(it.quantity) || 0;
    const mrp = Number(it.mrp) || 0;
    const dv = Number(it.discount_value) || 0;
    if (it.discount_type === 'percentage') return s + (qty * mrp * dv) / 100;
    return s + (qty * dv);
  }, 0);

  const calcGlobalDiscount = Number(globalDiscount) || 0;
  const totalDiscountAmount = totalItemLevelDiscount + calcGlobalDiscount;

  const calcGst = isTaxInvoice ? items.reduce((s, it) => {
    const qty = Number(it.quantity) || 0;
    const mrp = Number(it.mrp) || 0;
    const dv = Number(it.discount_value) || 0;
    const sub = (qty * mrp);
    const disc = it.discount_type === 'percentage' ? (sub * dv) / 100 : (qty * dv);
    const gstRate = Number(it.gst_rate) || 0;
    return s + ((sub - disc) * gstRate) / 100;
  }, 0) : 0;

  const calcTotal = calcSubtotal - totalDiscountAmount + calcGst;

  const handleCreate = () => {
    setTriedToSubmit(true);
    setValidationError(null);

    const activeItems = items.filter(it => it.medicine_name.trim() !== '' || Number(it.mrp) > 0 || Number(it.quantity) > 0);

    if (activeItems.length === 0) {
      setValidationError('Please add at least one medicine item');
      return;
    }

    const hasIncompleteRow = activeItems.some(it => !it.medicine_name.trim());
    if (hasIncompleteRow) {
      setValidationError('Medicine name cannot be blank for any added item');
      return;
    }

    if (customerGstin && !GSTIN_REGEX.test(customerGstin)) {
      setValidationError('Invalid Customer GSTIN format. The 13th character must be "Z".');
      setTriedToSubmit(true);
      setShowCustomerDetails(true);
      return;
    }

    const validItems = activeItems.filter((it) => it.medicine_name.trim() && Number(it.mrp) > 0 && Number(it.quantity) > 0);

    createMutation.mutate({
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      customer_gstin: customerGstin || undefined,
      billing_address: customerAddress || undefined,
      billing_state: customerState || undefined,
      payment_method: paymentMethod,
      discount_amount: calcGlobalDiscount,
      items: validItems.map((it) => ({
        medicine_name: it.medicine_name,
        inventory_id: it.inventory_id,
        batch_number: it.batch_number,
        expiry_date: it.expiry_date,
        unit: it.unit || 'strip',
        mrp: Number(it.mrp),
        quantity: Number(it.quantity),
        discount_type: it.discount_type,
        discount_value: Number(it.discount_value),
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

  // Automatically expanding is removed to keep it minimized by default as requested.

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
            {(createdBill?.items || []).map((item, i) => (
              <div key={item?.id || i} className={`flex justify-between py-2 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div>
                  <div className="text-gray-900 font-medium">{item?.medicine_name}</div>
                  <div className="flex gap-2 text-[10px] items-center">
                    <span className="text-gray-400">× {item?.quantity} @ ₹{item?.mrp}</span>
                    {item?.batch_number && <span className="bg-gray-100 text-gray-500 px-1 rounded">Batch: {item.batch_number}</span>}
                  </div>
                </div>
                <span className="font-semibold text-gray-900">{fmtCurrency(item?.line_total || 0)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-sm mb-5">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmtCurrency(createdBill.subtotal)}</span></div>
            {createdBill.discount_amount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{fmtCurrency(createdBill.discount_amount)}</span></div>}
            {(() => {
              if (createdBill.gst_amount <= 0) return null;
              const shopStateNormalized = normalizeState(shopData?.state);
              const billingStateNormalized = normalizeState(createdBill.billing_state);
              const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;

              if (isInterState) {
                return <div className="flex justify-between text-gray-500"><span>IGST</span><span>{fmtCurrency(createdBill.gst_amount)}</span></div>;
              }
              return (
                <>
                  <div className="flex justify-between text-gray-500"><span>CGST</span><span>{fmtCurrency(createdBill.gst_amount / 2)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>SGST</span><span>{fmtCurrency(createdBill.gst_amount / 2)}</span></div>
                </>
              );
            })()}
            <div className="flex justify-between font-bold text-gray-900 text-xl pt-3 border-t border-gray-200"><span>Total</span><span className="text-violet-700">{fmtCurrency(Math.round(createdBill.total_amount))}</span></div>
          </div>

          {/* E-Way Bill Details */}
          {createdBill.ewb_status === 'generated' && (
            <div className="bg-yellow-50/50 border border-yellow-200/60 rounded-xl p-4 mb-4 text-sm text-yellow-800">
              <h4 className="font-bold flex items-center gap-1.5 mb-2">
                <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                E-Way Bill Generated
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-yellow-600">EWB Number:</span> <br/><span className="font-semibold text-yellow-900">{createdBill.ewb_number}</span></div>
                <div><span className="text-yellow-600">Valid Till:</span> <br/><span className="font-semibold text-yellow-900">{createdBill.ewb_valid_till ? new Date(createdBill.ewb_valid_till).toLocaleString() : 'N/A'}</span></div>
              </div>
            </div>
          )}

          {/* Pay now if pending */}
          {createdBill.payment_status === 'pending' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Record Payment</p>
              <div className="flex gap-2">
                {(['cash', 'upi', 'card', 'credit'] as const).map((m) => (
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
              onClick={() => printInvoice(createdBill, shopData)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all"
            >
              🖨️ Print Receipt
            </button>
            <button
              onClick={() => sendWhatsApp(createdBill, shopName, shopData)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 rounded-xl py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 transition-all"
            >
              💬 WhatsApp
            </button>
          </div>

          <button onClick={reset} className="w-full mt-2 text-sm text-gray-400 hover:text-violet-600 py-2 transition-colors font-medium">
            + New Walk-in Sale
          </button>
        </div>

        {/* E-Way Bill Auto Modal */}
        {showEwbModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-600 p-3.5 rounded-full border-4 border-white shadow-xl shadow-yellow-200/50">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="mt-6 text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">E-Way Bill Required</h2>
                <p className="text-sm text-gray-500 mb-6 font-medium leading-relaxed">
                  Invoice <span className="font-bold text-gray-700">{createdBill?.bill_number}</span> exceeds ₹50,000.<br/>
                  Do you want to generate an E-Way Bill now before dispatching the goods?
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowEwbModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    Later
                  </button>
                  <button
                    onClick={() => ewbMutation.mutate({ id: createdBill.id, payload: ewbData })}
                    disabled={ewbMutation.isPending}
                    className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-200 disabled:opacity-50"
                  >
                    {ewbMutation.isPending ? 'Generating...' : 'Generate Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
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
                    const c = customerSearchResults[customerHighlight] as any;
                    setCustomerPhone(c.customer_phone);
                    setCustomerName(c.customer_name ?? '');
                    setCustomerGstin(c.customer_gstin ?? '');
                    setCustomerAddress(c.billing_address ?? '');
                    setCustomerState(c.billing_state ?? '');
                    setShowCustomerDropdown(false); setCustomerHighlight(-1);
                    if (c.customer_gstin || c.billing_address) setShowCustomerDetails(true);
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
                        const c = customerSearchResults[i] as any;
                        setCustomerPhone(c.customer_phone);
                        setCustomerName(c.customer_name ?? '');
                        setCustomerGstin(c.customer_gstin ?? '');
                        setCustomerAddress(c.billing_address ?? '');
                        setCustomerState(c.billing_state ?? '');
                        setShowCustomerDropdown(false); setCustomerHighlight(-1);
                        if (c.customer_gstin || c.billing_address) setShowCustomerDetails(true);
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

          {/* New Customer / GST Details Toggle */}
          <div className="mt-3">
            {!showCustomerDetails ? (
              <button
                type="button"
                onClick={() => setShowCustomerDetails(true)}
                className="text-xs font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 border border-violet-100 bg-violet-50/50 px-3 py-1.5 rounded-lg"
              >
                + Add Customer GSTIN / Address (B2B Sale)
              </button>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-200 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GST & Billing Details</span>
                  <button type="button" onClick={() => setShowCustomerDetails(false)} className="text-gray-400 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">GSTIN</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="19XXXXX..."
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      className={`w-full border rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:ring-2 uppercase font-mono ${
                        customerGstin && !GSTIN_REGEX.test(customerGstin)
                          ? 'border-red-400 focus:ring-red-100'
                          : customerGstin && GSTIN_REGEX.test(customerGstin)
                          ? 'border-green-400 focus:ring-green-100'
                          : 'border-gray-200 focus:border-violet-500'
                      }`}
                    />
                    {customerGstin && !GSTIN_REGEX.test(customerGstin) && (
                      <p className="text-[10px] text-red-500 mt-1 font-medium">Invalid: 13th character must be &apos;Z&apos;</p>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">State / Place of Supply</label>
                    <select
                      value={customerState}
                      onChange={(e) => setCustomerState(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                    <input
                      type="text"
                      placeholder="Billing Address"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Medicines / Items
            </h3>
            <div className={`text-[10px] uppercase font-black px-3 py-1 rounded-lg flex items-center gap-1.5 border transition-all duration-300 ${
              scannerStatus === 'scanning' ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse shadow-sm shadow-amber-100' :
              scannerStatus === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-100' :
              scannerStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
              'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                scannerStatus === 'scanning' ? 'bg-amber-500' : 
                scannerStatus === 'connected' ? 'bg-emerald-500' : 
                scannerStatus === 'error' ? 'bg-red-500' : 
                'bg-gray-300'
              }`} />
              Remote Scanner: {scannerStatus ? scannerStatus.toUpperCase() : 'DISCONNECTED'}
            </div>
          </div>
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid gap-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1" style={{ gridTemplateColumns: isTaxInvoice ? '2fr 0.8fr 1fr 1fr 0.7fr 1.1fr 1.2fr 0.8fr 40px' : '2fr 0.8fr 1fr 1fr 0.7fr 1.2fr 1.2fr 40px' }}>
              <div>Medicine</div>
              <div>Unit</div>
              <div>Batch</div>
              <div>Exp</div>
              <div>Qty</div>
              <div>MRP (₹)</div>
              <div>Discount</div>
              {isTaxInvoice && <div>GST%</div>}
              <div />
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="relative">
                <div className="grid gap-2 items-center" style={{ gridTemplateColumns: isTaxInvoice ? '2fr 0.8fr 1fr 1fr 0.7fr 1.1fr 1.2fr 0.8fr 40px' : '2fr 0.8fr 1fr 1fr 0.7fr 1.2fr 1.2fr 40px' }}>
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
                        else if (e.key === 'Enter' && (h < 0 || suggs.length === 0)) {
                          e.preventDefault();
                          if (!item.medicine_name.trim()) {
                            setTriedToSubmit(true);
                            setValidationError('Medicine name cannot be blank');
                          } else {
                            setSuggestions((p) => ({ ...p, [idx]: [] }));
                            unitSelectRefs.current[idx]?.focus();
                          }
                        }
                        else if (e.key === 'Escape') {
                          if ((suggestions[idx]?.length ?? 0) > 0) {
                            setSuggestions((p) => ({ ...p, [idx]: [] }));
                            setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
                          } else {
                            if (!item.medicine_name.trim() && items.length > 1) {
                              removeItem(idx);
                            }
                            globalDiscountRef.current?.focus();
                          }
                        }
                      }}
                      className={`w-full border rounded-lg px-3 h-9 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 ${triedToSubmit && !item.medicine_name.trim() ? 'border-red-500 bg-red-50 focus:ring-red-100' : 'border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100'}`}
                    />
                    {/* Autocomplete dropdown */}
                    {suggestions[idx] && suggestions[idx].length > 0 && (
                      <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[340px]">
                        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100 flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                          <span>Medicine</span>
                          <span>Total Stock | MRP</span>
                        </div>
                        {suggestions[idx].map((s, si) => (
                          <button
                            key={s.id || si}
                            type="button"
                            onMouseDown={() => selectSuggestion(idx, s)}
                            className={`w-full flex items-center justify-between px-4 py-4 text-sm text-left transition-colors border-b border-gray-50 last:border-0 ${si === (suggHighlights[idx] ?? -1) ? 'bg-violet-600 text-white shadow-inner' : 'hover:bg-violet-50'}`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className={`font-bold text-base ${si === (suggHighlights[idx] ?? -1) ? 'text-white' : 'text-gray-900'}`}>{s.medicine_name}</span>
                              <div className="flex items-center gap-2">
                                {s.batches?.length > 0 && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${si === (suggHighlights[idx] ?? -1) ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-600'}`}>
                                    {s.batches.length} Batches
                                  </span>
                                )}
                                {s.expiry_date && (
                                  <span className={`text-[10px] ${si === (suggHighlights[idx] ?? -1) ? 'text-violet-100' : 'text-orange-600'}`}>
                                    FEFO Exp: {fmtDate(s.expiry_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-base font-black leading-tight ${si === (suggHighlights[idx] ?? -1) ? 'text-white' : s.total_stock <= 5 ? 'text-red-500' : 'text-emerald-600'}`}>
                                {s.total_stock ?? s.stock_qty} <span className="font-normal text-[10px] uppercase opacity-70">Strip</span>
                              </div>
                              <div className={`text-sm font-bold ${si === (suggHighlights[idx] ?? -1) ? 'text-white' : 'text-violet-600'}`}>₹{s.mrp}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <select ref={(el) => { unitSelectRefs.current[idx] = el; }} value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[idx]?.focus(); } }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-9 text-xs text-gray-700 outline-none focus:border-violet-500 bg-white cursor-pointer uppercase font-medium">
                      {Array.from(new Set(['strip', 'tablet', 'capsule', 'bottle', 'syrup', 'injection', 'vial', 'tube', 'cream', 'ointment', 'sachet', 'packet', 'piece', 'box', item.unit].filter(Boolean))).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {/* Batch & Exp */}
                  <div>
                    {item.available_batches && item.available_batches.length > 0 ? (
                      <select 
                        value={item.inventory_id} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const b = item.available_batches?.find(bb => bb.id === val);
                          if (b) {
                            setItems((prev) => prev.map((it, i) => i === idx ? {
                              ...it,
                              inventory_id: b.id,
                              batch_number: b.batch_number,
                              expiry_date: b.expiry_date,
                              mrp: String(b.mrp),
                              stock_qty: b.stock_qty
                            } : it));
                          }
                        }}
                        className="w-full border border-gray-200 rounded-lg px-1 h-9 text-[11px] text-gray-900 outline-none focus:border-violet-500 font-mono"
                      >
                        {item.available_batches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.batch_number} ({b.stock_qty})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" placeholder="Batch" value={item.batch_number} onChange={(e) => updateItem(idx, 'batch_number', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 h-9 text-[11px] text-gray-900 outline-none focus:border-violet-500 font-mono" />
                    )}
                  </div>
                  <div>
                    <input type="text" placeholder="Exp" value={item.expiry_date ? fmtDate(item.expiry_date) : ''} readOnly
                      className="w-full border border-gray-200 rounded-lg px-2 h-9 text-[11px] text-gray-500 outline-none bg-gray-50 text-center" />
                  </div>
                  <div className="relative">
                    <input
                      ref={(el) => { qtyRefs.current[idx] = el; }}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          mrpRefs.current[idx]?.focus();
                        }
                      }}
                      className={`w-full border rounded-lg px-2 h-9 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-violet-100 text-center transition-all ${item.stock_qty && Number(item.quantity) > item.stock_qty ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-violet-500'}`}
                    />
                    {item.stock_qty && Number(item.quantity) > item.stock_qty && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap animate-bounce z-10">
                        Only {item.stock_qty} Left
                      </div>
                    )}
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
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); discountRefs.current[idx]?.focus(); } }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-9 text-sm font-semibold text-violet-700 outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="flex items-center">
                    <select
                      value={item.discount_type}
                      onChange={(e) => updateItem(idx, 'discount_type', e.target.value)}
                      className="w-10 border border-r-0 border-gray-200 rounded-l-lg h-9 text-xs text-gray-600 outline-none focus:border-violet-500 bg-gray-50 text-center"
                    >
                      <option value="percentage">%</option>
                      <option value="amount">₹</option>
                    </select>
                    <input
                      ref={(el) => { discountRefs.current[idx] = el; }}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.discount_value}
                      onChange={(e) => updateItem(idx, 'discount_value', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItemBtnRef.current?.focus(); } }}
                      className="flex-1 w-0 border border-gray-200 rounded-r-lg px-1.5 h-9 text-sm text-gray-900 outline-none focus:border-violet-500"
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
                      className="group/del w-8 h-8 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 flex items-center justify-center transition-all"
                      title="Remove Row"
                    >
                      <svg className="w-4 h-4 group-hover/del:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                    </button>
                  </div>
                </div>
                {/* Line total hint */}
                {Number(item.mrp) > 0 && Number(item.quantity) > 0 && (
                  <div className="absolute right-0 -bottom-2 translate-y-full flex items-center gap-3 pr-10">
                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
                      {item.batch_number && <span>Batch: <span className="text-gray-600 font-mono">{item.batch_number}</span></span>}
                      {item.expiry_date && <span>Exp: <span className="text-orange-500">{fmtDate(item.expiry_date)}</span></span>}
                      {item.stock_qty !== undefined && <span>Stock: <span className={item.stock_qty < 5 ? 'text-red-500' : 'text-emerald-600'}>{item.stock_qty}</span></span>}
                    </div>
                    <div className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100/50">
                      Line Total: {fmtCurrency((Number(item.mrp) * Number(item.quantity)) - (item.discount_type === 'percentage' ? (Number(item.mrp) * Number(item.quantity) * Number(item.discount_value)) / 100 : (Number(item.quantity) * Number(item.discount_value))))}
                    </div>
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
              ref={globalDiscountRef}
              type="number"
              min="0"
              placeholder="0"
              value={globalDiscount}
              onChange={(e) => setGlobalDiscount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setPaymentMethod('cash');
                  paymentMethodRef.current?.focus();
                }
              }}
              className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
              Payment Method
            </h3>
            <div 
              ref={paymentMethodRef}
              tabIndex={0}
              onKeyDown={(e) => {
                const currentIndex = METHODS.findIndex(m => m.id === paymentMethod);
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  const nextIndex = (currentIndex + 1) % METHODS.length;
                  setPaymentMethod(METHODS[nextIndex].id);
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prevIndex = (currentIndex - 1 + METHODS.length) % METHODS.length;
                  setPaymentMethod(METHODS[prevIndex].id);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  generateBillBtnRef.current?.focus();
                }
              }}
              className="flex flex-wrap gap-1.5 outline-none focus:ring-2 focus:ring-violet-100 rounded-lg p-1"
            >
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${paymentMethod === m.id
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

        {/* E-Way Bill Section */}
        {Math.round(calcTotal) > 50000 && (
          <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">5</span>
              🚚 E-Way Bill Details
            </h3>
            <div className="bg-yellow-50/80 border border-yellow-200 rounded-xl p-4 shadow-sm relative overflow-hidden animate-in fade-in duration-300">
               <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />
               <div className="flex items-start gap-3 mb-4">
                 <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg shrink-0 mt-0.5">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 </div>
                 <div>
                   <p className="text-yellow-800 font-bold text-sm">E-Way Bill is required</p>
                   <p className="text-yellow-700/80 text-xs">This invoice exceeds ₹50,000. It is recommended to generate an E-Way Bill before dispatch.</p>
                 </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-yellow-800/60 uppercase tracking-widest mb-1">Transport Mode</label>
                    <select value={ewbData.transport_mode} onChange={e => setEwbData({...ewbData, transport_mode: e.target.value})} className="w-full bg-white border border-yellow-200/60 rounded-lg px-2 h-9 text-xs text-gray-700 outline-none focus:border-yellow-400">
                      <option value="Road">Road</option>
                      <option value="Rail">Rail</option>
                      <option value="Air">Air</option>
                      <option value="Ship">Ship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-yellow-800/60 uppercase tracking-widest mb-1">Vehicle No.</label>
                    <input type="text" placeholder="e.g. MH04 XY 1234" value={ewbData.vehicle_number} onChange={e => setEwbData({...ewbData, vehicle_number: e.target.value})} className="w-full bg-white border border-yellow-200/60 rounded-lg px-3 h-9 text-xs text-gray-900 outline-none focus:border-yellow-400 uppercase" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-yellow-800/60 uppercase tracking-widest mb-1">Transporter Name</label>
                    <input type="text" placeholder="Transporter Details" value={ewbData.transporter_name} onChange={e => setEwbData({...ewbData, transporter_name: e.target.value})} className="w-full bg-white border border-yellow-200/60 rounded-lg px-3 h-9 text-xs text-gray-900 outline-none focus:border-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-yellow-800/60 uppercase tracking-widest mb-1">Doc No. (LR/RR)</label>
                    <input type="text" placeholder="Transport Doc No." value={ewbData.transport_doc_no} onChange={e => setEwbData({...ewbData, transport_doc_no: e.target.value})} className="w-full bg-white border border-yellow-200/60 rounded-lg px-3 h-9 text-xs text-gray-900 outline-none focus:border-yellow-400 uppercase" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-yellow-800/60 uppercase tracking-widest mb-1">Transport Date</label>
                    <input type="date" value={ewbData.transport_date} onChange={e => setEwbData({...ewbData, transport_date: e.target.value})} className="w-full bg-white border border-yellow-200/60 rounded-lg px-3 h-9 text-xs text-gray-900 outline-none focus:border-yellow-400" />
                  </div>
                </div>
            </div>
          </div>
        )}

        {/* Live summary */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-violet-600" />
          <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l1.25 1.25L13.75 12m4.5-3.375H9M9 8.25h.75m.75 0h.75m.75 0h.75m.75 0h.75M12 17.25h.75m.75 0h.75m.75 0h.75M12 21h.75m.75 0h.75m.75 0h.75M3.75 21h4.5c.621 0 1.125-.504 1.125-1.125s-.504-1.125-1.125-1.125h-4.5A1.125 1.125 0 012.625 17.625V4.875C2.625 4.254 3.129 3.75 3.75 3.75h16.5c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125h-4.5M16.5 21h4.5c.621 0 1.125-.504 1.125-1.125s-.504-1.125-1.125-1.125h-4.5C15.879 18.75 15.375 19.254 15.375 19.875S15.879 21 16.5 21z" /></svg>
            Payment Summary
          </h3>
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 px-1">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500"><span>Gross Subtotal</span><span className="font-medium text-gray-900">{fmtCurrency(calcSubtotal)}</span></div>
              <div className="flex justify-between text-sm text-emerald-600"><span>Item Discounts</span><span>−{fmtCurrency(totalItemLevelDiscount)}</span></div>
              {calcGlobalDiscount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Global Discount</span><span>−{fmtCurrency(calcGlobalDiscount)}</span></div>}
            </div>
            <div className="space-y-2 border-l border-gray-100 pl-12">
              <div className="flex justify-between text-sm text-gray-500"><span>Taxable Value</span><span className="font-medium text-gray-900">{fmtCurrency(calcSubtotal - totalDiscountAmount)}</span></div>
              {calcGst > 0 && <div className="flex justify-between text-sm text-gray-500"><span>GST Amount</span><span className="font-medium text-gray-900">{fmtCurrency(calcGst)}</span></div>}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-gray-200 mt-5 pt-5 pb-1 px-1">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Payable</span>
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-700 to-indigo-700">{fmtCurrency(Math.round(calcTotal))}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${paymentMethod === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {paymentMethod.toUpperCase()} PAY
            </div>
          </div>
        </div>

        {(createMutation.isError || validationError) && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm mt-4">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {createMutation.isError ? ((createMutation.error as any)?.response?.data?.error?.message ?? 'Failed to create bill. Please try again.') : validationError}
          </div>
        )}

        <button
          ref={generateBillBtnRef}
          onClick={handleCreate}
          disabled={createMutation.isPending || calcSubtotal <= 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreate();
            }
          }}
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

type Tab = 'walkin' | 'new' | 'history' | 'ewaybill';

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('walkin');
  const { data: stats } = useQuery({ queryKey: ['billing-today-stats'], queryFn: () => billApi.stats({ from_date: new Date().toISOString().split('T')[0] }).then(r => r.data.data) });

  return (
    <div className="p-6 lg:p-8 bg-gray-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Billing Center</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium italic">Efficient sales & prescription management</p>
        </div>

        {/* Today's Mini Dashboard */}
        <div className="flex gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today's Revenue</p>
              <p className="text-lg font-black text-gray-900">{fmtCurrency(stats?.total_revenue ?? 0)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375m1.875-3h1.875m-1.875 3h1.875M9 9h3.375m1.875-3h1.875m-1.875 3h1.875M9 18h3.375m1.875-3h1.875m-1.875 3h1.875" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bills Issued</p>
              <p className="text-lg font-black text-gray-900">{stats?.total_bills ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-2xl w-fit mb-8 border border-gray-100 shadow-sm">
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
            id: 'ewaybill' as Tab, label: 'E-Way Bill',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
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
      {tab === 'ewaybill' && <EWayBillDashboardTab />}
    </div>
  );
}
