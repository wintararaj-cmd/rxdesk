'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../lib/apiClient';
import { IndianRupee, Calendar, Shop, CreditCard, Filter } from 'lucide-react';

interface Payment {
  id: string;
  shop_id: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  period_months: number;
  payment_method: string;
  transaction_id: string | null;
  payment_status: string;
  created_at: string;
  shop: { shop_name: string; contact_phone: string };
  plan: { name: string };
}

export default function RechargeReportPage() {
  const { data: reportRes, isLoading } = useQuery({
    queryKey: ['admin-recharge-report'],
    queryFn: () => adminApi.getRechargeReport().then(r => r.data.data),
  });

  const report = reportRes || { payments: [], total_collected: 0, total_count: 0 };
  const payments: Payment[] = report.payments;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recharge Report</h1>
          <p className="text-gray-500 text-sm mt-1">Track subscription revenue collected from shops.</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-violet-50 px-4 py-2 rounded-xl border border-violet-100">
                <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Total Collection</p>
                <p className="text-xl font-black text-violet-700">₹{report.total_collected.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Recharges</p>
                <p className="text-xl font-black text-gray-700">{report.total_count}</p>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Shop & Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Plan & Period</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Method & TXN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500 italic">No recharge records found.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{p.shop.shop_name}</p>
                      <p className="text-xs text-gray-500">{p.shop.contact_phone}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-700">{p.plan_name}</p>
                      <p className="text-xs text-violet-500 font-medium">{p.period_months} Months</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-base font-bold text-emerald-600">₹{p.amount}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">
                        {p.payment_method}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">{p.transaction_id || 'N/A'}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
