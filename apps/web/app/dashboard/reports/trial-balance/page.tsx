'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../../lib/apiClient';
import { ChevronLeft, Printer, FileDown, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface TrialBalanceAccount {
  id: string;
  name: string;
  group_name: string;
  debit: number;
  credit: number;
}

interface TrialBalanceData {
  as_of: string;
  accounts: TrialBalanceAccount[];
  totals: {
    debit: number;
    credit: number;
  };
}

export default function TrialBalancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trial-balance', date],
    queryFn: () => accountingApi.getTrialBalance(date).then(r => r.data.data as TrialBalanceData),
  });

  const fmtCurrency = (v: number) =>
    v === 0 ? '-' : `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePrint = () => {
    window.print();
  };

  // Group accounts by group_name
  const groupedAccounts = data?.accounts.reduce((acc, curr) => {
    if (!acc[curr.group_name]) acc[curr.group_name] = [];
    acc[curr.group_name].push(curr);
    return acc;
  }, {} as Record<string, TrialBalanceAccount[]>) || {};

  const isBalanced = data ? Math.abs(data.totals.debit - data.totals.credit) < 0.1 : true;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <Link href="/dashboard/reports" className="flex items-center text-sm text-gray-500 hover:text-violet-600 mb-2 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-gray-500 text-sm">Summary of all ledger balances</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
            />
          </div>
          <button 
            onClick={handlePrint}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border-none">
        {/* Print Header */}
        <div className="hidden print:block p-8 text-center border-b border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Trial Balance</h1>
          <p className="text-gray-500">As of {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading trial balance data...</div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <p>Failed to load trial balance. Please try again.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Particulars</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Debit (₹)</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(groupedAccounts).map(([group, accounts]) => (
                  <React.Fragment key={group}>
                    <tr className="bg-gray-50/50">
                      <td colSpan={3} className="px-6 py-2 text-xs font-bold text-violet-600 uppercase tracking-tight">
                        {group}
                      </td>
                    </tr>
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-700">
                          {acc.name}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-right font-mono text-gray-600">
                          {fmtCurrency(acc.debit)}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-right font-mono text-gray-600">
                          {fmtCurrency(acc.credit)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-100">
                <tr className="font-bold text-gray-900">
                  <td className="px-6 py-4 text-sm text-right uppercase tracking-wider">Grand Total</td>
                  <td className="px-6 py-4 text-sm text-right font-mono">
                    {fmtCurrency(data?.totals.debit || 0)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-mono">
                    {fmtCurrency(data?.totals.credit || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!isLoading && !isBalanced && (
          <div className="p-4 bg-red-50 border-t border-red-100 flex items-center gap-3 text-red-700 text-sm animate-pulse">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p><strong>Warning:</strong> Trial Balance is not equal. Difference: {fmtCurrency(Math.abs((data?.totals.debit || 0) - (data?.totals.credit || 0)))}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
        <div className="bg-violet-50 rounded-2xl p-5 border border-violet-100">
          <h3 className="font-semibold text-violet-900 mb-1 flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            Accounting Tip
          </h3>
          <p className="text-xs text-violet-700 leading-relaxed text-pretty">
            The Trial Balance is a bookkeeping worksheet in which the balance of all ledgers are compiled into debit and credit account column totals that are equal. A trial balance is usually prepared at the end of every reporting period.
          </p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
          <h3 className="font-semibold text-emerald-900 mb-1 flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Report Sharing
          </h3>
          <p className="text-xs text-emerald-700 leading-relaxed text-pretty">
            You can use the print button above to save this report as a PDF for your accountant or to file with your quarterly statements. All Phase 1 entries (Bills, Purchases, Expenses) are automatically consolidated.
          </p>
        </div>
      </div>
    </div>
  );
}
