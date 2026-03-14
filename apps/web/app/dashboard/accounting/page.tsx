'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, inventoryApi, medicinesApi } from '../../../lib/apiClient';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function pct(part: number, total: number) {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
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
  gstin: string | null;
}

interface Purchase {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  supplier: { name: string } | null;
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

// ── panel tabs ────────────────────────────────────────────────────────────────
const TABS = ['P&L', 'Expenses', 'Suppliers', 'Purchases', 'Credit', 'GST', 'Sale Ret.', 'Pur. Ret.', 'Contra', 'Cashbook', 'Bankbook'] as const;
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

  const CATS = ['rent', 'salary', 'electricity', 'water', 'phone', 'internet', 'maintenance', 'transport', 'advertising', 'miscellaneous'];

  const { data, isLoading } = useQuery<{ items: Expense[]; total: number }>({
    queryKey: ['web-expenses'],
    queryFn: () => accountingApi.listExpenses().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: object) => accountingApi.createExpense(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-expenses'] });
      qc.invalidateQueries({ queryKey: ['web-pl'] });
      setShowForm(false);
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
          <h3 className="font-semibold text-gray-700 mb-4">New Expense</h3>
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
                    {!e.is_auto_entry && (
                      <button
                        onClick={() => deleteMutation.mutate(e.id)}
                        className="text-red-400 hover:text-red-600 transition-colors text-xs"
                      >
                        Delete
                      </button>
                    )}
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

// ─────────────────────────────────────────────────────────────────────────────
//  Suppliers Tab
// ─────────────────────────────────────────────────────────────────────────────
function SuppliersTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [gstin, setGstin] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Supplier[]>({
    queryKey: ['web-suppliers'],
    queryFn: () => accountingApi.listSuppliers().then((r) => r.data.data),
  });

  const { data: ledger } = useQuery({
    queryKey: ['web-supplier-ledger', expandedId],
    queryFn: () => accountingApi.getSupplierLedger(expandedId!).then((r) => r.data.data),
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: (d: object) => accountingApi.createSupplier(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-suppliers'] });
      setShowForm(false);
      setSupplierName('');
      setContactPerson('');
      setPhone('');
      setCity('');
      setGstin('');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deactivateSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['web-suppliers'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + Add Supplier
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100">
          <h3 className="font-semibold text-gray-700 mb-4">New Supplier</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Supplier Name *', value: supplierName, set: setSupplierName, placeholder: 'Medico Pharma' },
              { label: 'Contact Person', value: contactPerson, set: setContactPerson, placeholder: 'Raj Kumar' },
              { label: 'Phone', value: phone, set: setPhone, placeholder: '9876543210' },
              { label: 'City', value: city, set: setCity, placeholder: 'Mumbai' },
              { label: 'GSTIN', value: gstin, set: setGstin, placeholder: '27AAACR0345E1ZZ' },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-gray-500 text-xs block mb-1">{f.label}</label>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                if (!supplierName.trim()) return;
                createMutation.mutate({
                  name: supplierName.trim(),
                  contact_person: contactPerson.trim() || undefined,
                  phone: phone.trim() || undefined,
                  city: city.trim() || undefined,
                  gstin: gstin.trim() || undefined,
                });
              }}
              disabled={createMutation.isPending}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Saving...' : 'Save'}
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
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.gstin ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        className="text-indigo-500 hover:text-indigo-700 text-xs mr-4 transition-colors"
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
const EMPTY_PI_ITEM = { medicine_name: '', unit: 'strip', batch_number: '', expiry_date: '', quantity: '1', free_qty: '', purchase_price: '', mrp: '', discount_pct: '', gst_rate: '12' };
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
  const [suggestions, setSuggestions] = useState<Record<number, { id: string; medicine_name: string; mrp: number; gst_rate: number }[]>>({});
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
  const piAddRowBtnRef = useRef<HTMLButtonElement | null>(null);
  const piInvoiceNoRef = useRef<HTMLInputElement | null>(null);
  const piInvDateRef = useRef<HTMLInputElement | null>(null);
  const piReceivedDateRef = useRef<HTMLInputElement | null>(null);

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
    mutationFn: (payload: object) => accountingApi.createPurchase(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-purchases'] });
      resetForm();
      setShowForm(false);
    },
  });

  const resetForm = () => {
    setSupplierId(''); setInvoiceNumber(''); setInvoiceDate(TODAY_STR);
    setReceivedDate(TODAY_STR); setNotes('');
    setPiItems([{ ...EMPTY_PI_ITEM }]); setSuggestions({}); setSuggHighlights({});
  };

  const updatePiItem = (idx: number, field: keyof PIItem, value: string) => {
    setPiItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'medicine_name') {
      if (searchTimers.current[idx]) clearTimeout(searchTimers.current[idx]);
      if (value.length < 2) { setSuggestions((p) => ({ ...p, [idx]: [] })); setSuggHighlights((p) => ({ ...p, [idx]: -1 })); return; }
      searchTimers.current[idx] = setTimeout(async () => {
        try {
          const res = await inventoryApi.list({ q: value, limit: 8 });
          const invItems = res.data.data ?? [];
          if (invItems.length > 0) {
            setSuggestions((p) => ({ ...p, [idx]: invItems }));
          } else {
            // Fall back to global medicine catalog for new shops / unknown medicines
            const medRes = await medicinesApi.catalog({ q: value });
            const catalogItems = (medRes.data.data ?? []).slice(0, 8).map((m: any) => ({
              id: m.id,
              medicine_name: m.name,
              mrp: 0,
              gst_rate: m.gst_rate ?? 12,
            }));
            setSuggestions((p) => ({ ...p, [idx]: catalogItems }));
          }
          setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
        } catch { /* ignore */ }
      }, 250);
    }
  };

  const selectSuggestion = (idx: number, inv: { medicine_name: string; mrp: number; gst_rate: number; unit?: string }) => {
    setPiItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, medicine_name: inv.medicine_name, mrp: String(inv.mrp), gst_rate: String(inv.gst_rate ?? 12), unit: inv.unit ?? it.unit } : it
    ));
    setSuggestions((p) => ({ ...p, [idx]: [] }));
    setSuggHighlights((p) => ({ ...p, [idx]: -1 }));
    setTimeout(() => piUnitRefs.current[idx]?.focus(), 0);
  };

  const addPiItem = () => setPiItems((p) => [...p, { ...EMPTY_PI_ITEM }]);
  const removePiItem = (idx: number) => setPiItems((p) => p.filter((_, i) => i !== idx));

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
    const validItems = piItems.filter((it) => it.medicine_name && it.batch_number && it.expiry_date && Number(it.purchase_price) > 0 && Number(it.quantity) > 0);
    if (!validItems.length || !invoiceDate) return;
    createMutation.mutate({
      supplier_id: supplierId || undefined,
      invoice_number: invoiceNumber || undefined,
      invoice_date: invoiceDate,
      received_date: receivedDate || invoiceDate,
      notes: notes || undefined,
      items: validItems.map((it) => ({
        medicine_name: it.medicine_name,
        unit: it.unit || 'strip',
        batch_number: it.batch_number,
        expiry_date: it.expiry_date,
        quantity: Number(it.quantity),
        free_qty: Number(it.free_qty) || 0,
        purchase_price: Number(it.purchase_price),
        mrp: Number(it.mrp) || Number(it.purchase_price),
        discount_pct: Number(it.discount_pct) || 0,
        gst_rate: Number(it.gst_rate) || 12,
      })),
    });
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
          <h3 className="font-bold text-gray-800 text-base">New Purchase Invoice</h3>

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
            <div className="grid gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2" style={{gridTemplateColumns:'2.5fr 1fr 1.5fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 80px 32px'}}>
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
            </div>
            <div className="space-y-2">
              {piItems.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="grid gap-2 items-start" style={{gridTemplateColumns:'2.5fr 1fr 1.5fr 0.8fr 0.8fr 1fr 1fr 0.8fr 1fr 80px 32px'}}>
                    {/* Medicine Name with autocomplete */}
                    <div className="relative">
                      <input type="text" placeholder="Search medicine..." value={item.medicine_name}
                        ref={(el) => { piMedRefs.current[idx] = el; }}
                        onChange={(e) => updatePiItem(idx, 'medicine_name', e.target.value)}
                        onKeyDown={(e) => {
                          const suggs = suggestions[idx] ?? [];
                          const h = suggHighlights[idx] ?? -1;
                          if (e.key === 'ArrowDown') { e.preventDefault(); setSuggHighlights((p) => ({ ...p, [idx]: Math.min(h + 1, suggs.length - 1) })); }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggHighlights((p) => ({ ...p, [idx]: Math.max(h - 1, 0) })); }
                          else if (e.key === 'Enter' && h >= 0 && suggs[h]) { e.preventDefault(); selectSuggestion(idx, suggs[h]); }
                          else if (e.key === 'Enter' && (h < 0 || suggs.length === 0)) { e.preventDefault(); setSuggestions((p) => ({ ...p, [idx]: [] })); piUnitRefs.current[idx]?.focus(); }
                          else if (e.key === 'Escape') { setSuggestions((p) => ({ ...p, [idx]: [] })); setSuggHighlights((p) => ({ ...p, [idx]: -1 })); }
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 placeholder:text-gray-300 transition-all font-medium"
                      />
                      {suggestions[idx]?.length > 0 && (
                        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1">
                          {suggestions[idx].map((s, si) => (
                            <button key={s.id} type="button" onMouseDown={() => selectSuggestion(idx, s)}
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
                        className="w-full border border-gray-200 rounded-xl px-3 h-10 text-xs text-gray-900 outline-none focus:border-violet-500 shadow-sm font-mono placeholder:text-gray-300"
                      />
                      <input ref={(el) => { piExpiryRefs.current[idx] = el; }} type="date" value={item.expiry_date}
                        onChange={(e) => updatePiItem(idx, 'expiry_date', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piQtyRefs.current[idx]?.focus(); } }}
                        className="w-full border border-gray-200 rounded-xl px-2 h-10 text-xs text-gray-900 outline-none focus:border-violet-500 shadow-sm"
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
                        className="w-full border border-gray-200 rounded-xl px-2 h-10 text-sm font-bold text-indigo-600 outline-none focus:border-indigo-500 shadow-sm" />
                    </div>
                    <div>
                      <input ref={(el) => { piMrpRefs.current[idx] = el; }} type="number" min="0" step="0.01" placeholder="0.00" value={item.mrp} onChange={(e) => updatePiItem(idx, 'mrp', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); piAddRowBtnRef.current?.focus(); } }}
                        className="w-full border border-gray-200 rounded-xl px-2 h-10 text-sm font-black text-violet-700 outline-none focus:border-violet-500 shadow-sm" />
                    </div>
                    <div>
                      <input type="number" min="0" max="100" placeholder="0" value={item.discount_pct} onChange={(e) => updatePiItem(idx, 'discount_pct', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-1 h-10 text-sm text-center text-emerald-600 font-bold outline-none focus:border-emerald-500 shadow-sm" />
                    </div>
                    <div>
                      <select value={item.gst_rate} onChange={(e) => updatePiItem(idx, 'gst_rate', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-1 h-10 text-xs text-gray-900 outline-none focus:border-violet-500 bg-white font-semibold">
                        {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div className="pt-2.5 text-right font-black text-gray-900 text-sm font-mono truncate">
                      {lineTotal(item) > 0 ? fmt(lineTotal(item)) : '—'}
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
            <input type="text" placeholder="e.g. Credit 30 days" value={notes} onChange={(e) => setNotes(e.target.value)}
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
                {createMutation.isPending ? 'Processing…' : 'Finalize & Save Invoice'}
              </button>
            </div>
          </div>
          {createMutation.isError && (
            <p className="text-red-500 text-xs mt-1">
              {(createMutation.error as any)?.response?.data?.error?.message ?? 'Failed to save. Please check all fields.'}
            </p>
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
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${
                      p.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                      p.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-violet-600 group-hover:border-violet-200 transition-all shadow-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
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
        <PurchaseDetailModal id={selectedPurchaseId} onClose={() => setSelectedPurchaseId(null)} />
      )}
    </div>
  );
}

function PurchaseDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: p, isLoading } = useQuery<any>({
    queryKey: ['web-purchase-detail', id],
    queryFn: () => accountingApi.getPurchaseById(id).then((r) => r.data.data),
  });

  if (isLoading) return null; // or small loader overlay

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
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors shadow-sm">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
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

// ─────────────────────────────────────────────────────────────────────────────
//  Credit Tab
// ─────────────────────────────────────────────────────────────────────────────
function CreditTab() {
  const { data: rawCredit, isLoading } = useQuery<{ customers: CreditCustomer[] }>({
    queryKey: ['web-credit-customers'],
    queryFn: () => accountingApi.listCreditCustomers().then((r) => r.data.data),
  });
  const data = rawCredit?.customers;

  const totalOutstanding = (data ?? []).reduce((s, c) => s + Number(c.total_outstanding), 0);
  const overdueCount = (data ?? []).filter((c) => c.overdue).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Outstanding" value={fmt(totalOutstanding)} color="bg-orange-50" textColor="text-orange-700" />
        <StatCard label="Customers" value={String(data?.length ?? 0)} sub={`${overdueCount} overdue`} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-5 py-3">Customer</th>
                <th className="text-left px-5 py-3">Phone</th>
                <th className="text-left px-5 py-3">Last Transaction</th>
                <th className="text-right px-5 py-3">Outstanding</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data ?? []).map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50/50 ${c.overdue ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-5 py-3 text-gray-500">{c.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {c.updated_at
                      ? new Date(c.updated_at).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td className={`px-5 py-3 text-right font-bold ${Number(c.total_outstanding) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmt(Number(c.total_outstanding))}
                  </td>
                  <td className="px-5 py-3">
                    {c.overdue ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Overdue</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && (
            <p className="text-center text-gray-400 py-10 text-sm">No credit customers</p>
          )}
        </div>
      )}
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

function SaleReturnTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [returnDate, setReturnDate] = useState(TODAY_STR);
  const [refundMethod, setRefundMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [srItems, setSrItems] = useState<SRItem[]>([{ ...EMPTY_SR_ITEM }]);
  const [srSuggestions, setSrSuggestions] = useState<Record<number, { id: string; medicine_name: string; unit?: string; mrp: number; gst_rate: number }[]>>({});
  const [srHighlights, setSrHighlights] = useState<Record<number, number>>({});
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
          <h3 className="font-bold text-gray-800">New Sale Return</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Refund Method</label>
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="grid gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1" style={{gridTemplateColumns:'2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.8fr 0.8fr 1fr'}}>
              <div>Medicine</div><div>Unit</div><div>Batch</div>
              <div>Qty</div><div>MRP (₹)</div>
              <div>Disc%</div><div>GST%</div><div className="text-right">Total</div>
            </div>
            <div className="space-y-2">
              {srItems.map((item, idx) => (
                <div key={idx} className="grid gap-1.5 items-center" style={{gridTemplateColumns:'2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.8fr 0.8fr 1fr'}}>
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
                  <div><select value={item.unit} onChange={(e) => updateSrItem(idx, 'unit', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs bg-white outline-none focus:border-orange-500">{['strip','bottle','packet','vial','tube','piece','box'].map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
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
                createMutation.mutate({ customer_name: customerName || undefined, return_date: returnDate, refund_method: refundMethod, reason: reason || undefined, items: valid.map((it) => ({ medicine_name: it.medicine_name, unit: it.unit || 'strip', batch_number: it.batch_number || undefined, quantity: Number(it.quantity), mrp: Number(it.mrp), gst_rate: Number(it.gst_rate) || 12, discount_pct: Number(it.discount_pct) || 0 })) });
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
const EMPTY_PR_ITEM = { medicine_name: '', unit: 'strip', batch_number: '', quantity: '1', purchase_price: '', gst_rate: '12' };
type PRItem = typeof EMPTY_PR_ITEM;

function PurchaseReturnTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [prSupplierId, setPrSupplierId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [prReturnDate, setPrReturnDate] = useState(TODAY_STR);
  const [prReason, setPrReason] = useState('');
  const [prItems, setPrItems] = useState<PRItem[]>([{ ...EMPTY_PR_ITEM }]);
  const [prSuggestions, setPrSuggestions] = useState<Record<number, { id: string; medicine_name: string; unit?: string; mrp: number; gst_rate: number }[]>>({});
  const [prHighlights, setPrHighlights] = useState<Record<number, number>>({});
  const prTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

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
      setPrSupplierId(''); setInvoiceRef(''); setPrReturnDate(TODAY_STR); setPrReason('');
      setShowForm(false);
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

  const prLineTotal = (it: PRItem) => Number(it.quantity) * Number(it.purchase_price) * (1 + (Number(it.gst_rate) || 0) / 100);
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
              <input type="text" placeholder="Original invoice no." value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
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
            <div className="grid gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1" style={{gridTemplateColumns:'2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.9fr 1fr'}}>
              <div>Medicine</div><div>Unit</div><div>Batch</div>
              <div>Qty</div><div>Cost (₹)</div>
              <div>GST%</div><div className="text-right">Total</div>
            </div>
            <div className="space-y-2">
              {prItems.map((item, idx) => (
                <div key={idx} className="grid gap-1.5 items-center" style={{gridTemplateColumns:'2.5fr 0.9fr 1.5fr 0.8fr 1.5fr 0.9fr 1fr'}}>
                  <div className="relative">
                    <input type="text" placeholder="Medicine name" value={item.medicine_name} onChange={(e) => updatePrItem(idx, 'medicine_name', e.target.value)}
                      onKeyDown={(e) => {
                        const suggs = prSuggestions[idx] ?? [];
                        const h = prHighlights[idx] ?? -1;
                        if (e.key === 'ArrowDown') { e.preventDefault(); setPrHighlights((p) => ({ ...p, [idx]: Math.min(h + 1, suggs.length - 1) })); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setPrHighlights((p) => ({ ...p, [idx]: Math.max(h - 1, 0) })); }
                        else if (e.key === 'Enter' && h >= 0 && suggs[h]) { e.preventDefault(); selectPrSug(idx, suggs[h]); }
                        else if (e.key === 'Escape') { setPrSuggestions((p) => ({ ...p, [idx]: [] })); setPrHighlights((p) => ({ ...p, [idx]: -1 })); }
                      }}
                      className="w-full border border-gray-200 rounded-lg px-2 h-8 text-xs outline-none focus:border-blue-500" />
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
                  <div><select value={item.unit} onChange={(e) => updatePrItem(idx, 'unit', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs bg-white outline-none focus:border-blue-500">{['strip','bottle','packet','vial','tube','piece','box'].map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
                  <div><input type="text" placeholder="Batch" value={item.batch_number} onChange={(e) => updatePrItem(idx, 'batch_number', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 h-8 text-xs outline-none focus:border-blue-500" /></div>
                  <div><input type="number" min="1" value={item.quantity} onChange={(e) => updatePrItem(idx, 'quantity', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs outline-none text-center focus:border-blue-500" /></div>
                  <div><input type="number" min="0" step="0.01" placeholder="0.00" value={item.purchase_price} onChange={(e) => updatePrItem(idx, 'purchase_price', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs outline-none focus:border-blue-500" /></div>
                  <div><select value={item.gst_rate} onChange={(e) => updatePrItem(idx, 'gst_rate', e.target.value)} className="w-full border border-gray-200 rounded-lg px-1 h-8 text-xs bg-white outline-none focus:border-blue-500">{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
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
                const valid = prItems.filter((it) => it.medicine_name && Number(it.quantity) > 0 && Number(it.purchase_price) > 0);
                if (!valid.length) return;
                createMutation.mutate({ supplier_id: prSupplierId || undefined, invoice_ref: invoiceRef || undefined, return_date: prReturnDate, reason: prReason || undefined, items: valid.map((it) => ({ medicine_name: it.medicine_name, unit: it.unit || 'strip', batch_number: it.batch_number || undefined, quantity: Number(it.quantity), purchase_price: Number(it.purchase_price), gst_rate: Number(it.gst_rate) || 12 })) });
              }} disabled={createMutation.isPending || !prItems.some((it) => it.medicine_name && Number(it.quantity) > 0 && Number(it.purchase_price) > 0)}
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
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{r.return_number}</td>
                  <td className="px-5 py-3 text-gray-600">{new Date(r.return_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-gray-800">{r.supplier?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.invoice_ref ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.reason ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-blue-600">{fmt(r.total_amount)}</td>
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

  const { data: listData, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['web-contra', contraFrom, contraTo],
    queryFn: () => accountingApi.listContraEntries({ from: contraFrom, to: contraTo }).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => accountingApi.createContraEntry(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-contra'] });
      setContraAmount(''); setContraDesc(''); setContraRef('');
      setFromAcc('cash'); setToAcc('upi'); setContraDate(TODAY_STR);
      setShowForm(false);
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
          <h3 className="font-bold text-gray-800 mb-4">New Contra Entry</h3>
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
                  <td className="px-5 py-3 text-right font-semibold text-teal-700">{fmt(c.amount)}</td>
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

  let runningBal = 0;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-4">
        <div><label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
        <div><label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Receipts (In)" value={fmt(data.total_credit)} color="bg-green-50" textColor="text-green-700" />
          <StatCard label="Total Payments (Out)" value={fmt(data.total_debit)} color="bg-red-50" textColor="text-red-600" />
          <StatCard label="Net Cash Flow" value={fmt(data.net)} color={data.net >= 0 ? 'bg-blue-50' : 'bg-orange-50'} textColor={data.net >= 0 ? 'text-blue-700' : 'text-orange-700'} />
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" /></div> : data ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-5 py-3">Date</th><th className="text-left px-5 py-3">Narration</th>
              <th className="text-right px-5 py-3">Debit (Out)</th><th className="text-right px-5 py-3">Credit (In)</th>
              <th className="text-right px-5 py-3">Balance</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(data.lines as any[]).map((line: any, i: number) => {
                runningBal = runningBal + line.credit - line.debit;
                return (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 text-gray-500 text-xs whitespace-nowrap">{new Date(line.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-2.5 text-gray-700 text-xs">{line.narration}</td>
                    <td className="px-5 py-2.5 text-right text-red-500 text-sm font-medium">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
                    <td className="px-5 py-2.5 text-right text-green-600 text-sm font-medium">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                    <td className={`px-5 py-2.5 text-right text-sm font-semibold ${runningBal >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{fmt(runningBal)}</td>
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
    upi: 'bg-purple-50 text-purple-700', neft: 'bg-blue-50 text-blue-700',
    cheque: 'bg-gray-100 text-gray-700', card: 'bg-indigo-50 text-indigo-700',
  };

  let runningBal = 0;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-4">
        <div><label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
        <div><label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="">All Bank</option>
            <option value="upi">UPI</option><option value="neft">NEFT</option>
            <option value="cheque">Cheque</option><option value="card">Card</option>
          </select>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Receipts (In)" value={fmt(data.total_credit)} color="bg-green-50" textColor="text-green-700" />
          <StatCard label="Total Payments (Out)" value={fmt(data.total_debit)} color="bg-red-50" textColor="text-red-600" />
          <StatCard label="Net Bank Flow" value={fmt(data.net)} color={data.net >= 0 ? 'bg-blue-50' : 'bg-orange-50'} textColor={data.net >= 0 ? 'text-blue-700' : 'text-orange-700'} />
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" /></div> : data ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-5 py-3">Date</th><th className="text-left px-5 py-3">Method</th>
              <th className="text-left px-5 py-3">Narration</th><th className="text-right px-5 py-3">Debit (Out)</th>
              <th className="text-right px-5 py-3">Credit (In)</th><th className="text-right px-5 py-3">Balance</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(data.lines as any[]).map((line: any, i: number) => {
                runningBal = runningBal + line.credit - line.debit;
                return (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 text-gray-500 text-xs whitespace-nowrap">{new Date(line.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs uppercase ${methodBadge[line.method] ?? 'bg-gray-50 text-gray-600'}`}>{line.method}</span></td>
                    <td className="px-5 py-2.5 text-gray-700 text-xs">{line.narration}</td>
                    <td className="px-5 py-2.5 text-right text-red-500 text-sm font-medium">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
                    <td className="px-5 py-2.5 text-right text-green-600 text-sm font-medium">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                    <td className={`px-5 py-2.5 text-right text-sm font-semibold ${runningBal >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{fmt(runningBal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={3} className="px-5 py-3 font-bold text-gray-700">Total</td>
                <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(data.total_debit)}</td>
                <td className="px-5 py-3 text-right font-bold text-green-600">{fmt(data.total_credit)}</td>
                <td className="px-5 py-3 text-right font-bold text-gray-800">{fmt(data.net)}</td>
              </tr>
            </tfoot>
          </table>
          {!data.lines.length && <p className="text-center text-gray-400 py-10 text-sm">No bank transactions in this period</p>}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('P&L');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
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
              <p className="text-lg font-black text-gray-900">₹45,230</p>
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
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                activeTab === tab
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
      {activeTab === 'Suppliers' && <SuppliersTab />}
      {activeTab === 'Purchases' && <PurchasesTab />}
      {activeTab === 'Credit' && <CreditTab />}
      {activeTab === 'GST' && <GSTTab />}
      {activeTab === 'Sale Ret.' && <SaleReturnTab />}
      {activeTab === 'Pur. Ret.' && <PurchaseReturnTab />}
      {activeTab === 'Contra' && <ContraTab />}
      {activeTab === 'Cashbook' && <CashbookTab />}
      {activeTab === 'Bankbook' && <BankbookTab />}
    </div>
  );
}
