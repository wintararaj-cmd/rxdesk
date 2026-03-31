'use client';

import React from 'react';
import { ChevronLeft, Printer, BookOpen, Calculator, FileText, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';

export default function AccountingSOPPage() {
  const printSOP = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Navigation Header */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <Link 
          href="/dashboard/help"
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-violet-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Help Center
        </Link>
        <button 
          onClick={printSOP}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:scale-105 transition-all"
        >
          <Printer className="w-4 h-4" />
          Print SOP
        </button>
      </div>

      {/* Main Document */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-indigo-50/50 overflow-hidden">
        {/* Document Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
              <BookOpen className="w-3 h-3" />
              Standard Operating Procedure
            </div>
            <h1 className="text-4xl font-black tracking-tight leading-tight">Accounting & Financial Management</h1>
            <div className="flex flex-wrap gap-6 mt-6">
              <div className="flex items-center gap-2 text-indigo-100 text-xs font-bold">
                <span className="opacity-60 uppercase tracking-widest">Effective:</span>
                <span>2026-03-31</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-100 text-xs font-bold">
                <span className="opacity-60 uppercase tracking-widest">Version:</span>
                <span>v1.2 (Unified)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-12 space-y-12">
          {/* Section 1 */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">1. Dashboard Architecture</h2>
            </div>
            <p className="text-gray-600 font-medium leading-relaxed">
              The accounting system is organized into 7 primary categories designed for role-based efficiency. 
              Always ensure you are in the correct tab before recording transactions.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { t: 'Reports', d: 'P&L, Balance Sheet, GST filings.' },
                { t: 'Vouchers', d: 'Daily receipts, payments, journals.' },
                { t: 'Purchases', d: 'Inward invoices and supplier ledgers.' },
                { t: 'Returns', d: 'Sales and Purchase return management.' },
                { t: 'Books', d: 'Cash, Bank, and General Ledger reviews.' },
                { t: 'Outstandings', d: 'Dues from customers and to suppliers.' },
                { t: 'Setup', d: 'One-time configuration and COA init.' }
              ].map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{item.t}</span>
                  <p className="text-sm text-gray-700 font-bold">{item.d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
                <Calculator className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">2. Recording Vouchers</h2>
            </div>
            
            <div className="space-y-4">
              <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <h3 className="font-black text-sm uppercase tracking-wider">Receipts & Payments</h3>
                </div>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  Daily operational expenses like rent, electricity, and salaries must be recorded under the <strong>Vouchers &rarr; Receipts &amp; Payments</strong> sub-tab.
                </p>
                <ul className="text-xs text-gray-500 space-y-2 list-disc pl-5 font-bold">
                  <li>Select "Payment" for cash outflow.</li>
                  <li>Link the transaction to an appropriate Expense Head (e.g., Staff Salary).</li>
                  <li>Verify the Payment Method (Cash/Bank) is correct to avoid Book mismatches.</li>
                </ul>
              </div>

              <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-violet-600 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <h3 className="font-black text-sm uppercase tracking-wider">Journal Adjustments</h3>
                </div>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  Use manual journals for depreciation, GST adjustments, or correcting ledger errors.
                </p>
                <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 border border-amber-100">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                    Always include a detailed "Narration" for every Journal entry. Total Debits must exactly match Total Credits for the entry to be authorized.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Info className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">3. Error Correction Policy</h2>
            </div>
            <div className="bg-gray-900 text-white p-8 rounded-[2rem] space-y-4">
              <h4 className="text-lg font-black tracking-tight">Voiding Manual Entries</h4>
              <p className="text-gray-400 text-sm font-medium leading-relaxed">
                If a mistake is made in a Journal or Voucher, use the new <strong>Delete</strong> functionality available in the entry list. 
              </p>
              <div className="pt-4 border-t border-white/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-rose-500/50 flex items-center justify-center">
                  <AlertTriangle className="text-rose-500 w-6 h-6" />
                </div>
                <p className="text-xs text-gray-300 font-bold uppercase tracking-widest">
                  Deletion will immediately affect P&amp;L and Balance Sheet totals.
                </p>
              </div>
            </div>
          </section>

          {/* Footer Info */}
          <div className="pt-12 border-t border-gray-100 flex flex-col md:flex-row justify-between gap-6 opacity-60">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              RxDesk Quality Assurance &bull; Compliance Section
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">
              Confidential &bull; INTERNAL USE ONLY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
