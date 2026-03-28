'use client';

import React, { useState, useRef, Fragment, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, inventoryApi, medicinesApi, shopApi, billApi } from '../../../lib/apiClient';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function pct(part: number, total: number) {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

function parseCsv(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
  return lines.slice(1).map(line => {
    // regex can be tricky, simple split for now or better regex
    const values = line.split(',').map(v => v.trim());
    const obj: any = {};
    headers.forEach((h, i) => {
      let val = (values[i] || '').trim().replace(/^"|"$/g, '');
      obj[h] = val;
    });
    return obj;
  });
}

const TODAY = new Date();
const FIRST_OF_MONTH = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const TODAY_STR = TODAY.toISOString().slice(0, 10);

// ── types ─────────────────────────────────────────────────────────────────────
interface PLData {
  period: { from: string; to: string };
  revenue: { sales_income: number; other_income: number; total: number };
  cogs: { medicine_purchase_cost: number };
  gross_profit: number;
  gross_margin_pct: number;
  expenses: Record<string, number>; // dynamic category keys + 'total'
  net_profit: number;
  net_margin_pct: number;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  payment_method: string;
  entry_date: string;
  is_auto_entry: boolean;
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  gstin: string | null;
  gst_number: string | null;
}

interface Purchase {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  received_date?: string | null;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  supplier: { id?: string; name: string } | null;
  supplier_id?: string | null;
  notes?: string | null;
  items?: any[];
}

interface CreditCustomer {
  id: string;
  name: string;
  phone: string | null;
  total_outstanding: number;
  overdue: boolean;
  updated_at: string | null;
}

interface GstSummary {
  period: { month: number; year: number };
  outward_supplies: {
    taxable_value: number;
    gst_collected: { cgst: number; sgst: number; igst: number };
    total_gst_collected: number;
  };
  inward_supplies: {
    itc_available: { cgst: number; sgst: number };
    total_itc: number;
  };
  net_tax_payable: number;
  rate_wise_summary: { gst_rate: number; taxable_value: number; gst_amount: number }[];
}

// ── sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, trend, color = 'violet', textColor }: { label: string; value: string; sub?: string; icon?: React.ReactNode; trend?: string; color?: string; textColor?: string }) {
  // Backwards compatibility for legacy bg- class usage
  if (color.startsWith('bg-')) {
    return (
      <div className={`${color} ${textColor || 'text-gray-900'} p-5 rounded-2xl shadow-sm border border-black/5`}>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
        <h3 className="text-xl font-black tracking-tight">{value}</h3>
        {sub && <p className="text-[10px] opacity-60 font-bold mt-1">{sub}</p>}
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    violet: 'from-violet-500 to-indigo-600',
    rose: 'from-rose-500 to-pink-600',
    amber: 'from-amber-400 to-orange-500',
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-cyan-600',
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorMap[color] || 'from-gray-100 to-gray-200'} flex items-center justify-center text-white shadow-lg shadow-gray-200/50`}>
        {icon || <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      </div>
      <div className="flex-1">
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h3>
        <div className="flex items-center gap-2 mt-1">
          {sub && <span className="text-xs text-gray-400 font-medium">{sub}</span>}
          {trend && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${trend.includes('+') ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{trend}</span>}
        </div>
      </div>
    </div>
  );
}

function HsnEntryModal({ medicineName, onSave, onCancel }: { medicineName: string; onSave: (hsn: string) => void; onCancel: () => void }) {
  const [hsn, setHsn] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus after animation tick
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-gray-900 mb-1">New Medicine Spotted</h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          <span className="font-bold text-violet-600">{medicineName}</span> is not in your master catalog. 
          Please enter the HSN code for accurate GST filing.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1.5 ml-1">HSN Code</label>
            <input 
              ref={inputRef}
              type="text" 
              value={hsn} 
              onChange={(e) => setHsn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSave(hsn);
                }
              }}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm transition-all"
              placeholder="e.g. 300490"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => onSave(hsn)}
              className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 active:scale-95"
            >
              Update Record
            </button>
            <button 
              onClick={onCancel}
              className="px-5 py-3 text-sm font-bold text-gray-400 hover:text-gray-600"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── panel tabs ────────────────────────────────────────────────────────────────
const TABS = ['P&L', 'Expenses', 'Suppliers', 'Purchases', 'Outstandings', 'GST', 'Sale Ret.', 'Pur. Ret.', 'Contra', 'Cashbook', 'Bankbook', 'Settings'] as const;
type Tab = (typeof TABS)[number];

// ─────────────────────────────────────────────────────────────────────────────
//  P&L Tab
// ─────────────────────────────────────────────────────────────────────────────
function PLTab() {
  const [from, setFrom] = useState(FIRST_OF_MONTH);
  const [to, setTo] = useState(TODAY_STR);

  const { data: pl, isLoading } = useQuery<PLData>({
    queryKey: ['web-pl', from, to],
    queryFn: () => accountingApi.getPL(from, to).then((r) => r.data.data),
  });

  const month = TODAY.getMonth() + 1;
  const year = TODAY.getFullYear();
  const { data: gst } = useQuery<GstSummary>({
    queryKey: ['web-gst', month, year],
    queryFn: () => accountingApi.getGstSummary(month, year).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div>
          <label className="text-gray-500 text-xs block mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pl ? (
        <>
          {/* Top cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={fmt(pl.revenue.total)} color="bg-violet-50" textColor="text-violet-700" />
            <StatCard label="Gross Profit" value={fmt(pl.gross_profit)} sub={`Margin: ${pl.gross_margin_pct.toFixed(1)}%`} color="bg-blue-50" textColor="text-blue-700" />
            <StatCard label="Operating Expenses" value={fmt(pl.expenses.total)} color="bg-red-50" textColor="text-red-600" />
            <StatCard
              label="Net Profit"
              value={fmt(pl.net_profit)}
              sub={`Net margin: ${pl.net_margin_pct.toFixed(1)}%`}
              color={pl.net_profit >= 0 ? 'bg-green-50' : 'bg-red-50'}
              textColor={pl.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}
            />
          </div>

          {/* Revenue + Expense breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4">Revenue by Payment Method</h3>
              {(['sales_income', 'other_income'] as const).map((m) => {
                const val = pl.revenue[m] as number;
                const p = pl.revenue.total > 0 ? (val / pl.revenue.total) * 100 : 0;
                const clr: Record<string, string> = { sales_income: 'bg-green-400', other_income: 'bg-blue-400' };
                const label: Record<string, string> = { sales_income: 'Sales Income', other_income: 'Other Income' };
                return (
                  <div key={m} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{label[m]}</span>
                      <span className="text-gray-700 font-medium">{fmt(val)} <span className="text-gray-400 font-normal">({p.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-2 rounded-full ${clr[m]}`} style={{ width: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4">Expense Breakdown</h3>
              {Object.entries(pl.expenses).filter(([k]) => k !== 'total').length === 0 ? (
                <p className="text-gray-400 text-sm">No expenses in this period</p>
              ) : (
                Object.entries(pl.expenses)
                  .filter(([k]) => k !== 'total')
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="capitalize text-gray-600 text-sm">{cat}</span>
                      <span className="text-gray-700 text-sm font-medium">{fmt(amt as number)}</span>
                    </div>
                  ))
              )}
              <div className="flex justify-between pt-3 border-t border-gray-200 mt-1">
                <span className="text-gray-700 font-semibold text-sm">Total</span>
                <span className="text-red-600 font-bold text-sm">{fmt(pl.expenses.total)}</span>
              </div>
            </div>
          </div>

          {/* GST quick view */}
          {gst && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4">
                GST Summary — {new Date(TODAY.getFullYear(), TODAY.getMonth(), 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-500 text-xs">Outward Taxable</p>
                  <p className="font-bold text-gray-800 text-lg">{fmt(gst.outward_supplies.taxable_value)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total GST Collected</p>
                  <p className="font-bold text-gray-800 text-lg">{fmt(gst.outward_supplies.total_gst_collected)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Net GST Payable</p>
                  <p className="font-bold text-indigo-600 text-lg">{fmt(gst.net_tax_payable)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Expenses Tab
// ─────────────────────────────────────────────────────────────────────────────
function ExpensesTab() {
  const qc = useQueryClient();
  const [category, setCategory] = useState('miscellaneous');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
   const [payMethod, setPayMethod] = useState('cash');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const CATS = ['rent', 'salary', 'electricity', 'water', 'phone', 'internet', 'maintenance', 'transport', 'advertising', 'miscellaneous'];

  const { data, isLoading } = useQuery<{ items: Expense[]; total: number }>({
    queryKey: ['web-expenses'],
    queryFn: () => accountingApi.listExpenses().then((r) => r.data.data),
  });

   const createMutation = useMutation({
    mutationFn: (d: object) => editingId ? accountingApi.updateExpense(editingId, d) : accountingApi.createExpense(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-expenses'] });
      qc.invalidateQueries({ queryKey: ['web-pl'] });
      setShowForm(false);
      setEditingId(null);
      setAmount('');
      setDescription('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-expenses'] });
      qc.invalidateQueries({ queryKey: ['web-pl'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-600 font-medium">
          Total: <span className="text-red-600 font-bold">{fmt(data?.total ?? 0)}</span>
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
        >
          + Add Expense
        </button>
      </div>

       {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-red-100">
          <h3 className="font-semibold text-gray-700 mb-4">{editingId ? 'Edit Expense' : 'New Expense'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Amount (₹)</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Monthly rent"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {['cash', 'upi', 'card'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                const amt = parseFloat(amount);
                if (!amt) return;
                createMutation.mutate({ category, amount: amt, description, payment_method: payMethod });
              }}
              disabled={createMutation.isPending}
              className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm px-4 py-2 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-4 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-left px-5 py-3">Method</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.items ?? []).map((e) => (
                <tr key={e.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-600">
                    {new Date(e.entry_date).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-5 py-3">
                    <span className="capitalize bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs">
                      {e.category}
                    </span>
                    {e.is_auto_entry && (
                      <span className="ml-2 bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">auto</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600 max-w-[200px] truncate">{e.description ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 capitalize">{e.payment_method}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmt(e.amount)}</td>
                   <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {!e.is_auto_entry && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(e.id);
                              setCategory(e.category);
                              setAmount(String(e.amount));
                              setDescription(e.description || '');
                              setPayMethod(e.payment_method);
                              setShowForm(true);
                            }}
                            className="text-violet-600 hover:text-violet-800 transition-colors text-xs font-bold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { if(confirm('Delete this expense?')) deleteMutation.mutate(e.id); }}
                            className="text-red-400 hover:text-red-600 transition-colors text-xs"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.items ?? []).length === 0 && (
            <p className="text-center text-gray-400 py-10 text-sm">No expenses recorded</p>
          )}
        </div>
      )}
    </div>
  );
}

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

// ─────────────────────────────────────────────────────────────────────────────
function SuppliersTab({ shopGstType }: { shopGstType?: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [pos, setPos] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const supplierImportRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<Supplier[]>({
    queryKey: ['web-suppliers'],
    queryFn: () => accountingApi.listSuppliers().then((r) => r.data.data),
  });

  const { data: ledger } = useQuery({
    queryKey: ['web-supplier-ledger', expandedId],
    queryFn: () => accountingApi.getSupplierLedger(expandedId!).then((r) => r.data.data),
    enabled: !!expandedId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => accountingApi.updateSupplier(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-suppliers'] });
      setShowForm(false);
      resetForm();
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: object) => accountingApi.createSupplier(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-suppliers'] });
      setShowForm(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setSupplierName('');
    setContactPerson('');
    setPhone('');
    setCity('');
    setPos('');
    setAddress('');
    setGstin('');
    setOpeningBalance('');
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s.id);
    setSupplierName(s.name);
    setContactPerson(s.contact_person ?? '');
    setPhone(s.phone ?? '');
    setCity(s.city ?? '');
    setPos(s.state ?? '');
    setAddress(s.address ?? '');
    setGstin(s.gstin ?? s.gst_number ?? '');
    setOpeningBalance('');
    setShowForm(true);
  };

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deactivateSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['web-suppliers'] }),
  });

  const importMutation = useMutation({
    mutationFn: (items: any[]) => accountingApi.importSuppliers(items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-suppliers'] });
      alert('Suppliers imported successfully!');
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Import failed'),
  });

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let items = [];
      if (file.name.endsWith('.json')) items = JSON.parse(text);
      else items = parseCsv(text);
      if (items.length > 0) importMutation.mutate(items);
    } catch (err) { alert('Failed to parse file'); }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3 items-center">
        <button
          onClick={() => downloadCsv('suppliers_template.csv', 'name,contact_person,phone,city,gstin,state,opening_balance\n"Supplier A","John Doe","9876543210","Mumbai","27AAACR0345E1ZZ","Maharashtra",0')}
          className="text-[10px] text-indigo-400 font-bold uppercase hover:underline"
        >
          Download Template
        </button>
        <input type="file" ref={supplierImportRef} onChange={handleImportFile} accept=".csv,.json" className="hidden" />
        <button
          onClick={() => supplierImportRef.current?.click()}
          disabled={importMutation.isPending}
          className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center gap-2"
        >
          {importMutation.isPending ? 'Importing...' : 'Bulk Import'}
        </button>
        <button
          onClick={() => { resetForm(); setShowForm((v) => !v); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {showForm ? 'Close Form' : '+ Add Supplier'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100">
          <h3 className="font-semibold text-gray-700 mb-4">{editingId ? 'Edit Supplier' : 'New Supplier'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Supplier Name *', value: supplierName, set: setSupplierName, placeholder: 'Medico Pharma' },
              { label: 'Contact Person', value: contactPerson, set: setContactPerson, placeholder: 'Raj Kumar' },
              { label: 'Phone', value: phone, set: setPhone, placeholder: '9876543210' },
              { label: 'City', value: city, set: setCity, placeholder: 'Mumbai' },
              { label: 'GSTIN', value: gstin, set: setGstin, placeholder: '27AAACR0345E1ZZ' },
              ...(shopGstType === 'regular' ? [
                { label: 'Place of Supply', value: pos, set: setPos },
                { label: 'Address', value: address, set: setAddress, placeholder: 'Full address' }
              ] : []),
            ].map((f) => (
              <div key={f.label}>
                <label className="text-gray-500 text-xs block mb-1">{f.label}</label>
                {f.label === 'Place of Supply' ? (
                  <select
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                )}
              </div>
            ))}
            <div>
              <label className="text-gray-500 text-xs block mb-1">Opening Balance (₹)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-semibold text-red-600"
              />
              <p className="text-[10px] text-gray-400 mt-1 italic">Amount you currently owe this supplier</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                if (!supplierName.trim()) return;
                const payload: any = {
                  name: supplierName.trim(),
                  contact_person: contactPerson.trim() || undefined,
                  phone: phone.trim() || undefined,
                  city: city.trim() || undefined,
                  state: pos.trim() || undefined,
                  address: address.trim() || undefined,
                  gst_number: gstin.trim() || undefined,
                };

                if (editingId) {
                  updateMutation.mutate({ id: editingId, data: payload });
                } else {
                  payload.opening_balance = parseFloat(openingBalance) || 0;
                  createMutation.mutate(payload);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm px-4 py-2 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-5 py-3">Supplier</th>
                <th className="text-left px-5 py-3">Contact</th>
                <th className="text-left px-5 py-3">City</th>
                <th className="text-left px-5 py-3">GSTIN</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data ?? []).map((s) => (
                <>
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-3 text-gray-600">{s.contact_person ?? '—'}{s.phone ? ` · ${s.phone}` : ''}</td>
                    <td className="px-5 py-3 text-gray-500">{s.city ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.gst_number ?? s.gstin ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => startEdit(s)}
                        className="text-indigo-400 hover:text-indigo-600 text-xs mr-4 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        className="text-gray-400 hover:text-indigo-700 text-xs mr-4 transition-colors"
                      >
                        {expandedId === s.id ? 'Hide Ledger' : 'View Ledger'}
                      </button>
                      <button
                        onClick={() => deactivateMutation.mutate(s.id)}
                        className="text-red-400 hover:text-red-600 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  {expandedId === s.id && ledger && (
                    <tr key={`${s.id}-ledger`}>
                      <td colSpan={5} className="px-5 py-4 bg-indigo-50">
                        <div className="flex gap-6 mb-3">
                          <div>
                            <p className="text-xs text-gray-500">Total Purchased</p>
                            <p className="font-bold text-gray-800">{fmt(ledger.summary?.total_purchased ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Outstanding</p>
                            <p className="font-bold text-red-600">{fmt(ledger.summary?.outstanding ?? 0)}</p>
                          </div>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {(ledger.ledger as any[])?.map((entry: any) => (
                            <div key={entry.id} className="flex justify-between text-xs text-gray-600 bg-white rounded-lg px-3 py-2">
                              <span>{new Date(entry.date).toLocaleDateString('en-IN')} · {entry.note}</span>
                              <span className={entry.type === 'purchase' ? 'text-blue-600 font-semibold' : 'text-green-600 font-semibold'}>
                                {entry.type === 'purchase' ? '-' : '+'}{fmt(entry.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && (
            <p className="text-center text-gray-400 py-10 text-sm">No suppliers added</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Purchases Tab
// ─────────────────────────────────────────────────────────────────────────────

const GST_RATES = ['0', '5', '12', '18', '28'];
const PI_UNITS = ['strip', 'tablet', 'capsule', 'bottle', 'syrup', 'injection', 'vial', 'tube', 'cream', 'ointment', 'sachet', 'packet', 'piece', 'box'];
const EMPTY_PI_ITEM = { medicine_id: '', medicine_name: '', unit: 'strip', hsn_code: '', batch_number: '', expiry_date: '', quantity: '1', free_qty: '', purchase_price: '', mrp: '', discount_pct: '', gst_rate: '5' };
type PIItem = typeof EMPTY_PI_ITEM;

function PurchasesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  // form state
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(TODAY_STR);
  const [receivedDate, setReceivedDate] = useState(TODAY_STR);
  const [notes, setNotes] = useState('');
  const [piItems, setPiItems] = useState<PIItem[]>([{ ...EMPTY_PI_ITEM }]);
  const [suggestions, setSuggestions] = useState<Record<number, { id: string; medicine_name: string; mrp: number; gst_rate: number; hsn_code?: string; medicine_id?: string }[]>>({});
  const [suggHighlights, setSuggHighlights] = useState<Record<number, number>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const piMedRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piUnitRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const piBatchRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piExpiryRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piQtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piFreeQtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piCostRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piMrpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piDiscRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piGstRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const piAddRowBtnRef = useRef<HTMLButtonElement | null>(null);
  const piInvoiceNoRef = useRef<HTMLInputElement | null>(null);
  const piInvDateRef = useRef<HTMLInputElement | null>(null);
  const piReceivedDateRef = useRef<HTMLInputElement | null>(null);
  const piNotesRef = useRef<HTMLInputElement | null>(null);
  const [triedToSubmit, setTriedToSubmit] = useState(false);
  const [activeHsnIdx, setActiveHsnIdx] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: suppliersData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['web-suppliers'],
    queryFn: () => accountingApi.listSuppliers().then((r) => r.data.data),
  });

  const { data: listData, isLoading } = useQuery<{
    items: Purchase[];
    total: number;
    total_amount_sum: number;
    total_due_sum: number;
    top_supplier: string;
  }>({
    queryKey: ['web-purchases'],
    queryFn: () => accountingApi.listPurchases({ limit: 50 }).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => editingId ? accountingApi.updatePurchase(editingId, payload) : accountingApi.createPurchase(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-purchases'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      resetForm();
      setShowForm(false);
      setTriedToSubmit(false);
      setFormError(null);
      alert(editingId ? 'Purchase updated successfully' : 'Purchase entry created');
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Failed to save purchase'),
  });

  const loadPurchaseForEdit = (p: Purchase) => {
    setEditingId(p.id);
    setSupplierId(p.supplier_id || '');
    setInvoiceNumber(p.invoice_number || '');
    setInvoiceDate(p.invoice_date.split('T')[0]);
    setReceivedDate(p.received_date ? p.received_date.split('T')[0] : p.invoice_date.split('T')[0]);
    setNotes(p.notes || '');
    if (p.items && p.items.length > 0) {
      setPiItems(p.items.map((it: any) => ({
        medicine_id: it.medicine_id || '',
        medicine_name: it.medicine_name,
        batch_number: it.batch_number,
        expiry_date: it.expiry_date.split('T')[0],
        quantity: String(it.quantity),
        free_qty: String(it.free_qty || 0),
        purchase_price: String(it.purchase_price),
        mrp: String(it.mrp),
        discount_pct: String(it.discount_pct || 0),
        gst_rate: String(it.gst_rate || 5),
        unit: it.unit || 'strip',
        hsn_code: it.hsn_code || '',
        line_total: it.line_total
      })));
    } else {
      setPiItems([{ ...EMPTY_PI_ITEM }]);
    }
    setShowForm(true);
  };

  const handleEditClick = async (id: string) => {
    try {
      const res = await accountingApi.getPurchaseById(id);
      loadPurchaseForEdit(res.data.data);
    } catch {
      alert('Failed to load purchase details');
    }
  };

  const voidMutation = useMutation({
    mutationFn: (id: string) => accountingApi.voidPurchase(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-purchases'] });
      qc.invalidateQueries({ queryKey: ['web-outstandings'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      alert('Purchase successfully voided');
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || 'Failed to void purchase');
    }
  });

  const resetForm = () => {
    setSupplierId(''); setInvoiceNumber(''); setInvoiceDate(TODAY_STR);
    setReceivedDate(TODAY_STR); setNotes(''); setEditingId(null);
    setPiItems([{ ...EMPTY_PI_ITEM }]); setSuggestions({}); setSuggHighlights({});
  };

  const updatePiItem = (idx: number, field: keyof PIItem, value: string) => {
    setPiItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'medicine_name') {
      if (searchTimers.current[idx]) clearTimeout(searchTimers.current[idx]);
      if (value.length < 2) { setSuggestions((p) => ({ ...p, [idx]: [] })); setSuggHighlights((p) => ({ ...p, [idx]: -1 })); return; }
      searchTimers.current[idx] = setTimeout(async () => {
        try {
          const res = await inventoryApi.list({ q: value, limit: 15 });
          const invItems = res.data.data ?? [];
          if (invItems.length > 0) {
            // Group by name for the suggestion dropdown to satisfy user request "show medicine name only not batch wise"
            const grouped = new Map<string, any>();
            invItems.forEach((it: any) => {
              const key = (it.medicine_name || it.name || '').toLowerCase().trim();
              if(!grouped.has(key)) grouped.set(key, it);
            });
            setSuggestions((p) => ({ ...p, [idx]: Array.from(grouped.values()).slice(0, 8) }));
          } else {
            // Fall back to global medicine catalog for new shops / unknown medicines
            const medRes = await medicinesApi.catalog({ q: value });
            const catalogItems = (medRes.data.data ?? []).slice(0, 8).map((m: any) => ({
              id: m.id,
              medicine_id: m.id,
              medicine_name: m.name,
              mrp: 0,
              gst_rate: m.gst_rate ?? 5,
              hsn_code: m.hsn_code || '',
            }));
            setSuggestions((p) => ({ ...p, [idx]: catalogItems }));
          }
          setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
        } catch { /* ignore */ }
      }, 250);
    }
  };

  const selectSuggestion = (inv: any, idx: number) => {
    setPiItems((prev) => prev.map((it, i) =>
      i === idx ? {
        ...it,
        medicine_id: inv.medicine_id || '',
        medicine_name: inv.medicine_name || inv.name || '',
        mrp: String(inv.mrp || ''),
        gst_rate: String(inv.gst_rate ?? 12),
        unit: inv.unit ?? it.unit,
        hsn_code: inv.hsn_code || it.hsn_code
      } : it
    ));
    setSuggestions((p) => ({ ...p, [idx]: [] }));
    setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
    
    // Trigger HSN modal if hsn is missing
    if (!inv.hsn_code) {
      setActiveHsnIdx(idx);
    }

    setTimeout(() => {
      if (!piItems[idx].unit) {
        piUnitRefs.current[idx]?.focus();
      } else {
        piBatchRefs.current[idx]?.focus();
      }
    }, 0);
  };

  const addPiItem = () => setPiItems((p) => [...p, { ...EMPTY_PI_ITEM }]);
  const removePiItem = (idx: number) => setPiItems((p) => p.filter((_, i) => i !== idx));

  const clonePiItem = (idx: number) => {
    const it = piItems[idx];
    setPiItems((prev) => {
      const newList = [...prev];
      // Clone all medicine fields but clear batch, expiry and qty
      newList.splice(idx + 1, 0, {
        ...it,
        batch_number: '',
        expiry_date: '',
        quantity: '1',
        free_qty: '',
      });
      return newList;
    });
    // Focus batch field of the new row
    setTimeout(() => {
      piBatchRefs.current[idx + 1]?.focus();
    }, 100);
  };

  // Live totals
  const lineTotal = (it: PIItem) => {
    const qty = Number(it.quantity) || 0;
    const pp = Number(it.purchase_price) || 0;
    const disc = Number(it.discount_pct) || 0;
    const gst = Number(it.gst_rate) || 0;
    const base = qty * pp;
    const afterDisc = base * (1 - disc / 100);
    return afterDisc * (1 + gst / 100);
  };
  const calcSubtotal = piItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0), 0);
  const calcGst = piItems.reduce((s, it) => {
    const base = (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0) * (1 - (Number(it.discount_pct) || 0) / 100);
    return s + base * ((Number(it.gst_rate) || 0) / 100);
  }, 0);
  const calcTotal = piItems.reduce((s, it) => s + lineTotal(it), 0);

  const handleSubmit = () => {
    setTriedToSubmit(true);
    setFormError(null);

    const validItems = piItems.filter((it) => it.medicine_name.trim() !== '' || Number(it.purchase_price) > 0 || Number(it.quantity) > 0);

    if (!validItems.length) {
      setFormError('Please add at least one medicine item');
      return;
    }

    const hasIncomplete = validItems.some(it => !it.medicine_name.trim() || !it.batch_number.trim() || !it.expiry_date || Number(it.purchase_price) <= 0);
    if (hasIncomplete) {
      setFormError('Please fill missing Medicine, Batch, Expiry, and Cost for all rows');
      return;
    }

    const payload = {
      supplier_id: supplierId || undefined,
      invoice_number: invoiceNumber || undefined,
      invoice_date: invoiceDate,
      received_date: receivedDate || invoiceDate,
      notes: notes || undefined,
      items: validItems.map((it) => ({
        medicine_id: it.medicine_id || undefined,
        medicine_name: it.medicine_name.trim(),
        unit: it.unit || 'strip',
        batch_number: it.batch_number.trim(),
        expiry_date: it.expiry_date,
        quantity: Number(it.quantity),
        free_qty: Number(it.free_qty) || 0,
        purchase_price: Number(it.purchase_price),
        mrp: Number(it.mrp) || Number(it.purchase_price),
        discount_pct: Number(it.discount_pct) || 0,
        gst_rate: Number(it.gst_rate) || 5,
        hsn_code: it.hsn_code || undefined,
      })),
    };
    console.log('[DEBUGLOG] Submitting purchase payload:', payload);

    createMutation.mutate(payload);
  };

  const statusColor: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    unpaid: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-6">
      {/* ── Stats Dashboard ── */}
      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Purchases</p>
              <p className="text-xl font-black text-gray-900">{fmt(listData?.total_amount_sum ?? 0)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Outstanding Due</p>
              <p className="text-xl font-black text-red-600">{fmt(listData?.total_due_sum ?? 0)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Top Supplier</p>
              <p className="text-xl font-black text-gray-900 truncate max-w-[150px]">{listData?.top_supplier ?? 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg ${showForm ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:scale-105 active:scale-95 shadow-violet-200'}`}
        >
          {showForm ? '✕ Close Form' : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              New Purchase Invoice
            </>
          )}
        </button>
      </div>

      {/* ── New Invoice Form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-6 space-y-5">
          <h3 className="font-bold text-gray-800 text-base">{editingId ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1.5 ml-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => { setSupplierId(e.target.value); setTimeout(() => piInvoiceNoRef.current?.focus(), 0); }}
                className="w-full border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white shadow-sm transition-all"
              >
                <option value="">— Walk-in / Ad-hoc —</option>
                {(suppliersData ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1.5 ml-1">Invoice No.</label>
              <input ref={piInvoiceNoRef} type="text" placeholder="INV-001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piInvDateRef.current?.focus(); } }}
                className="w-full border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm transition-all" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1.5 ml-1">Invoice Date *</label>
              <input ref={piInvDateRef} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piReceivedDateRef.current?.focus(); } }}
                className="w-full border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm transition-all" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1.5 ml-1">Received Date</label>
              <input ref={piReceivedDateRef} type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piMedRefs.current[0]?.focus(); } }}
                className="w-full border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm transition-all" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="grid gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2" style={{ gridTemplateColumns: '2.5fr 1fr 1.5fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 80px 32px 32px' }}>
              <div>Medicine</div>
              <div>Unit</div>
              <div>Batch / Expiry</div>
              <div className="text-center">Qty</div>
              <div className="text-center">Free</div>
              <div>Cost (₹)</div>
              <div>MRP (₹)</div>
              <div className="text-center">Disc%</div>
              <div className="text-center">GST%</div>
              <div className="text-right">Line Total</div>
              <div />
              <div />
            </div>
            <div className="space-y-2">
              {piItems.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="grid gap-2 items-start" style={{ gridTemplateColumns: '2.5fr 1fr 1.5fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 80px 32px 32px' }}>
                    {/* Medicine Name with autocomplete */}
                    <div className="relative">
                      <input type="text" placeholder="Search medicine..." value={item.medicine_name}
                        ref={(el) => { piMedRefs.current[idx] = el; }}
                        onChange={(e) => updatePiItem(idx, 'medicine_name', e.target.value)}
                        onBlur={() => {
                          setTimeout(() => {
                            if (item.medicine_name.trim() && !item.medicine_id && !(suggestions[idx]?.length > 0)) {
                              setActiveHsnIdx(idx);
                            }
                            setSuggestions((p) => ({ ...p, [idx]: [] }));
                          }, 200);
                        }}
                        onKeyDown={(e) => {
                          const suggs = suggestions[idx] ?? [];
                          const h = suggHighlights[idx] ?? -1;
                          if (e.key === 'ArrowDown') { e.preventDefault(); setSuggHighlights((p) => ({ ...p, [idx]: Math.min(h + 1, suggs.length - 1) })); }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggHighlights((p) => ({ ...p, [idx]: Math.max(h - 1, 0) })); }
                          else if (e.key === 'Enter' && h >= 0 && suggs[h]) { e.preventDefault(); selectSuggestion(suggs[h], idx); }
                          else if (e.key === 'Enter' && (h < 0 || suggs.length === 0)) { 
                            e.preventDefault(); 
                            setSuggestions((p) => ({ ...p, [idx]: [] })); 
                            // If user typed a completely new name (not in suggestions)
                            if (item.medicine_name.trim() && !item.medicine_id) {
                              setActiveHsnIdx(idx);
                            }
                            piUnitRefs.current[idx]?.focus(); 
                          }
                          else if (e.key === 'Escape') {
                            setSuggestions((p) => ({ ...p, [idx]: [] }));
                            setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
                            if (!item.medicine_name.trim()) {
                              if (piItems.length > 1) {
                                removePiItem(idx);
                              }
                              setTimeout(() => piNotesRef.current?.focus(), 0);
                            }
                          }
                        }}
                        className={`w-full border rounded-xl px-3 h-10 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 font-medium ${triedToSubmit && !item.medicine_name.trim() ? 'border-red-500 bg-red-50 focus:ring-red-100' : 'border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100'}`}
                      />
                      {suggestions[idx]?.length > 0 && (
                        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1">
                          {suggestions[idx].map((s, si) => (
                            <button key={s.id} type="button" onMouseDown={() => selectSuggestion(s, idx)}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors border-b border-gray-50 last:border-0 ${si === (suggHighlights[idx] ?? -1) ? 'bg-violet-600 text-white shadow-inner' : 'hover:bg-violet-50'}`}>
                              <span className="font-semibold">{s.medicine_name}</span>
                              {s.mrp > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${si === (suggHighlights[idx] ?? -1) ? 'bg-white/20' : 'bg-violet-50 text-violet-600'}`}>₹{s.mrp}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Unit */}
                    <div>
                      <select ref={(el) => { piUnitRefs.current[idx] = el; }} value={item.unit} onChange={(e) => updatePiItem(idx, 'unit', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piBatchRefs.current[idx]?.focus(); } }}
                        className="w-full border border-gray-200 rounded-xl px-2 h-10 text-xs text-gray-900 outline-none focus:border-violet-500 bg-white cursor-pointer uppercase font-bold shadow-sm">
                        {Array.from(new Set([...PI_UNITS, item.unit].filter(Boolean))).map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    {/* Batch + Expiry stacked */}
                    <div className="flex flex-col gap-1.5">
                      <input ref={(el) => { piBatchRefs.current[idx] = el; }} type="text" placeholder="Batch" value={item.batch_number}
                        onChange={(e) => updatePiItem(idx, 'batch_number', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piExpiryRefs.current[idx]?.focus(); } }}
                        className={`w-full border rounded-xl px-3 h-10 text-xs text-gray-900 outline-none transition-all font-mono placeholder:text-gray-300 ${triedToSubmit && !item.batch_number.trim() ? 'border-red-500 bg-red-50 focus:border-red-400' : 'border-gray-200 focus:border-violet-500'}`}
                      />
                      <input ref={(el) => { piExpiryRefs.current[idx] = el; }} type="date" value={item.expiry_date}
                        onChange={(e) => updatePiItem(idx, 'expiry_date', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piQtyRefs.current[idx]?.focus(); } }}
                        className={`w-full border rounded-xl px-2 h-10 text-xs text-gray-900 outline-none transition-all ${triedToSubmit && !item.expiry_date ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-violet-500'}`}
                      />
                    </div>
                    <div>
                      <input ref={(el) => { piQtyRefs.current[idx] = el; }} type="number" min="1" value={item.quantity} onChange={(e) => updatePiItem(idx, 'quantity', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piFreeQtyRefs.current[idx]?.focus(); } }}
                        className="w-full border border-gray-200 rounded-xl px-1 h-10 text-sm font-bold text-gray-900 outline-none focus:border-violet-500 text-center shadow-sm" />
                    </div>
                    <div>
                      <input ref={(el) => { piFreeQtyRefs.current[idx] = el; }} type="number" min="0" placeholder="0" value={item.free_qty} onChange={(e) => updatePiItem(idx, 'free_qty', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piCostRefs.current[idx]?.focus(); } }}
                        className="w-full border border-gray-200 rounded-xl px-1 h-10 text-sm italic text-gray-500 outline-none focus:border-violet-500 text-center shadow-sm" />
                    </div>
                    <div>
                      <input ref={(el) => { piCostRefs.current[idx] = el; }} type="number" min="0" step="0.01" placeholder="0.00" value={item.purchase_price} onChange={(e) => updatePiItem(idx, 'purchase_price', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piMrpRefs.current[idx]?.focus(); } }}
                        className={`w-full border rounded-xl px-2 h-10 text-sm font-bold outline-none transition-all ${triedToSubmit && Number(item.purchase_price) <= 0 ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-indigo-600 focus:border-indigo-500'}`} />
                    </div>
                    <div>
                      <input ref={(el) => { piMrpRefs.current[idx] = el; }} type="number" min="0" step="0.01" placeholder="0.00" value={item.mrp} onChange={(e) => updatePiItem(idx, 'mrp', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (idx === piItems.length - 1) {
                              addPiItem();
                              setTimeout(() => piMedRefs.current[idx + 1]?.focus(), 0);
                            } else {
                              piMedRefs.current[idx + 1]?.focus();
                            }
                          }
                        }}
                        className="w-full border border-gray-200 rounded-xl px-2 h-10 text-sm font-black text-violet-700 outline-none focus:border-violet-500 shadow-sm" />
                    </div>
                    <div>
                      <input ref={(el) => { piDiscRefs.current[idx] = el; }} type="number" min="0" max="100" placeholder="0" value={item.discount_pct} onChange={(e) => updatePiItem(idx, 'discount_pct', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piGstRefs.current[idx]?.focus(); } }}
                        className="w-full border border-gray-200 rounded-xl px-1 h-10 text-sm text-center text-emerald-600 font-bold outline-none focus:border-emerald-500 shadow-sm" />
                    </div>
                    <div>
                      <select ref={(el) => { piGstRefs.current[idx] = el; }} value={item.gst_rate} onChange={(e) => updatePiItem(idx, 'gst_rate', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-1 h-10 text-xs text-gray-900 outline-none focus:border-violet-500 bg-white font-semibold shadow-sm">
                        {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div className="pt-2.5 text-right font-black text-gray-900 text-sm font-mono truncate">
                      {lineTotal(item) > 0 ? fmt(lineTotal(item)) : '—'}
                    </div>
                    <div className="pt-2">
                      <button onClick={() => clonePiItem(idx)} title="Add Multiple Batches"
                        className="w-8 h-8 rounded-full text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      </button>
                    </div>
                    <div className="pt-2">
                      <button onClick={() => removePiItem(idx)} disabled={piItems.length === 1}
                        className="w-8 h-8 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-10 flex items-center justify-center transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button ref={piAddRowBtnRef}
              onClick={() => { addPiItem(); setTimeout(() => piMedRefs.current[piItems.length]?.focus(), 0); }}
              className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Row
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Notes (optional)</label>
            <input ref={piNotesRef} type="text" placeholder="e.g. Credit 30 days" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          {/* Summary + Submit */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-dashed border-gray-200">
            <div className="bg-violet-50/50 rounded-2xl p-5 border border-violet-100 flex gap-10">
              <div>
                <p className="text-[10px] uppercase font-bold text-violet-400 tracking-wider mb-1">Taxable Subtotal</p>
                <p className="text-lg font-black text-violet-900">{fmt(calcSubtotal)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-violet-400 tracking-wider mb-1">GST Amount</p>
                <p className="text-lg font-black text-violet-900">+{fmt(calcGst)}</p>
              </div>
              <div className="px-6 border-l border-violet-100">
                <p className="text-[10px] uppercase font-bold text-violet-400 tracking-wider mb-1">Net Invoice Total</p>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-700 to-indigo-700">{fmt(calcTotal)}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="text-gray-500 text-sm font-bold px-6 py-3 hover:text-gray-900 transition-colors">Discard Changes</button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !piItems.some((it) => it.medicine_name && it.batch_number && it.expiry_date && Number(it.purchase_price) > 0)}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-10 py-3 rounded-2xl text-sm font-black shadow-xl shadow-violet-200 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
              >
                {createMutation.isPending ? 'Processing…' : editingId ? 'Update Invoice' : 'Finalize & Save Invoice'}
              </button>
            </div>
          </div>
          {(createMutation.isError || formError) && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm mt-4">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              {createMutation.isError ? ((createMutation.error as any)?.response?.data?.error?.message ?? 'Failed to save. Please try again.') : formError}
            </div>
          )}
        </div>
      )}

      {/* ── Purchase History List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b border-gray-100">
                <th className="text-left px-6 py-4">Supplier</th>
                <th className="text-left px-6 py-4">Invoice Detail</th>
                <th className="text-left px-6 py-4">Date</th>
                <th className="text-right px-6 py-4">Invoice Value</th>
                <th className="text-right px-6 py-4">Amount Paid</th>
                <th className="text-right px-6 py-4">Outstanding</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(listData?.items ?? []).map((p) => (
                <tr key={p.id} onClick={() => setSelectedPurchaseId(p.id)} className="hover:bg-violet-50/30 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{p.supplier?.name ?? '—'}</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-tight">{p.supplier ? 'Supplier' : 'Ad-hoc'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg font-mono text-xs font-bold">{p.invoice_number ?? 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{new Date(p.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-6 py-4 text-right font-black text-gray-900">{fmt(p.total_amount)}</td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-bold">{fmt(p.amount_paid)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-black ${p.total_amount - p.amount_paid > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                      {fmt(p.total_amount - p.amount_paid)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${p.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      p.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {p.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedPurchaseId(p.id); }} title="View Details" className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-violet-600 hover:border-violet-200 transition-all shadow-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleEditClick(p.id); }} title="Edit Invoice" className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </button>
                      {p.payment_status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if(confirm('Confirm VOID this purchase? Inventory will be reversed.')) voidMutation.mutate(p.id);
                          }}
                          disabled={voidMutation.isPending}
                          className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.34 9m-4.74 0L9.26 9m9.96-2.14c.88.14 1.53.58 1.53 1.14v0c0 .56-.65 1-1.53 1.14m-16.92 0c-.88-.14-1.53-.58-1.53-1.14v0c0-.56.65-1 1.53-1.14m1.14-2.14A1.875 1.875 0 015.25 4.5h11.5a1.875 1.875 0 011.875 1.875v14.25A1.875 1.875 0 0116.75 22.5H7.25A1.875 1.875 0 015.375 20.625V6.375z" /></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(listData?.items ?? []).length === 0 && (
            <div className="text-center py-20 bg-gray-50/30">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              </div>
              <p className="text-gray-400 text-sm font-medium">No purchase entries yet.</p>
              <button onClick={() => setShowForm(true)} className="mt-4 text-violet-600 font-bold hover:underline text-sm">Record your first invoice</button>
            </div>
          )}
        </div>
      )}

      {selectedPurchaseId && (
        <PurchaseDetailModal id={selectedPurchaseId} onClose={() => setSelectedPurchaseId(null)} onEdit={(p) => { setSelectedPurchaseId(null); loadPurchaseForEdit(p); }} />
      )}

      {activeHsnIdx !== null && (
        <HsnEntryModal 
          medicineName={piItems[activeHsnIdx].medicine_name}
          onSave={(hsn) => {
            const idx = activeHsnIdx;
            updatePiItem(idx, 'hsn_code', hsn);
            setActiveHsnIdx(null);
            // Re-focus the batch field after modal closes
            setTimeout(() => {
              piBatchRefs.current[idx]?.focus();
            }, 50);
          }}
          onCancel={() => {
            const idx = activeHsnIdx;
            setActiveHsnIdx(null);
            setTimeout(() => {
              piBatchRefs.current[idx]?.focus();
            }, 50);
          }}
        />
      )}
    </div>
  );
}

function PurchaseDetailModal({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (p: Purchase) => void }) {
  const qc = useQueryClient();
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [showPayForm, setShowPayForm] = useState(false);

  const { data: p, isLoading } = useQuery<any>({
    queryKey: ['web-purchase-detail', id],
    queryFn: () => accountingApi.getPurchaseById(id).then((r) => r.data.data),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => accountingApi.voidPurchase(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-purchases'] });
      qc.invalidateQueries({ queryKey: ['web-outstandings'] });
      alert('Purchase successfully voided');
      onClose();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || 'Failed to void purchase');
    }
  });

  const payMutation = useMutation({
    mutationFn: (d: any) => accountingApi.recordSupplierPayment(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-purchase-detail', id] });
      qc.invalidateQueries({ queryKey: ['web-purchases'] });
      qc.invalidateQueries({ queryKey: ['web-outstandings'] });
      setPayAmount('');
      setShowPayForm(false);
    },
  });

  if (isLoading) return null;

  const balanceDue = Math.max(0, Number(p?.total_amount) - Number(p?.amount_paid));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-8 border-b border-gray-100 flex items-start justify-between relative overflow-hidden bg-gray-50/50">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2.5 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Purchase Invoice</span>
              <span className="text-gray-400 font-mono text-sm font-bold">#{p?.invoice_number || 'N/A'}</span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{p?.supplier?.name ?? 'Walk-in Supplier'}</h2>
            <div className="flex gap-4 mt-2 text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                Invoice Date: {new Date(p?.invoice_date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.129-1.125V3.375c0-.621-.508-1.125-1.129-1.125H16.125M16.125 14.25h2.25m-2.25 0H6.75m0 0V4.875c0-.621.504-1.125 1.125-1.125h12.75c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125h-4.5" /></svg>
                Received: {new Date(p?.received_date).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(p)}
              className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-300 hover:text-amber-500 hover:border-amber-200 transition-all shadow-sm"
              title="Edit Invoice"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
            </button>
            {p?.payment_status === 'pending' && (
              <button
                onClick={() => { if(confirm('Confirm VOID this purchase? Inventory will be reversed.')) voidMutation.mutate(p.id); }}
                disabled={voidMutation.isPending}
                className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-300 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                title="Void Purchase"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.34 9m-4.74 0L9.26 9m9.96-2.14c.88.14 1.53.58 1.53 1.14v0c0 .56-.65 1-1.53 1.14m-16.92 0c-.88-.14-1.53-.58-1.53-1.14v0c0-.56.65-1 1.53-1.14m1.14-2.14A1.875 1.875 0 015.25 4.5h11.5a1.875 1.875 0 011.875 1.875v14.25A1.875 1.875 0 0116.75 22.5H7.25A1.875 1.875 0 015.375 20.625V6.375z" /></svg>
              </button>
            )}
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors shadow-sm">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {/* Items Table */}
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Itemized Breakdown</h4>
            <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-5 py-4">Medicine & Batch</th>
                    <th className="px-5 py-4">Expiry</th>
                    <th className="px-5 py-4 text-center">Batch Details</th>
                    <th className="px-5 py-4 text-right">Cost × Qty</th>
                    <th className="px-5 py-4 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {p?.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">{item.medicine_name}</p>
                        <p className="text-[10px] font-mono text-gray-400">BATCH: {item.batch_number}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-600 font-medium">
                        {new Date(item.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-lg">
                          MRP: {fmt(item.mrp)} · {item.gst_rate}% GST
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="font-medium text-gray-900">{fmt(item.purchase_price)} × {item.quantity}</p>
                        {item.free_qty > 0 && <p className="text-[10px] text-emerald-500 font-bold">+{item.free_qty} FREE</p>}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-gray-900">{fmt(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Payments History */}
            {/* Payments History & Action */}
            <div className="space-y-6">
              {p?.payments?.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Payment History</h4>
                  <div className="space-y-3">
                    {p.payments.map((pm: any) => (
                      <div key={pm.id} className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 capitalize">{pm.payment_method}</p>
                            <p className="text-[10px] text-gray-400">{new Date(pm.payment_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-emerald-700">{fmt(pm.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {balanceDue > 0 && (
                <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100 shadow-inner">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight">Quick Payment</h4>
                    {!showPayForm && (
                      <button onClick={() => { setShowPayForm(true); setPayAmount(String(balanceDue)); }} className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:underline">Record Payment</button>
                    )}
                  </div>

                  {showPayForm ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">Amount (₹)</label>
                        <input
                          type="number"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 h-11 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-violet-400 outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {['cash', 'upi', 'card'].map((m) => (
                          <button
                            key={m}
                            onClick={() => setPayMethod(m)}
                            className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${payMethod === m ? 'bg-violet-600 text-white shadow-lg shadow-violet-100' : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            const amt = parseFloat(payAmount);
                            if (!amt || amt <= 0) return;
                            payMutation.mutate({
                              supplier_id: p.supplier_id,
                              purchase_id: id,
                              amount: amt,
                              payment_method: payMethod,
                              payment_date: TODAY_STR,
                            });
                          }}
                          disabled={payMutation.isPending}
                          className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white h-11 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-violet-100 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                        >
                          {payMutation.isPending ? 'Processing...' : 'Confirm Payment'}
                        </button>
                        <button onClick={() => setShowPayForm(false)} className="px-4 h-11 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-white transition-all">Cancel</button>
                      </div>
                      {payMutation.isError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-[10px] font-bold border border-red-100 animate-in fade-in slide-in-from-top-1">
                          {(payMutation.error as any)?.response?.data?.error?.message || 'Failed to record payment'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-50">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Remaining Balance</p>
                        <p className="text-base font-black text-gray-900">{fmt(balanceDue)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Final Summary Card */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-violet-200 ml-auto w-full max-w-sm">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-white/70 text-sm font-medium"><span>Subtotal</span><span>{fmt(p?.subtotal)}</span></div>
                <div className="flex justify-between text-white/70 text-sm font-medium"><span>GST Total</span><span>+{fmt(p?.gst_amount)}</span></div>
                {p?.discount_amount > 0 && <div className="flex justify-between text-white/70 text-sm font-medium"><span>Total Discount</span><span>−{fmt(p?.discount_amount)}</span></div>}
              </div>
              <div className="pt-6 border-t border-white/10">
                <div className="flex justify-between items-baseline mb-4">
                  <span className="text-white/80 font-bold uppercase tracking-widest text-[10px]">Grand Total</span>
                  <span className="text-3xl font-black">{fmt(p?.total_amount)}</span>
                </div>
                <div className="flex justify-between text-white/70 text-sm font-medium">
                  <span>Amount Paid</span>
                  <span className="text-emerald-300 font-black">{fmt(p?.amount_paid)}</span>
                </div>
                {Number(p?.total_amount) - Number(p?.amount_paid) > 0 && (
                  <div className="flex justify-between text-white/70 text-sm font-bold mt-2 pt-2 border-t border-white/5">
                    <span>Balance Due</span>
                    <span className="text-rose-300 text-xl font-black">{fmt(Number(p?.total_amount) - Number(p?.amount_paid))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 px-8">
          <button onClick={onClose} className="bg-white px-8 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-all">Close</button>
          {/* Add dynamic bill print/export button here if needed */}
        </div>
      </div>
    </div>
  );
}

function SaleReturnDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: r, isLoading } = useQuery<any>({
    queryKey: ['web-sale-return-detail', id],
    queryFn: () => accountingApi.getSaleReturnById(id).then((res) => res.data.data),
  });

  if (isLoading || !r) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200 print-only" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-8 border-b border-gray-100 flex items-start justify-between relative overflow-hidden bg-orange-50/50">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c0 .621 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2.5 py-1 bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Credit Note (Sale Return)</span>
              <span className="text-gray-400 font-mono text-sm font-bold">#{r.return_number}</span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{r.customer_name ?? 'Walk-in Customer'}</h2>
            <div className="flex gap-4 mt-2 text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                Return Date: {new Date(r.return_date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3" /></svg>
                Refund: {r.refund_method.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.89l-4.72-4.72m0 0l4.72-4.72M2 9.17h18a2 2 0 012 2v10.99" /></svg>
              Print Credit Note
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors shadow-sm">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar print:p-0">
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Returned Items</h4>
            <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-5 py-4">Medicine & Batch</th>
                    <th className="px-5 py-4 text-center">GST</th>
                    <th className="px-5 py-4 text-right">MRP × Qty</th>
                    <th className="px-5 py-4 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {r.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">{item.medicine_name}</p>
                        <p className="text-[10px] font-mono text-gray-400">BATCH: {item.batch_number || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-center text-gray-600 font-medium">
                        {item.gst_rate}%
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="font-medium text-gray-900">{fmt(item.mrp)} × {item.quantity}</p>
                        {Number(item.discount_pct) > 0 && <p className="text-[10px] text-orange-500 font-bold">-{item.discount_pct}% OFF</p>}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-gray-900">{fmt(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-orange-50/30">
                  <tr>
                    <td colSpan={3} className="px-5 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Total Refund Value</td>
                    <td className="px-5 py-4 text-right font-black text-orange-600 text-lg">{fmt(r.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {r.reason && (
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2">Reason for Return</h4>
              <p className="text-sm text-blue-900 font-medium">{r.reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PurchaseReturnDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: r, isLoading } = useQuery<any>({
    queryKey: ['web-purchase-return-detail', id],
    queryFn: () => accountingApi.getPurchaseReturnById(id).then((res) => res.data.data),
  });

  if (isLoading || !r) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200 print-only" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-8 border-b border-gray-100 flex items-start justify-between relative overflow-hidden bg-rose-50/50">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c0 .621 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Debit Note (Purchase Return)</span>
              <span className="text-gray-400 font-mono text-sm font-bold">#{r.return_number}</span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{r.supplier?.name ?? '—'}</h2>
            <div className="flex gap-4 mt-2 text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                Return Date: {new Date(r.return_date).toLocaleDateString()}
              </span>
              {r.invoice_ref && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Invoice Ref: {r.invoice_ref}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.89l-4.72-4.72m0 0l4.72-4.72M2 9.17h18a2 2 0 012 2v10.99" /></svg>
              Print Debit Note
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors shadow-sm">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar print:p-0">
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Returned Items</h4>
            <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-5 py-4">Medicine & Batch</th>
                    <th className="px-5 py-4 text-center">GST</th>
                    <th className="px-5 py-4 text-right">Price × Qty</th>
                    <th className="px-5 py-4 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {r.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">{item.medicine_name}</p>
                        <p className="text-[10px] font-mono text-gray-400">BATCH: {item.batch_number || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-center text-gray-600 font-medium">
                        {item.gst_rate}%
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="font-medium text-gray-900">{fmt(item.purchase_price)} × {item.quantity}</p>
                      </td>
                      <td className="px-5 py-4 text-right font-black text-gray-900">{fmt(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-rose-50/30">
                  <tr>
                    <td colSpan={3} className="px-5 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Grand Total Value</td>
                    <td className="px-5 py-4 text-right font-black text-rose-600 text-lg">{fmt(r.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {r.reason && (
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
              <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Reason for Return</h4>
              <p className="text-sm text-amber-900 font-medium">{r.reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Outstandings Tab
// ─────────────────────────────────────────────────────────────────────────────
function OutstandingsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<'customer' | 'supplier' | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [customerLimit, setCustomerLimit] = useState('');
  const [customerOpening, setCustomerOpening] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const customerImportRef = useRef<HTMLInputElement>(null);

  const { data: out, isLoading, error, isError } = useQuery({
    queryKey: ['web-outstandings'],
    queryFn: () => accountingApi.getOutstandings().then((r) => r.data.data),
  });

  const { data: customerLedger } = useQuery({
    queryKey: ['web-credit-ledger', expandedId],
    queryFn: () => accountingApi.getCreditLedger(expandedId!).then((r) => r.data.data),
    enabled: !!expandedId && expandedType === 'customer',
  });

  const { data: supplierLedger } = useQuery({
    queryKey: ['web-supplier-ledger', expandedId],
    queryFn: () => accountingApi.getSupplierLedger(expandedId!).then((r) => r.data.data),
    enabled: !!expandedId && expandedType === 'supplier',
  });

  const payMutation = useMutation({
    mutationFn: (d: { id: string; amount: number; method: string }) =>
      expandedType === 'customer'
        ? accountingApi.recordCreditPayment(d.id, { amount: d.amount, payment_method: d.method })
        : accountingApi.recordSupplierPayment({ supplier_id: d.id, amount: d.amount, payment_method: d.method, payment_date: TODAY_STR }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-outstandings'] });
      qc.invalidateQueries({ queryKey: ['web-pl'] });
      if (expandedType === 'customer') qc.invalidateQueries({ queryKey: ['web-credit-ledger', expandedId] });
      else qc.invalidateQueries({ queryKey: ['web-supplier-ledger', expandedId] });
      setPayAmount('');
    },
  });

   const createCustomerMutation = useMutation({
    mutationFn: (d: any) => editingCustomerId ? accountingApi.updateCreditCustomer(editingCustomerId, d) : accountingApi.createCreditCustomer(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-outstandings'] });
      setShowCustomerForm(false);
      setEditingCustomerId(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerNotes('');
      setCustomerLimit('');
      setCustomerOpening('');
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteCreditCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-outstandings'] });
      alert('Customer deactivated');
    },
  });

  const importCustomersMutation = useMutation({
    mutationFn: (items: any[]) => accountingApi.importCreditCustomers(items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-outstandings'] });
      alert('Customers imported successfully!');
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Import failed'),
  });

  const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let items = [];
      if (file.name.endsWith('.json')) items = JSON.parse(text);
      else items = parseCsv(text);
      if (items.length > 0) importCustomersMutation.mutate(items);
    } catch (err) { alert('Failed to parse file'); }
    if (e.target) e.target.value = '';
  };

  const receivables = (out?.receivables ?? []).filter((r: any) =>
    (Number(r.total_outstanding) !== 0) &&
    ((r.name || '').toLowerCase().includes(search.toLowerCase()) || (r.phone && r.phone.includes(search)))
  );

  const payables = (out?.payables ?? []).filter((p: any) =>
    (Number(p.total_outstanding) !== 0) &&
    ((p.name || '').toLowerCase().includes(search.toLowerCase()))
  );

  const totalRec = (out?.receivables ?? []).reduce((s: number, r: any) => s + Number(r.total_outstanding || 0), 0);
  const totalPay = (out?.payables ?? []).reduce((s: number, p: any) => s + Number(p.total_outstanding || 0), 0);

  const toggleExpand = (id: string, type: 'customer' | 'supplier') => {
    if (expandedId === id && expandedType === type) {
      setExpandedId(null);
      setExpandedType(null);
    } else {
      setExpandedId(id);
      setExpandedType(type);
      setPayAmount('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-medium animate-pulse">Fetching outstandings...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-100 p-8 rounded-3xl text-center">
        <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 className="text-red-800 font-black mb-1">Failed to load data</h3>
        <p className="text-red-600/70 text-sm mb-4">{(error as any)?.response?.data?.error?.message || (error as any)?.message || 'Connection error'}</p>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['web-outstandings'] })} className="bg-red-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-colors">Try Again</button>
      </div>
    );
  }

  const overdueCount = (out?.receivables ?? []).filter((r: any) => r.overdue).length;

  return (
    <div className="space-y-6">
      {overdueCount > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 flex items-center justify-between animate-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h4 className="text-rose-900 font-black tracking-tight">Outstanding Alert</h4>
              <p className="text-rose-600/70 text-xs font-medium uppercase tracking-widest">{overdueCount} customer(s) have not cleared dues in 30+ days.</p>
            </div>
          </div>
          <p className="text-rose-900/40 text-[10px] font-black uppercase tracking-widest mr-4">Action required</p>
        </div>
      )}

      {/* Search and Summary */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 text-gray-900">
          <input
            type="text"
            placeholder="Search customer or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none shadow-sm transition-all"
          />
          <svg className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-4 items-center">
          {!showCustomerForm && (
            <div className="flex gap-4 items-center">
              <button
                onClick={() => downloadCsv('customers_template.csv', 'name,phone,address,notes,credit_limit,opening_balance\n"Ramesh Chandra","9876543210","Sector 12, Janakpuri","",5000,0')}
                className="text-[10px] text-emerald-400 font-bold uppercase hover:underline"
              >
                Template
              </button>
              <div className="flex gap-2">
                <input type="file" ref={customerImportRef} onChange={handleImportCustomers} accept=".csv,.json" className="hidden" />
                <button
                  onClick={() => customerImportRef.current?.click()}
                  disabled={importCustomersMutation.isPending}
                  className="bg-white text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm"
                >
                  {importCustomersMutation.isPending ? 'Importing...' : 'Bulk Import'}
                </button>
                <button
                  onClick={() => setShowCustomerForm(true)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  + Add Customer
                </button>
              </div>
            </div>
          )}
          <div className="hidden md:flex gap-4">
            <div className="bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Receivables</p>
              <p className="text-lg font-black text-emerald-700">{fmt(totalRec)}</p>
            </div>
            <div className="bg-rose-50 px-5 py-2.5 rounded-2xl border border-rose-100">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Payables</p>
              <p className="text-lg font-black text-rose-700">{fmt(totalPay)}</p>
            </div>
          </div>
        </div>
      </div>

       {showCustomerForm && (
        <div className="bg-white rounded-[2rem] p-8 border border-emerald-100 shadow-xl shadow-emerald-50 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">{editingCustomerId ? 'Edit Credit Customer' : 'Register New Credit Customer'}</h3>
            <button onClick={() => setShowCustomerForm(false)} className="text-gray-400 hover:text-gray-900 transition-colors">✕</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Full Name *</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Ramesh Chandra" className="w-full border border-gray-200 rounded-xl px-4 h-11 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Phone Number</label>
              <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="10-digit mobile" className="w-full border border-gray-200 rounded-xl px-4 h-11 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Opening Balance (₹)</label>
              <input type="number" value={customerOpening} onChange={(e) => setCustomerOpening(e.target.value)} placeholder="0.00" className="w-full border border-emerald-100 bg-emerald-50/30 rounded-xl px-4 h-11 text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none transition-all" />
              <p className="text-[9px] text-emerald-600 mt-1 italic font-medium">Initial amount this customer owes you</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Address</label>
              <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Street, City, Area" className="w-full border border-gray-200 rounded-xl px-4 h-11 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Credit Limit</label>
              <input type="number" value={customerLimit} onChange={(e) => setCustomerLimit(e.target.value)} placeholder="5000" className="w-full border border-gray-200 rounded-xl px-4 h-11 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition-all" />
            </div>
          </div>
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => {
                if (!customerName.trim()) return;
                createCustomerMutation.mutate({
                  name: customerName,
                  phone: customerPhone || undefined,
                  address: customerAddress || undefined,
                  notes: customerNotes || undefined,
                  credit_limit: parseFloat(customerLimit) || 0,
                  opening_balance: parseFloat(customerOpening) || 0,
                });
              }}
              disabled={createCustomerMutation.isPending || !customerName.trim()}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
             >
              {createCustomerMutation.isPending ? 'Saving...' : editingCustomerId ? 'Update Customer' : 'Register Customer'}
            </button>
            <button onClick={() => setShowCustomerForm(false)} className="text-gray-400 text-xs font-black uppercase tracking-widest px-6 py-3 hover:text-gray-900 transition-colors">Discard</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Receivables Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shadow-sm">IN</div>
            <h3 className="font-black text-gray-800 tracking-tight uppercase text-xs">Customer Dues (Receivables)</h3>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="text-left px-5 py-4">Customer</th>
                  <th className="text-right px-5 py-4">Balance</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {receivables.map((c: any) => (
                  <Fragment key={c.id}>
                    <tr onClick={() => toggleExpand(c.id, 'customer')} className={`group cursor-pointer transition-all ${c.overdue ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-violet-50/30'} ${expandedId === c.id ? (c.overdue ? 'bg-rose-50' : 'bg-violet-50/50') : ''}`}>
                      <td className="px-5 py-4">
                        <p className={`font-bold transition-colors ${c.overdue ? 'text-rose-900 group-hover:text-rose-700' : 'text-gray-800 group-hover:text-violet-700'}`}>{c.name}</p>
                        <p className={`text-[10px] font-medium ${c.overdue ? 'text-rose-400' : 'text-gray-400'}`}>{c.phone || 'No phone'}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className={`font-black ${c.overdue ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(c.total_outstanding)}</p>
                        {c.overdue && (
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">Overdue 30d+</span>
                          </div>
                        )}
                      </td>
                       <td className="pr-4 text-gray-300 transition-colors">
                        <div className="flex items-center gap-1">
                          {!c.id.startsWith('pending-') && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCustomerId(c.id);
                                  setCustomerName(c.name);
                                  setCustomerPhone(c.phone || '');
                                  setCustomerAddress(c.address || '');
                                  setCustomerNotes(c.notes || '');
                                  setCustomerLimit(String(c.credit_limit || ''));
                                  setCustomerOpening(String(c.opening_balance || '0'));
                                  setShowCustomerForm(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if(confirm(`Deactivate ${c.name}?`)) deleteCustomerMutation.mutate(c.id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          )}
                          <svg className={`w-4 h-4 transition-transform ${expandedId === c.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                      </td>
                    </tr>
                    {expandedId === c.id && expandedType === 'customer' && customerLedger && (
                      <tr>
                        <td colSpan={3} className="bg-gray-50/80 p-6">
                          <LedgerPanel
                            data={c}
                            type="customer"
                            ledger={customerLedger}
                            payAmount={payAmount}
                            setPayAmount={setPayAmount}
                            payMethod={payMethod}
                            setPayMethod={setPayMethod}
                            onPay={() => {
                              const amt = parseFloat(payAmount);
                              if (!amt || amt <= 0) return;
                              payMutation.mutate({ id: c.id, amount: amt, method: payMethod });
                            }}
                            isPending={payMutation.isPending}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {receivables.length === 0 && (
              <div className="py-20 text-center"><p className="text-xs text-gray-400 font-medium">No matching customers</p></div>
            )}
          </div>
        </div>

        {/* Payables Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs shadow-sm">OUT</div>
            <h3 className="font-black text-gray-800 tracking-tight uppercase text-xs">Supplier Dues (Payables)</h3>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="text-left px-5 py-4">Supplier</th>
                  <th className="text-right px-5 py-4">To Pay</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payables.map((p: any) => (
                  <Fragment key={p.id}>
                    <tr onClick={() => toggleExpand(p.id, 'supplier')} className={`group cursor-pointer hover:bg-rose-50/30 transition-all ${expandedId === p.id ? 'bg-rose-50/50' : ''}`}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-800 group-hover:text-rose-700 transition-colors">{p.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{p.address || 'No address'}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="font-black text-rose-600">{fmt(p.total_outstanding)}</p>
                      </td>
                      <td className="pr-4 text-gray-300 group-hover:text-rose-400 transition-colors">
                        <svg className={`w-4 h-4 transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </td>
                    </tr>
                    {expandedId === p.id && expandedType === 'supplier' && supplierLedger && (
                      <tr>
                        <td colSpan={3} className="bg-gray-50/80 p-6">
                          <LedgerPanel
                            data={p}
                            type="supplier"
                            ledger={supplierLedger}
                            payAmount={payAmount}
                            setPayAmount={setPayAmount}
                            payMethod={payMethod}
                            setPayMethod={setPayMethod}
                            onPay={() => {
                              const amt = parseFloat(payAmount);
                              if (!amt || amt <= 0) return;
                              payMutation.mutate({ id: p.id, amount: amt, method: payMethod });
                            }}
                            isPending={payMutation.isPending}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {payables.length === 0 && (
              <div className="py-20 text-center"><p className="text-xs text-gray-400 font-medium">No matching suppliers</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerPanel({ data, type, ledger, payAmount, setPayAmount, payMethod, setPayMethod, onPay, isPending }: any) {
  const transactions = (type === 'customer'
    ? (ledger?.transactions ?? [])
    : [
      ...(ledger?.purchases?.map((px: any) => ({
        id: px.id,
        transaction_date: px.invoice_date,
        notes: `Purchase - ${px.invoice_number}`,
        type: 'credit_given',
        amount: px.total_amount
      })) ?? []),
      ...(ledger?.payments?.map((py: any) => ({
        id: py.id,
        transaction_date: py.payment_date,
        notes: 'Payment Made',
        type: 'payment_received',
        amount: py.amount
      })) ?? []),
      ...(ledger?.purchase_returns?.map((pr: any) => ({
        id: pr.id,
        transaction_date: pr.return_date,
        notes: `Purchase Return - ${pr.return_number}`,
        type: 'payment_received',
        amount: pr.total_amount
      })) ?? [])
    ]
  ).sort((a: any, b: any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Recent Activity</h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
          {!ledger ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-[10px]">No transaction history</p>
          ) : (
            transactions.map((tx: any) => (
              <div key={tx.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tx.type === 'credit_given' ? (type === 'customer' ? 'bg-rose-50 text-rose-500' : 'bg-rose-50 text-rose-500') : 'bg-emerald-50 text-emerald-500'}`}>
                    {tx.type === 'credit_given' ? (type === 'customer' ? '↑' : '↑') : '↓'}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-700 truncate max-w-[150px]">{tx.notes || (tx.type === 'credit_given' ? (type === 'customer' ? 'Credit Sale' : 'Purchase') : 'Payment Settlement')}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">{new Date(tx.transaction_date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <p className={`text-xs font-black ${tx.type === 'credit_given' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {tx.type === 'credit_given' ? '+' : '-'}{fmt(tx.amount)}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="mt-4">
          <button
            onClick={() => {
              const msg = `Hello ${data.name},\n\nYour current outstanding balance is ${fmt(data.total_outstanding)}.\n\nPlease settle at your earliest convenience.\n\nThank you!`;
              const url = `https://wa.me/${data.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
              window.open(url, '_blank');
            }}
            disabled={!data.phone}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${data.phone ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.224-3.82l.339.201c1.53 1.01 3.321 1.543 5.167 1.545l.006.001c5.82 0 10.555-4.735 10.558-10.555 0-2.819-1.098-5.471-3.091-7.465-1.993-1.993-4.644-3.092-7.463-3.093h-.008c-5.819 0-10.554 4.735-10.558 10.556 0 2.053.593 4.053 1.716 5.79l.244.379-1.025 3.746 3.834-1.005zm12.333-10.579l-1.423-.711-.336-.168c-.149-.074-.3-.112-.451-.112-.11 0-.22.02-.321.061-.091.037-.183.1-.264.18l-.946.945c-.092.092-.153.21-.173.336-.02.126-.002.253.051.373.491 1.076 1.111 2.067 1.841 2.943.08.096.165.188.254.277l.797.796.347.348c.15.15.344.225.541.225.12 0 .241-.028.35-.084l.215-.107 1.118-.559c.142-.071.25-.183.308-.323s.06-.296.002-.43l-.337-.768-.901-2.051c-.086-.197-.282-.322-.497-.322zm-3.692 3.693c-.49-.49-.96-.948-1.408-1.375l-.265-.252c-.426-.406-.827-.788-1.201-1.144-.127-.121-.241-.23-.339-.324-1.503-1.432-2.122-2.316-2.174-2.394-.052-.078-.052-.078-.052-.078s0 0 0 0l-.338-1.014c-.053-.159-.172-.288-.327-.357s-.332-.071-.489-.001l-.756.336-.339.151c-.098.044-.187.112-.266.197-.18.196-.3.428-.351.68-.13.626.059 1.42 1.489 3.197l.1.124.017.02c.032.039.064.079.098.118 1.48 1.761 3.518 3.55 5.518 4.316l.164.06c.306.111.64.129.957.05.295-.074.56-.231.751-.453l.945-.945c.291-.291.291-.763 0-1.054l-.797-.796z" /></svg>
            Send WhatsApp Report
          </button>
        </div>
      </div>
      <div className="bg-white rounded-3xl p-5 border border-violet-100 shadow-md h-fit">
        <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight mb-4">{type === 'customer' ? 'Record Repayment' : 'Record Payment Made'}</h4>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Amount (₹)</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-100 bg-gray-50/50 rounded-2xl px-4 py-3 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
            />
            <button onClick={() => setPayAmount(String(data.total_outstanding))} className="text-[10px] text-violet-600 font-black hover:underline mt-1">Settle Full: {fmt(data.total_outstanding)}</button>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Method</label>
            <div className="flex gap-2">
              {['cash', 'upi', 'card'].map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest border transition-all ${payMethod === m ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-100' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onPay}
            disabled={isPending || !payAmount}
            className="w-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-violet-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? 'Saving...' : type === 'customer' ? 'Collect & Update Ledger' : 'Pay & Update Ledger'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GST Tab
// ─────────────────────────────────────────────────────────────────────────────
function GSTTab() {
  const [month, setMonth] = useState(TODAY.getMonth() + 1);
  const [year, setYear] = useState(TODAY.getFullYear());

  const { data, isLoading } = useQuery<GstSummary>({
    queryKey: ['web-gst-detail', month, year],
    queryFn: () => accountingApi.getGstSummary(month, year).then((r) => r.data.data),
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
        <div>
          <label className="text-gray-500 text-xs block mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 w-24 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <div className="flex-1" />
        <div className="flex gap-3">
          <button
            onClick={async () => {
              try {
                const res = await accountingApi.getGstr1Excel(month, year);
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `GSTR1_${month}_${year}.xlsx`);
                document.body.appendChild(link);
                link.click();
                link.remove();
              } catch (err) { alert('Failed to download GSTR-1'); }
            }}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-100 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            GSTR-1 (Sales)
          </button>
          <button
            onClick={async () => {
              try {
                const res = await accountingApi.getGstr2Excel(month, year);
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `GSTR2_${month}_${year}.xlsx`);
                document.body.appendChild(link);
                link.click();
                link.remove();
              } catch (err) { alert('Failed to download GSTR-2'); }
            }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            GSTR-2A (Purchase)
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Taxable Outward Supplies" value={fmt(data.outward_supplies.taxable_value)} color="bg-violet-50" textColor="text-violet-700" />
            <StatCard label="GST Collected (Output)" value={fmt(data.outward_supplies.total_gst_collected)} sub={`CGST ${fmt(data.outward_supplies.gst_collected.cgst)} + SGST ${fmt(data.outward_supplies.gst_collected.sgst)}`} color="bg-blue-50" textColor="text-blue-700" />
            <StatCard label="ITC (Input Tax Credit)" value={fmt(data.inward_supplies.total_itc)} sub={`CGST ${fmt(data.inward_supplies.itc_available.cgst)} + SGST ${fmt(data.inward_supplies.itc_available.sgst)}`} color="bg-green-50" textColor="text-green-700" />
            <StatCard label="Net GST Payable" value={fmt(data.net_tax_payable)} sub={`Output − ITC`} color="bg-indigo-50" textColor="text-indigo-700" />
          </div>

          {/* Outward supplies rate-wise */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-1">Outward Supplies — Rate-wise (GSTR-1 / 3B)</h3>
            <p className="text-gray-400 text-xs mb-4">Tax on sales collected from customers</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-100">
                  <th className="text-left py-2">GST Rate</th>
                  <th className="text-right py-2">Taxable Value</th>
                  <th className="text-right py-2">CGST</th>
                  <th className="text-right py-2">SGST</th>
                  <th className="text-right py-2">Total GST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data.rate_wise_summary ?? []).map((row) => (
                  <tr key={row.gst_rate} className="hover:bg-gray-50/50">
                    <td className="py-3 font-medium text-gray-700">{row.gst_rate}%</td>
                    <td className="py-3 text-right text-gray-600">{fmt(row.taxable_value)}</td>
                    <td className="py-3 text-right text-gray-600">{fmt(row.gst_amount / 2)}</td>
                    <td className="py-3 text-right text-gray-600">{fmt(row.gst_amount / 2)}</td>
                    <td className="py-3 text-right font-semibold text-gray-800">{fmt(row.gst_amount)}</td>
                  </tr>
                ))}
                {(data.rate_wise_summary ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-xs">No sales recorded for this period</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="pt-3 font-bold text-gray-800">Total</td>
                  <td className="pt-3 text-right font-bold text-gray-800">{fmt(data.outward_supplies.taxable_value)}</td>
                  <td className="pt-3 text-right font-bold text-gray-800">{fmt(data.outward_supplies.gst_collected.cgst)}</td>
                  <td className="pt-3 text-right font-bold text-gray-800">{fmt(data.outward_supplies.gst_collected.sgst)}</td>
                  <td className="pt-3 text-right font-bold text-violet-700">{fmt(data.outward_supplies.total_gst_collected)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Inward supplies (ITC) */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-1">Inward Supplies — Input Tax Credit (ITC)</h3>
            <p className="text-gray-400 text-xs mb-4">GST paid on purchases — eligible to offset output tax</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">CGST (ITC)</p>
                <p className="text-lg font-bold text-green-700">{fmt(data.inward_supplies.itc_available.cgst)}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">SGST (ITC)</p>
                <p className="text-lg font-bold text-green-700">{fmt(data.inward_supplies.itc_available.sgst)}</p>
              </div>
              <div className="bg-green-100 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total ITC Available</p>
                <p className="text-lg font-bold text-green-800">{fmt(data.inward_supplies.total_itc)}</p>
              </div>
            </div>
          </div>

          {/* Net payable summary */}
          <div className="bg-indigo-50 rounded-xl p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Net GST Payable</h3>
            <div className="flex flex-wrap gap-6 text-sm items-center">
              <div>
                <span className="text-gray-500">Output GST </span>
                <span className="font-bold text-blue-700">{fmt(data.outward_supplies.total_gst_collected)}</span>
              </div>
              <span className="text-gray-400 font-bold text-lg">−</span>
              <div>
                <span className="text-gray-500">ITC </span>
                <span className="font-bold text-green-700">{fmt(data.inward_supplies.total_itc)}</span>
              </div>
              <span className="text-gray-400 font-bold text-lg">=</span>
              <div>
                <span className="text-gray-500">Net Payable </span>
                <span className="font-bold text-indigo-700 text-base">{fmt(data.net_tax_payable)}</span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sale Return Tab
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_SR_ITEM = { medicine_name: '', unit: 'strip', batch_number: '', quantity: '1', mrp: '', discount_pct: '0', gst_rate: '12' };
type SRItem = typeof EMPTY_SR_ITEM;

function SaleReturnTab({ setSelectedReturnId }: any) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [returnDate, setReturnDate] = useState(TODAY_STR);
  const [refundMethod, setRefundMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [srItems, setSrItems] = useState<SRItem[]>([{ ...EMPTY_SR_ITEM }]);
  const [srSuggestions, setSrSuggestions] = useState<Record<number, { id: string; medicine_name: string; unit?: string; mrp: number; gst_rate: number }[]>>({});
  const [srHighlights, setSrHighlights] = useState<Record<number, number>>({});
  const [selectedBillId, setSelectedBillId] = useState('');
  const [billSearch, setBillSearch] = useState('');
  const [billSuggestions, setBillSuggestions] = useState<any[]>([]);
  const srTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const { data: listData, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['web-sale-returns'],
    queryFn: () => accountingApi.listSaleReturns({ limit: 30 }).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => accountingApi.createSaleReturn(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-sale-returns'] });
      setSrItems([{ ...EMPTY_SR_ITEM }]); setSrSuggestions({}); setSrHighlights({});
      setCustomerName(''); setReturnDate(TODAY_STR); setRefundMethod('cash'); setReason('');
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteSaleReturn(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-sale-returns'] });
      qc.invalidateQueries({ queryKey: ['web-inventory'] });
      qc.invalidateQueries({ queryKey: ['web-pl'] });
      alert('Sale return deleted and inventory reversed');
    },
    onError: (err: any) => alert(err.response?.data?.error?.message || 'Failed to delete return'),
  });

  const updateSrItem = (idx: number, field: keyof SRItem, value: string) => {
    setSrItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'medicine_name') {
      if (srTimers.current[idx]) clearTimeout(srTimers.current[idx]);
      if (value.length < 2) { setSrSuggestions((p) => ({ ...p, [idx]: [] })); setSrHighlights((p) => ({ ...p, [idx]: -1 })); return; }
      srTimers.current[idx] = setTimeout(async () => {
        try { const res = await inventoryApi.list({ q: value, limit: 8 }); setSrSuggestions((p) => ({ ...p, [idx]: res.data.data ?? [] })); setSrHighlights((p) => ({ ...p, [idx]: -1 })); } catch { /* ignore */ }
      }, 250);
    }
  };

  const selectSrSug = (idx: number, inv: { medicine_name: string; unit?: string; mrp: number; gst_rate: number }) => {
    setSrItems((prev) => prev.map((it, i) => i === idx ? { ...it, medicine_name: inv.medicine_name, unit: inv.unit ?? it.unit, mrp: String(inv.mrp), gst_rate: String(inv.gst_rate ?? 12) } : it));
    setSrSuggestions((p) => ({ ...p, [idx]: [] }));
    setSrHighlights((p) => ({ ...p, [idx]: -1 }));
  };

  const srLineTotal = (it: SRItem) => Number(it.quantity) * Number(it.mrp) * (1 - (Number(it.discount_pct) || 0) / 100);
  const srCalcTotal = srItems.reduce((s, it) => s + srLineTotal(it), 0);

  const loadBillItems = async (bill: any) => {
    setSelectedBillId(bill.id);
    setCustomerName(bill.customer_name || 'Walk-in');
    setBillSearch(bill.bill_number);
    setBillSuggestions([]);
    try {
      const res = await billApi.getById(bill.id);
      const data = res.data.data;
      if (data?.items?.length) {
        setSrItems(data.items.map((it: any) => ({
          medicine_name: it.medicine_name,
          unit: it.unit || 'strip',
          batch_number: it.batch_number || '',
          quantity: String(it.quantity),
          mrp: String(it.mrp),
          gst_rate: String(it.gst_rate || 12),
          discount_pct: String(it.discount_value && it.mrp ? (Number(it.discount_value) / (Number(it.mrp) * Number(it.quantity))) * 100 : 0),
        })));
      }
    } catch (err) { console.error(err); }
  };

  const searchBills = async (q: string) => {
    setBillSearch(q);
    if (q.length < 2) { setBillSuggestions([]); return; }
    try {
      const res = await billApi.list({ search: q, limit: 10 });
      setBillSuggestions(res.data.data.bills || []);
    } catch (err) { console.error(err); }
  };

  const METHODS = ['cash', 'upi', 'card', 'neft', 'cheque'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">Medicines returned by customers — inventory is automatically restocked</p>
        <button onClick={() => setShowForm((v) => !v)}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
          {showForm ? '✕ Cancel' : '+ New Sale Return'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 space-y-5">
          <h3 className="font-bold text-gray-800">New Sale Return (Credit Note)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative">
              <label className="text-xs font-medium text-gray-500 block mb-1">Search Bill #</label>
              <input type="text" value={billSearch} onChange={(e) => searchBills(e.target.value)} placeholder="Type bill no..."
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono" />
              {billSuggestions.length > 0 && (
                <div className="absolute z-40 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1">
                  {billSuggestions.map((b) => (
                    <button key={b.id} onClick={() => loadBillItems(b)} className="w-full text-left px-3 py-2 hover:bg-orange-50 rounded-lg transition-colors border-b border-gray-50 last:border-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-mono text-xs font-bold text-orange-700">{b.bill_number}</span>
                        <span className="text-[10px] text-gray-400">{new Date(b.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600 truncate">{b.customer_name || 'Walk-in'}</span>
                        <span className="text-xs font-black text-gray-800">₹{b.total_amount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {[{ label: 'Customer Name', val: customerName, set: setCustomerName, placeholder: 'Walk-in customer', type: 'text' },
            { label: 'Reason', val: reason, set: setReason, placeholder: 'Damaged / Wrong item', type: 'text' }].map((f) => (
              <div key={f.label}>
                <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
                <input type={f.type} value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Return Date *</label>
              <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          <div className="flex gap-4 items-end">
            <div className="w-48">
              <label className="text-xs font-medium text-gray-500 block mb-1">Refund Method</label>
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="grid gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1" style={{ gridTemplateColumns: '2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.8fr 0.8fr 1fr' }}>
              <div>Medicine</div><div>Unit</div><div>Batch</div>
              <div>Qty</div><div>MRP (₹)</div>
              <div>Disc%</div><div>GST%</div><div className="text-right">Total</div>
            </div>
            <div className="space-y-2">
              {srItems.map((item, idx) => (
                <div key={idx} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.8fr 0.8fr 1fr' }}>
                  <div className="relative">
                    <input type="text" placeholder="Medicine name" value={item.medicine_name} onChange={(e) => updateSrItem(idx, 'medicine_name', e.target.value)}
                      onKeyDown={(e) => {
                        const suggs = srSuggestions[idx] ?? [];
                        const h = srHighlights[idx] ?? -1;
                        if (e.key === 'ArrowDown') { e.preventDefault(); setSrHighlights((p) => ({ ...p, [idx]: Math.min(h + 1, suggs.length - 1) })); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSrHighlights((p) => ({ ...p, [idx]: Math.max(h - 1, 0) })); }
                        else if (e.key === 'Enter' && h >= 0 && suggs[h]) { e.preventDefault(); selectSrSug(idx, suggs[h]); }
                        else if (e.key === 'Escape') { setSrSuggestions((p) => ({ ...p, [idx]: [] })); setSrHighlights((p) => ({ ...p, [idx]: -1 })); }
                      }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-8 text-xs outline-none focus:border-orange-500" />
                    {srSuggestions[idx]?.length > 0 && (
                      <div className="absolute z-30 top-full mt-0.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                        {srSuggestions[idx].map((s, si) => (
                          <button key={s.id} type="button" onClick={() => selectSrSug(idx, s)}
                            className={`w-full flex justify-between px-3 py-1.5 text-xs text-left transition-colors ${si === (srHighlights[idx] ?? -1) ? 'bg-orange-100' : 'hover:bg-orange-50'}`}>
                            <span className="font-medium">{s.medicine_name}</span><span className="text-orange-600">₹{s.mrp}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div><select value={item.unit} onChange={(e) => updateSrItem(idx, 'unit', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs bg-white outline-none focus:border-orange-500">{['strip', 'bottle', 'packet', 'vial', 'tube', 'piece', 'box'].map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
                  <div><input type="text" placeholder="Batch" value={item.batch_number} onChange={(e) => updateSrItem(idx, 'batch_number', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 h-8 text-xs outline-none focus:border-orange-500" /></div>
                  <div><input type="number" min="1" value={item.quantity} onChange={(e) => updateSrItem(idx, 'quantity', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs outline-none text-center focus:border-orange-500" /></div>
                  <div><input type="number" min="0" step="0.01" placeholder="0.00" value={item.mrp} onChange={(e) => updateSrItem(idx, 'mrp', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs outline-none focus:border-orange-500" /></div>
                  <div><input type="number" min="0" max="100" placeholder="0" value={item.discount_pct} onChange={(e) => updateSrItem(idx, 'discount_pct', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs outline-none text-center focus:border-orange-500" /></div>
                  <div><select value={item.gst_rate} onChange={(e) => updateSrItem(idx, 'gst_rate', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs bg-white outline-none focus:border-orange-500">{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-orange-700 truncate">{srLineTotal(item) > 0 ? fmt(srLineTotal(item)) : '—'}</span>
                    <button onClick={() => setSrItems((p) => p.filter((_, i) => i !== idx))} disabled={srItems.length === 1} className="text-gray-300 hover:text-red-500 disabled:opacity-20 shrink-0"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setSrItems((p) => [...p, { ...EMPTY_SR_ITEM }])} className="mt-2 text-xs text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Add Row
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="text-sm"><span className="text-gray-400">Total Refund </span><span className="font-bold text-orange-700 text-base">{fmt(srCalcTotal)}</span></div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm px-4 py-2 hover:text-gray-700">Cancel</button>
              <button onClick={() => {
                const valid = srItems.filter((it) => it.medicine_name && Number(it.quantity) > 0 && Number(it.mrp) > 0);
                if (!valid.length) return;
                createMutation.mutate({ bill_id: selectedBillId || undefined, customer_name: customerName || undefined, return_date: returnDate, refund_method: refundMethod, reason: reason || undefined, items: valid.map((it) => ({ medicine_name: it.medicine_name, unit: it.unit || 'strip', batch_number: it.batch_number || undefined, quantity: Number(it.quantity), mrp: Number(it.mrp), gst_rate: Number(it.gst_rate) || 12, discount_pct: Number(it.discount_pct) || 0 })) });
              }} disabled={createMutation.isPending || !srItems.some((it) => it.medicine_name && Number(it.quantity) > 0 && Number(it.mrp) > 0)}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? 'Saving…' : 'Save Return'}
              </button>
            </div>
          </div>
          {createMutation.isError && <p className="text-red-500 text-xs">{(createMutation.error as any)?.response?.data?.error?.message ?? 'Failed to save.'}</p>}
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-5 py-3">Return No.</th><th className="text-left px-5 py-3">Date</th>
              <th className="text-left px-5 py-3">Customer</th><th className="text-left px-5 py-3">Reason</th>
              <th className="text-left px-5 py-3">Method</th><th className="text-right px-5 py-3">Amount</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(listData?.items ?? []).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{r.return_number}</td>
                  <td className="px-5 py-3 text-gray-600">{new Date(r.return_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-gray-800">{r.customer_name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.reason ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 uppercase text-xs">{r.refund_method}</td>
                  <td className="px-5 py-3 text-right font-semibold text-orange-600">{fmt(r.total_amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setSelectedReturnId(r.id)} className="text-orange-600 hover:text-orange-800 font-bold text-xs uppercase tracking-wider">View</button>
                      <button
                        onClick={() => { if(confirm('Delete this sale return and reverse inventory?')) deleteMutation.mutate(r.id); }}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(listData?.items?.length) && <p className="text-center text-gray-400 py-10 text-sm">No sale returns recorded</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Purchase Return Tab
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_PR_ITEM = { medicine_name: '', unit: 'strip', batch_number: '', quantity: '1', purchase_price: '', gst_rate: '12', selected: true };
type PRItem = typeof EMPTY_PR_ITEM;

function PurchaseReturnTab({ setSelectedReturnId }: any) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [prSupplierId, setPrSupplierId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [prReturnDate, setPrReturnDate] = useState(TODAY_STR);
  const [prReason, setPrReason] = useState('');
  const [prItems, setPrItems] = useState<PRItem[]>([{ ...EMPTY_PR_ITEM }]);
  const [prSuggestions, setPrSuggestions] = useState<Record<number, { id: string; medicine_name: string; unit?: string; mrp: number; gst_rate: number }[]>>({});
  const [prHighlights, setPrHighlights] = useState<Record<number, number>>({});
  const prTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const { data: supplierInvoicesRes } = useQuery({
    queryKey: ['web-supplier-purchases', prSupplierId],
    queryFn: () => accountingApi.listPurchases({ supplier_id: prSupplierId, limit: 100 }).then(r => r.data.data),
    enabled: !!prSupplierId,
  });
  const supplierInvoices = supplierInvoicesRes?.items ?? [];

  const loadInvoiceItems = async (purchaseId: string) => {
    if (!purchaseId) {
      setSelectedInvoiceId('');
      setInvoiceRef('');
      return;
    }
    const inv = supplierInvoices.find((i: any) => i.id === purchaseId);
    if (!inv) return;

    setSelectedInvoiceId(purchaseId);
    setInvoiceRef(inv.invoice_number);

    try {
      const res = await accountingApi.getPurchaseById(purchaseId);
      const data = res.data.data;
      if (data?.items?.length) {
        setPrItems(data.items.map((it: any) => ({
          medicine_name: it.medicine_name,
          unit: it.unit || 'strip',
          batch_number: it.batch_number || '',
          quantity: String(it.quantity),
          purchase_price: String(it.purchase_price),
          gst_rate: String(it.gst_rate || 12),
          selected: true,
        })));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load invoice items');
    }
  };

  const { data: suppliersData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['web-suppliers'],
    queryFn: () => accountingApi.listSuppliers().then((r) => r.data.data),
  });

  const { data: listData, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['web-purchase-returns'],
    queryFn: () => accountingApi.listPurchaseReturns({ limit: 30 }).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => accountingApi.createPurchaseReturn(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-purchase-returns'] });
      setPrItems([{ ...EMPTY_PR_ITEM }]); setPrSuggestions({}); setPrHighlights({});
      setPrSupplierId(''); setSelectedInvoiceId(''); setInvoiceRef(''); setPrReturnDate(TODAY_STR); setPrReason('');
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deletePurchaseReturn(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-purchase-returns'] });
      qc.invalidateQueries({ queryKey: ['web-inventory'] });
      qc.invalidateQueries({ queryKey: ['web-pl'] });
      alert('Return deleted and inventory reversed');
    },
  });

  const updatePrItem = (idx: number, field: keyof PRItem, value: string) => {
    setPrItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'medicine_name') {
      if (prTimers.current[idx]) clearTimeout(prTimers.current[idx]);
      if (value.length < 2) { setPrSuggestions((p) => ({ ...p, [idx]: [] })); setPrHighlights((p) => ({ ...p, [idx]: -1 })); return; }
      prTimers.current[idx] = setTimeout(async () => {
        try { const res = await inventoryApi.list({ q: value, limit: 8 }); setPrSuggestions((p) => ({ ...p, [idx]: res.data.data ?? [] })); setPrHighlights((p) => ({ ...p, [idx]: -1 })); } catch { /* ignore */ }
      }, 250);
    }
  };

  const selectPrSug = (idx: number, inv: { medicine_name: string; unit?: string; mrp: number; gst_rate: number }) => {
    setPrItems((prev) => prev.map((it, i) => i === idx ? { ...it, medicine_name: inv.medicine_name, unit: inv.unit ?? it.unit, gst_rate: String(inv.gst_rate ?? 12) } : it));
    setPrSuggestions((p) => ({ ...p, [idx]: [] }));
    setPrHighlights((p) => ({ ...p, [idx]: -1 }));
  };

  const prLineTotal = (it: PRItem) => it.selected ? (Number(it.quantity) * Number(it.purchase_price) * (1 + (Number(it.gst_rate) || 0) / 100)) : 0;
  const prCalcTotal = prItems.reduce((s, it) => s + prLineTotal(it), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">Return medicines to supplier — inventory is automatically reduced</p>
        <button onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          {showForm ? '✕ Cancel' : '+ New Purchase Return'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-5">
          <h3 className="font-bold text-gray-800">New Purchase Return</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Supplier</label>
              <select value={prSupplierId} onChange={(e) => setPrSupplierId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">— Select Supplier —</option>
                {(suppliersData ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Invoice Ref</label>
              <div className="flex gap-2">
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => loadInvoiceItems(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Select Invoice —</option>
                  {supplierInvoices.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} ({new Date(inv.invoice_date).toLocaleDateString()})</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Manual Ref"
                  value={invoiceRef}
                  onChange={(e) => { setInvoiceRef(e.target.value); setSelectedInvoiceId(''); }}
                  className="w-24 border border-gray-200 rounded-lg px-2 h-9 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Return Date *</label>
              <input type="date" value={prReturnDate} onChange={(e) => setPrReturnDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Reason</label>
              <input type="text" placeholder="Expired / Damaged" value={prReason} onChange={(e) => setPrReason(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          <div>
            <div className="grid gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1" style={{ gridTemplateColumns: '0.3fr 2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.9fr 1fr' }}>
              <div className="text-center">✔</div><div>Medicine</div><div>Unit</div><div>Batch</div>
              <div>Qty</div><div>Cost (₹)</div>
              <div>GST%</div><div className="text-right">Total</div>
            </div>
            <div className="space-y-2">
              {prItems.map((item, idx) => (
                <div key={idx} className={`grid gap-1.5 items-center p-1 rounded-lg transition-colors ${item.selected ? 'bg-blue-50/30' : 'opacity-40 grayscale'}`} style={{ gridTemplateColumns: '0.3fr 2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.9fr 1fr' }}>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => updatePrItem(idx, 'selected' as any, e.target.checked as any)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <input type="text" placeholder="Medicine name" value={item.medicine_name} onChange={(e) => updatePrItem(idx, 'medicine_name', e.target.value)}
                      disabled={!item.selected}
                      onKeyDown={(e) => {
                        const suggs = prSuggestions[idx] ?? [];
                        const h = prHighlights[idx] ?? -1;
                        if (e.key === 'ArrowDown') { e.preventDefault(); setPrHighlights((p) => ({ ...p, [idx]: Math.min(h + 1, suggs.length - 1) })); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setPrHighlights((p) => ({ ...p, [idx]: Math.max(h - 1, 0) })); }
                        else if (e.key === 'Enter' && h >= 0 && suggs[h]) { e.preventDefault(); selectPrSug(idx, suggs[h]); }
                        else if (e.key === 'Escape') { setPrSuggestions((p) => ({ ...p, [idx]: [] })); setPrHighlights((p) => ({ ...p, [idx]: -1 })); }
                      }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-8 text-xs outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
                    {prSuggestions[idx]?.length > 0 && (
                      <div className="absolute z-30 top-full mt-0.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                        {prSuggestions[idx].map((s, si) => (
                          <button key={s.id} type="button" onClick={() => selectPrSug(idx, s)}
                            className={`w-full flex justify-between px-3 py-1.5 text-xs text-left transition-colors ${si === (prHighlights[idx] ?? -1) ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
                            <span className="font-medium">{s.medicine_name}</span><span className="text-blue-600">₹{s.mrp}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div><select value={item.unit} disabled={!item.selected} onChange={(e) => updatePrItem(idx, 'unit', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs bg-white outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400">{['strip', 'bottle', 'packet', 'vial', 'tube', 'piece', 'box'].map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
                  <div><input type="text" placeholder="Batch" value={item.batch_number} disabled={!item.selected} onChange={(e) => updatePrItem(idx, 'batch_number', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 h-8 text-xs outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400" /></div>
                  <div><input type="number" min="1" value={item.quantity} disabled={!item.selected} onChange={(e) => updatePrItem(idx, 'quantity', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs outline-none text-center focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400" /></div>
                  <div><input type="number" min="0" step="0.01" placeholder="0.00" value={item.purchase_price} disabled={!item.selected} onChange={(e) => updatePrItem(idx, 'purchase_price', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400" /></div>
                  <div><select value={item.gst_rate} disabled={!item.selected} onChange={(e) => updatePrItem(idx, 'gst_rate', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs bg-white outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400">{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-blue-700 truncate">{prLineTotal(item) > 0 ? fmt(prLineTotal(item)) : '—'}</span>
                    <button onClick={() => setPrItems((p) => p.filter((_, i) => i !== idx))} disabled={prItems.length === 1} className="text-gray-300 hover:text-red-500 disabled:opacity-20 shrink-0"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setPrItems((p) => [...p, { ...EMPTY_PR_ITEM }])} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Add Row
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="text-sm"><span className="text-gray-400">Total Return Value </span><span className="font-bold text-blue-700 text-base">{fmt(prCalcTotal)}</span></div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm px-4 py-2 hover:text-gray-700">Cancel</button>
              <button onClick={() => {
                const valid = prItems.filter((it) => it.selected && it.medicine_name && Number(it.quantity) > 0 && Number(it.purchase_price) > 0);
                if (!valid.length) return;
                createMutation.mutate({
                  supplier_id: prSupplierId || undefined,
                  invoice_ref: invoiceRef || undefined,
                  purchase_entry_id: selectedInvoiceId || undefined,
                  return_date: prReturnDate,
                  reason: prReason || undefined,
                  items: valid.map((it) => ({
                    medicine_name: it.medicine_name,
                    unit: it.unit || 'strip',
                    batch_number: it.batch_number || undefined,
                    quantity: Number(it.quantity),
                    purchase_price: Number(it.purchase_price),
                    gst_rate: Number(it.gst_rate) || 12
                  }))
                });
              }} disabled={createMutation.isPending || !prItems.some((it) => it.selected && it.medicine_name && Number(it.quantity) > 0 && Number(it.purchase_price) > 0)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? 'Saving…' : 'Save Return'}
              </button>
            </div>
          </div>
          {createMutation.isError && <p className="text-red-500 text-xs">{(createMutation.error as any)?.response?.data?.error?.message ?? 'Failed to save.'}</p>}
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-5 py-3">Return No.</th><th className="text-left px-5 py-3">Date</th>
              <th className="text-left px-5 py-3">Supplier</th><th className="text-left px-5 py-3">Invoice Ref</th>
              <th className="text-left px-5 py-3">Reason</th><th className="text-right px-5 py-3">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(listData?.items ?? []).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50/50 group">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{r.return_number}</td>
                  <td className="px-5 py-3 text-gray-600">{new Date(r.return_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-gray-800 font-medium">{r.supplier?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.invoice_ref ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className="font-bold text-rose-600 mr-2">{fmt(r.total_amount)}</span>
                      <button
                        onClick={() => setSelectedReturnId(r.id)}
                        className="p-1 px-2.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all text-[10px] font-black uppercase tracking-widest"
                      >
                        Note
                      </button>
                      <button
                        onClick={() => { if(confirm('Delete this purchase return and reverse inventory?')) deleteMutation.mutate(r.id); }}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(listData?.items?.length) && <p className="text-center text-gray-400 py-10 text-sm">No purchase returns recorded</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contra Entry Tab
// ─────────────────────────────────────────────────────────────────────────────
function ContraTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fromAcc, setFromAcc] = useState('cash');
  const [toAcc, setToAcc] = useState('upi');
  const [contraAmount, setContraAmount] = useState('');
  const [contraDate, setContraDate] = useState(TODAY_STR);
  const [contraDesc, setContraDesc] = useState('');
  const [contraRef, setContraRef] = useState('');
  const [contraFrom, setContraFrom] = useState(FIRST_OF_MONTH);
  const [contraTo, setContraTo] = useState(TODAY_STR);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: listData, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['web-contra', contraFrom, contraTo],
    queryFn: () => accountingApi.listContraEntries({ from: contraFrom, to: contraTo }).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => editingId ? accountingApi.updateContraEntry(editingId, payload) : accountingApi.createContraEntry(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-contra'] });
      setContraAmount(''); setContraDesc(''); setContraRef('');
      setFromAcc('cash'); setToAcc('upi'); setContraDate(TODAY_STR);
      setEditingId(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteContraEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-contra'] });
      alert('Contra entry deleted');
    },
  });

  const ACCOUNTS = ['cash', 'upi', 'neft', 'cheque', 'card'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">Record cash ↔ bank transfers (e.g. cash deposited to bank, cash withdrawn)</p>
        <button onClick={() => setShowForm((v) => !v)}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
          {showForm ? '✕ Cancel' : '+ New Contra Entry'}
        </button>
      </div>

       {showForm && (
        <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">{editingId ? 'Edit Contra Entry' : 'New Contra Entry'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">From Account (Credit)</label>
              <select value={fromAcc} onChange={(e) => setFromAcc(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                {ACCOUNTS.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">To Account (Debit)</label>
              <select value={toAcc} onChange={(e) => setToAcc(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                {ACCOUNTS.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={contraAmount} onChange={(e) => setContraAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Date *</label>
              <input type="date" value={contraDate} onChange={(e) => setContraDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
              <input type="text" placeholder="Cash deposited to bank" value={contraDesc} onChange={(e) => setContraDesc(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Reference No.</label>
              <input type="text" placeholder="UTR / Cheque no." value={contraRef} onChange={(e) => setContraRef(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
          {fromAcc === toAcc && <p className="text-amber-600 text-xs mt-3">⚠ From and To account cannot be the same.</p>}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                const amt = parseFloat(contraAmount);
                if (!amt || fromAcc === toAcc) return;
                createMutation.mutate({ from_account: fromAcc, to_account: toAcc, amount: amt, entry_date: contraDate, description: contraDesc || undefined, reference_no: contraRef || undefined });
              }}
              disabled={createMutation.isPending || !parseFloat(contraAmount) || fromAcc === toAcc}
              className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {createMutation.isPending ? 'Saving…' : 'Save Entry'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 text-sm px-4 py-2 hover:text-gray-700">Cancel</button>
          </div>
          {createMutation.isError && <p className="text-red-500 text-xs mt-2">{(createMutation.error as any)?.response?.data?.error?.message ?? 'Failed to save.'}</p>}
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-4">
        <div><label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" value={contraFrom} onChange={(e) => setContraFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" /></div>
        <div><label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" value={contraTo} onChange={(e) => setContraTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" /></div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-5 py-3">Date</th><th className="text-left px-5 py-3">From</th>
              <th className="text-left px-5 py-3">To</th><th className="text-left px-5 py-3">Description</th>
              <th className="text-left px-5 py-3">Ref No.</th><th className="text-right px-5 py-3">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(listData?.items ?? []).map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-600">{new Date(c.entry_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3"><span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs uppercase">{c.from_account}</span></td>
                  <td className="px-5 py-3"><span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs uppercase">{c.to_account}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{c.description ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{c.reference_no ?? '—'}</td>
                   <td className="px-5 py-3 text-right font-semibold text-teal-700">
                    <div className="flex items-center justify-end gap-3">
                      <span>{fmt(c.amount)}</span>
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setFromAcc(c.from_account);
                          setToAcc(c.to_account);
                          setContraAmount(String(c.amount));
                          setContraDate(new Date(c.entry_date).toISOString().split('T')[0]);
                          setContraDesc(c.description || '');
                          setContraRef(c.reference_no || '');
                          setShowForm(true);
                        }}
                        className="text-teal-400 hover:text-teal-600 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={() => { if(confirm('Delete this contra entry?')) deleteMutation.mutate(c.id); }}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(listData?.items?.length) && <p className="text-center text-gray-400 py-10 text-sm">No contra entries in this period</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Cashbook Tab
// ─────────────────────────────────────────────────────────────────────────────
function CashbookTab() {
  const [from, setFrom] = useState(FIRST_OF_MONTH);
  const [to, setTo] = useState(TODAY_STR);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['web-cashbook', from, to],
    queryFn: () => accountingApi.getCashbook(from, to).then((r) => r.data.data),
  });

  let runningBal = data?.opening_balance ?? 0;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-4">
        <div><label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
        <div><label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Opening Balance" value={fmt(data.opening_balance)} color="bg-gray-50" textColor="text-gray-800" />
          <StatCard label="Total Receipts (In)" value={fmt(data.total_credit)} color="bg-green-50" textColor="text-green-700" />
          <StatCard label="Total Payments (Out)" value={fmt(data.total_debit)} color="bg-red-50" textColor="text-red-600" />
          <StatCard label="Net Cash Flow" value={fmt(data.net)} color={data.net >= 0 ? 'bg-blue-50' : 'bg-orange-50'} textColor={data.net >= 0 ? 'text-blue-700' : 'text-orange-700'} />
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" /></div> : data ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest">
              <th className="text-left px-5 py-4">Date</th><th className="text-left px-5 py-4">Narration</th>
              <th className="text-right px-5 py-4">Debit (OUT)</th><th className="text-right px-5 py-4">Credit (IN)</th>
              <th className="text-right px-5 py-4">Balance</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              <tr className="bg-gray-50/50 italic group">
                <td className="px-5 py-3 text-gray-400 text-[10px] font-bold">{new Date(from).toLocaleDateString('en-IN')}</td>
                <td className="px-5 py-3 text-gray-400 text-[10px] font-black uppercase tracking-wider">Opening Balance (B/F)</td>
                <td className="px-5 py-3 text-right text-gray-300">—</td>
                <td className="px-5 py-3 text-right text-gray-300">—</td>
                <td className="px-5 py-3 text-right text-gray-900 font-black">{fmt(data.opening_balance)}</td>
              </tr>
              {(data.lines as any[]).map((line: any, i: number) => {
                runningBal = Math.round((runningBal + line.credit - line.debit) * 100) / 100;
                return (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 text-[10px] font-bold whitespace-nowrap">{new Date(line.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-3 text-gray-700 text-xs font-semibold">{line.narration}</td>
                    <td className="px-5 py-3 text-right text-red-600 text-sm font-black">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
                    <td className="px-5 py-3 text-right text-emerald-600 text-sm font-black">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                    <td className={`px-5 py-3 text-right text-sm font-black ${runningBal >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>{fmt(runningBal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={2} className="px-5 py-3 font-bold text-gray-700">Total</td>
                <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(data.total_debit)}</td>
                <td className="px-5 py-3 text-right font-bold text-green-600">{fmt(data.total_credit)}</td>
                <td className="px-5 py-3 text-right font-bold text-gray-800">{fmt(data.net)}</td>
              </tr>
            </tfoot>
          </table>
          {!data.lines.length && <p className="text-center text-gray-400 py-10 text-sm">No cash transactions in this period</p>}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bankbook Tab
// ─────────────────────────────────────────────────────────────────────────────
function BankbookTab() {
  const [from, setFrom] = useState(FIRST_OF_MONTH);
  const [to, setTo] = useState(TODAY_STR);
  const [method, setMethod] = useState('');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['web-bankbook', from, to, method],
    queryFn: () => accountingApi.getBankbook(from, to, method || undefined).then((r) => r.data.data),
  });

  const methodBadge: Record<string, string> = {
    upi: 'bg-purple-100/50 text-purple-700', neft: 'bg-blue-100/50 text-blue-700',
    cheque: 'bg-gray-100/80 text-gray-700', card: 'bg-indigo-100/50 text-indigo-700',
  };

  let runningBal = data?.opening_balance ?? 0;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-end gap-4">
        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">From Date</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-100 bg-gray-50/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" /></div>
        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">To Date</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-100 bg-gray-50/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" /></div>
        <div className="w-44">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Filter Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border border-gray-100 bg-gray-50/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-bold text-gray-700">
            <option value="">All Bank Accounts</option>
            <option value="upi">UPI (GPay/PhonePe)</option>
            <option value="neft">NEFT/RTGS</option>
            <option value="cheque">Cheque Clearings</option>
            <option value="card">Card Payments</option>
          </select>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Opening Balance" value={fmt(data.opening_balance)} color="bg-gray-50" textColor="text-gray-800" />
          <StatCard label="Total Receipts (In)" value={fmt(data.total_credit)} color="bg-green-50" textColor="text-green-700" />
          <StatCard label="Total Payments (Out)" value={fmt(data.total_debit)} color="bg-red-50" textColor="text-red-600" />
          <StatCard label="Net Bank Flow" value={fmt(data.net)} color={data.net >= 0 ? 'bg-blue-50' : 'bg-orange-50'} textColor={data.net >= 0 ? 'text-blue-700' : 'text-orange-700'} />
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div> : data ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest">
              <th className="text-left px-5 py-4">Date</th>
              <th className="text-left px-5 py-4">Method</th>
              <th className="text-left px-5 py-4">Narration</th>
              <th className="text-right px-5 py-4">Debit (OUT)</th>
              <th className="text-right px-5 py-4">Credit (IN)</th>
              <th className="text-right px-5 py-4">Balance</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              <tr className="bg-gray-50/50 italic group">
                <td className="px-5 py-3 text-gray-400 text-[10px] font-bold">{new Date(from).toLocaleDateString('en-IN')}</td>
                <td className="px-5 py-3 text-gray-400 text-[10px] font-black uppercase tracking-wider" colSpan={2}>Opening Balance (B/F)</td>
                <td className="px-5 py-3 text-right text-gray-300">—</td>
                <td className="px-5 py-3 text-right text-gray-300">—</td>
                <td className="px-5 py-3 text-right text-gray-900 font-black">{fmt(data.opening_balance)}</td>
              </tr>
              {(data.lines as any[]).map((line: any, i: number) => {
                runningBal = Math.round((runningBal + line.credit - line.debit) * 100) / 100;
                return (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 text-[10px] font-bold whitespace-nowrap">{new Date(line.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${methodBadge[line.method] ?? 'bg-gray-100 text-gray-400'}`}>{line.method}</span></td>
                    <td className="px-5 py-3 text-gray-700 text-xs font-semibold">{line.narration}</td>
                    <td className="px-5 py-3 text-right text-red-600 text-sm font-black">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
                    <td className="px-5 py-3 text-right text-emerald-600 text-sm font-black">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                    <td className={`px-5 py-3 text-right text-sm font-black ${runningBal >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>{fmt(runningBal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50 pb-2">
                <td colSpan={3} className="px-5 py-4 font-black text-gray-900 uppercase tracking-widest text-[10px]">Total for filtered period</td>
                <td className="px-5 py-4 text-right font-black text-red-600">{fmt(data.total_debit)}</td>
                <td className="px-5 py-4 text-right font-black text-emerald-600">{fmt(data.total_credit)}</td>
                <td className="px-5 py-4 text-right font-black text-gray-900">{fmt(data.net)}</td>
              </tr>
            </tfoot>
          </table>
          {!data.lines.length && <p className="text-center text-gray-400 py-12 text-[10px] font-black uppercase tracking-widest">No bank transactions found in this range</p>}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Settings Tab
// ─────────────────────────────────────────────────────────────────────────────
function SettingsTab() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: shopRes } = useQuery({ queryKey: ['shop-profile'], queryFn: () => shopApi.getMyShop() });
  const shop = shopRes?.data?.data;

  const { data: accStatus, isLoading: statLoading } = useQuery({
    queryKey: ['accounting-status-settings'],
    queryFn: () => accountingApi.getStatus().then(r => r.data.data),
  });

  const [openingCash, setOpeningCash] = useState<string>('0');
  const [openingBank, setOpeningBank] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (accStatus) {
      setOpeningCash(String(accStatus.opening_cash_balance));
      setOpeningBank(String(accStatus.opening_bank_balance));
    }
  }, [accStatus]);

  const handleSaveOpening = async () => {
    setIsSaving(true);
    try {
      await accountingApi.updateOpeningBalances({
        cash: Number(openingCash || 0),
        bank: Number(openingBank || 0)
      });
      alert('Opening balances updated successfully!');
      qc.invalidateQueries({ queryKey: ['accounting-status'] });
      qc.invalidateQueries({ queryKey: ['accounting-status-settings'] });
    } catch (err) {
      alert('Failed to update opening balances');
    } finally {
      setIsSaving(false);
    }
  };

  const { data: backups, refetch: refetchBackups } = useQuery<any>({
    queryKey: ['web-backups'],
    queryFn: () => accountingApi.getBackupList().then(r => r.data.data),
  });

  const handleManualDownload = async () => {
    try {
      const res = await accountingApi.backup();
      const data = res.data.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rxdesk_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Local backup failed. Please check your connection.');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('This will OVERWRITE your current accounting data. Are you sure you want to continue?')) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await accountingApi.restore(data);
      alert('Data successfully restored!');
      qc.invalidateQueries();
    } catch (err) {
      alert('Restore failed. Please ensure the file is a valid RxDesk backup.');
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Backup Card */}
        <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-start gap-6">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Backup Data</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">Download a complete copy of your accounting records to your local computer.</p>
          </div>
          <button
            onClick={handleManualDownload}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-3xl text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-95 mt-auto"
          >
            Download Backup
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-start gap-6">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Restore Data</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">Upload an RxDesk backup file (.json) to restore your accounting data.</p>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleRestore} accept=".json" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-3xl text-sm font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all hover:scale-[1.02] active:scale-95 mt-auto"
          >
            Upload & Restore
          </button>
        </div>

        {/* Opening Balances Card */}
        <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-start gap-6 md:col-span-2">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 shadow-sm">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="w-full">
            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-1">Set Opening Balances</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">Enter your starting liquidity (Cash and Bank) when you first joined RxDesk.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Opening Cash</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">₹</span>
                  <input 
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl pl-8 pr-4 py-4 text-lg font-black text-gray-900 focus:ring-2 focus:ring-violet-400 transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Opening Bank</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">₹</span>
                  <input 
                    type="number"
                    value={openingBank}
                    onChange={(e) => setOpeningBank(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl pl-8 pr-4 py-4 text-lg font-black text-gray-900 focus:ring-2 focus:ring-violet-400 transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleSaveOpening}
            disabled={isSaving}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white py-4 rounded-3xl text-sm font-black uppercase tracking-widest shadow-lg shadow-violet-100 transition-all hover:scale-[1.01] active:scale-95"
          >
            {isSaving ? 'Saving Changes...' : 'Update Starting Balances'}
          </button>
        </div>

        {/* Automated Local Backup Agent Card */}
        <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-start gap-6 md:col-span-2">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
          </div>
          <div className="w-full">
            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-1">Automated Local Backup Agent</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">Setup a Python script on your personal computer to automatically download backups of your shop's data every day. It keeps only the last 3 backups locally for safety.</p>
            
            <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Agent API Key</p>
                  <p className="text-sm font-mono font-bold text-gray-800 tracking-wider mt-1 px-1 bg-white/60 py-1.5 rounded-lg border border-indigo-50 inline-block overflow-hidden max-w-sm truncate whitespace-nowrap">
                    {shop?.backup_api_key ?? 'No key generated yet'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm('Regenerating will invalidate the old key on your agent. Proceed?')) {
                      try {
                        const res = await shopApi.generateBackupApiKey();
                        qc.setQueryData(['shop-profile'], (old: any) => ({
                          ...old,
                          data: { ...old.data, backup_api_key: res.data.data.backup_api_key }
                        }));
                        alert('New API Key generated successfully!');
                        qc.invalidateQueries({ queryKey: ['shop-profile'] });
                      } catch (err) {
                        alert('Generation failed');
                      }
                    }
                  }}
                  className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                  title="Generate/Refresh Key"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </button>
              </div>
              <p className="text-[10px] text-indigo-400 font-bold leading-relaxed px-1">
                <span className="text-indigo-600">IMPORTANT:</span> Use this key in your local agent script for authentication. It doesn't count as a session and won't log you out from other devices.
              </p>
            </div>

            <div className="space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <button
                   onClick={() => {
                     const pyScript = `import requests
import json
import time
import os
from datetime import datetime

# --- CONFIGURATION ---
API_KEY = "${shop?.backup_api_key ?? 'YOUR_API_KEY_HERE'}"
BASE_URL = "${(process.env.NEXT_PUBLIC_API_URL || 'https://backend.rxdesk.in').replace('/v1', '')}"
BACKUP_DIR = os.path.join(os.path.expanduser('~'), 'Documents', 'RxDesk_Backups')
KEEP_FILES = 3

def perform_backup():
    print(f"[{datetime.now()}] Starting automated backup...")
    if not os.path.exists(BACKUP_DIR): os.makedirs(BACKUP_DIR)
    
    headers = {'x-api-key': API_KEY}
    try:
        r = requests.get(f"{BASE_URL}/api/v1/accounting/agent-backup", headers=headers)
        r.raise_for_status()
        data = r.json()
        
        if data.get('success'):
            shop_name = data.get('shop_name', 'shop').replace(' ', '_').lower()
            filename = f"{shop_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            filepath = os.path.join(BACKUP_DIR, filename)
            
            with open(filepath, 'w') as f:
                json.dump(data['data'], f, indent=2)
            
            print(f"[{datetime.now()}] Backup successful: {filename}")
            prune_backups()
        else:
            print(f"[{datetime.now()}] ERROR: {data.get('error')}")
    except Exception as e:
        print(f"[{datetime.now()}] FATAL: {str(e)}")

def prune_backups():
    files = [os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if f.endswith('.json')]
    files.sort(key=os.path.getmtime, reverse=True)
    if len(files) > KEEP_FILES:
        for f in files[KEEP_FILES:]:
            os.remove(f)
            print(f"[{datetime.now()}] Pruned old backup: {os.path.basename(f)}")

if __name__ == "__main__":
    if API_KEY == "YOUR_API_KEY_HERE":
        print("ERROR: Please set your Backup API Key first.")
    else:
        perform_backup()
`;
                     const blob = new Blob([pyScript], { type: 'text/x-python' });
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = 'rxdesk_backup_agent.py';
                     a.click();
                     window.URL.revokeObjectURL(url);
                   }}
                   className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border-2 border-indigo-100 text-indigo-600 p-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                 >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                   Get Py Script
                 </button>

                 <button
                   onClick={() => {
                     const installerPath = "C:\\\\RxDesk_BackupAgent";
                     const apiKey = shop?.backup_api_key ?? "YOUR_API_KEY_HERE";
                     const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://backend.rxdesk.in').replace('/v1', '');
                     
                     const batContent = `@echo off
TITLE RxDesk Backup Agent Installer
SET "INSTALL_PATH=${installerPath}"
SET "API_KEY=${apiKey}"

echo ----------------------------------------------------
echo         RxDesk Backup Agent Installer
echo ----------------------------------------------------
echo [*] Target Directory: %INSTALL_PATH%

if not exist "%INSTALL_PATH%" (
    echo [*] Creating directory...
    mkdir "%INSTALL_PATH%"
)

echo [*] Creating backup script...
(
echo import requests
echo import json
echo import os
echo from datetime import datetime
echo.
echo API_KEY = "%API_KEY%"
echo BASE_URL = "${baseUrl}"
echo BACKUP_DIR = os.path.join(os.path.expanduser('~'), 'Documents', 'RxDesk_Backups')
echo KEEP_FILES = 3
echo.
echo def run():
echo     if not os.path.exists(BACKUP_DIR^): os.makedirs(BACKUP_DIR^)
echo     try:
echo         r = requests.get(f"{BASE_URL}/api/v1/accounting/agent-backup", headers={'x-api-key': API_KEY}^)
echo         r.raise_for_status(^)
echo         data = r.json(^)
echo         if data.get('success'^):
echo             shop_name = data.get('shop_name', 'shop'^).replace(' ', '_'^).lower(^)
echo             fname = f"{shop_name}_{datetime.now(^).strftime('%%Y%%m%%d'^)}.json"
echo             with open(os.path.join(BACKUP_DIR, fname^), 'w'^) as f: json.dump(data['data'], f, indent=2^)
echo             print("Backup successful."^)
echo             files = [os.path.join(BACKUP_DIR, f^) for f in os.listdir(BACKUP_DIR^) if f.endswith('.json')]
echo             files.sort(key=os.path.getmtime, reverse=True^)
echo             for f in files[KEEP_FILES:]: os.remove(f^)
echo         else: print("Error: " + data.get('error'^)^)
echo     except Exception as e: print("Fatal: " + str(e^)^)
echo.
echo if __name__ == "__main__": run(^)
) > "%INSTALL_PATH%\\backup_agent.py"

echo [*] Checking for Python...
python --version >nul 2>&1
if %%ERRORLEVEL%% neq 0 (
    echo [!] Python not found! Please install Python 3.x from python.org
    pause
    exit
)

echo [*] Installing dependencies...
python -m pip install requests --quiet

echo [*] Scheduling daily task at 2:00 AM...
schtasks /create /tn "RxDesk_Daily_Backup" /tr "python %INSTALL_PATH%\\backup_agent.py" /sc daily /st 02:00 /f

echo.
echo ----------------------------------------------------
echo [SUCCESS] Agent installed and Task Scheduled!
echo Backups will be saved to your Documents folder.
echo ----------------------------------------------------
pause
`;
                     const blob = new Blob([batContent], { type: 'application/x-bat' });
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = 'rxdesk_setup.bat';
                     a.click();
                     window.URL.revokeObjectURL(url);
                   }}
                   className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-slate-900 text-white p-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100"
                 >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                   One-Click Installer (Windows)
                 </button>
               </div>
               <p className="text-[10px] text-gray-400 font-bold uppercase text-center mt-2">Installer automatically creates a Windows Task for daily 2AM backups.</p>
            </div>
          </div>

      </div>
    </div>

      {/* Server Backups */}
      <div className="bg-gray-50/50 rounded-[2.5rem] p-8 border border-gray-100">
        <div className="flex items-center justify-between mb-6 px-2">
          <div>
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Recent Server Records</h4>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Manual backups saved on your server disk</p>
          </div>
          <button onClick={() => refetchBackups()} className="w-10 h-10 rounded-full bg-white text-gray-400 flex items-center justify-center hover:text-violet-600 shadow-sm transition-all italic font-black">↻</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {backups?.length ? backups.slice(0, 4).map((b: any) => (
            <div key={b.filename} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-violet-200 transition-all">
              <div className="min-w-0 pl-1">
                <p className="text-[11px] font-black text-gray-900 truncate mb-0.5">{b.filename}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{new Date(b.date).toLocaleDateString()} • {(b.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'https://backend.rxdesk.in'}/api/v1/accounting/backups/download/${b.filename}`, '_blank')}
                className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-all shadow-sm shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </button>
            </div>
          )) : (
            <div className="col-span-full py-12 text-center flex flex-col items-center gap-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No server-side backups found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('P&L');
  const [selectedSaleReturnId, setSelectedSaleReturnId] = useState<string | null>(null);
  const [selectedPurchaseReturnId, setSelectedPurchaseReturnId] = useState<string | null>(null);
  const { data: shopRes } = useQuery({ queryKey: ['shop-profile'], queryFn: () => shopApi.getMyShop() });
  const shop = shopRes?.data?.data;

  const { data: statusRes, isLoading: statLoading } = useQuery({
    queryKey: ['accounting-status'],
    queryFn: () => accountingApi.getStatus().then(r => r.data.data),
  });
  const accStatus = statusRes;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="print:hidden space-y-6">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Financial Center</h1>
            <p className="text-gray-500 text-sm font-medium">Manage ledger, expenses, and supplier invoices</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cash Balance</p>
                <p className="text-lg font-black text-gray-900">{statLoading ? '...' : fmt(accStatus?.cash_balance ?? 0)}</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Bank Balance</p>
                <p className="text-lg font-black text-gray-900">{statLoading ? '...' : fmt(accStatus?.bank_balance ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur-md py-2 border-b border-gray-100 -mx-6 px-6">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${activeTab === tab
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 ring-2 ring-violet-100'
                  : 'text-gray-500 hover:bg-white hover:text-gray-900'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'P&L' && <PLTab />}
        {activeTab === 'Expenses' && <ExpensesTab />}
        {activeTab === 'Suppliers' && <SuppliersTab shopGstType={shop?.gst_type} />}
        {activeTab === 'Purchases' && <PurchasesTab />}
        {activeTab === 'Outstandings' && <OutstandingsTab />}
        {activeTab === 'GST' && <GSTTab />}
        {activeTab === 'Sale Ret.' && <SaleReturnTab setSelectedReturnId={setSelectedSaleReturnId} />}
        {activeTab === 'Pur. Ret.' && <PurchaseReturnTab setSelectedReturnId={setSelectedPurchaseReturnId} />}
        {activeTab === 'Contra' && <ContraTab />}
        {activeTab === 'Cashbook' && <CashbookTab />}
        {activeTab === 'Bankbook' && <BankbookTab />}
        {activeTab === 'Settings' && <SettingsTab />}
      </div>

      {/* Modals - Rendered outside print-hidden content */}
      {selectedSaleReturnId && <SaleReturnDetailModal id={selectedSaleReturnId} onClose={() => setSelectedSaleReturnId(null)} />}
      {selectedPurchaseReturnId && <PurchaseReturnDetailModal id={selectedPurchaseReturnId} onClose={() => setSelectedPurchaseReturnId(null)} />}
    </div>
  );
}
