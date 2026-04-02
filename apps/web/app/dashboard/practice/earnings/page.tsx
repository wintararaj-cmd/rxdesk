'use client';

import { useQuery } from '@tanstack/react-query';
import { doctorApi } from '../../../../lib/apiClient';
import { 
  TrendingUp, 
  ArrowUpRight, 
  Calendar, 
  IndianRupee, 
  Download,
  Filter
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function EarningsPage() {
  const { data: earnings, isLoading } = useQuery({
    queryKey: ['doctor-earnings-detailed'],
    queryFn: () => doctorApi.getEarnings().then(res => res.data.data),
  });

  const chartData = earnings?.daily_breakdown?.map((day: any) => ({
    name: new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    revenue: day.amount,
  })) || [];

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Earnings Analysis</h1>
          <p className="text-gray-500 text-sm mt-1">Detailed performance tracking and revenue trends.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Chart Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <TrendingUp className="w-24 h-24 text-violet-500/5 rotate-12" />
            </div>
            
            <div className="flex items-center gap-6 mb-12">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Monthly Revenue</p>
                <h2 className="text-4xl font-black text-gray-900 flex items-center gap-2">
                  ₹{earnings?.monthly_total?.toLocaleString('en-IN')}
                  <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg flex items-center gap-1 font-black">
                    <ArrowUpRight className="w-3 h-3" /> 14%
                  </span>
                </h2>
              </div>
              <div className="w-px h-12 bg-gray-100 mx-4" />
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avg. Per Day</p>
                <h3 className="text-2xl font-bold text-gray-700">
                  ₹{(earnings?.monthly_total / 30 || 0).toFixed(0)}
                </h3>
              </div>
            </div>

            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '20px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      fontWeight: 900,
                      padding: '12px 20px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8b5cf6" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Recent Activity Breakdown</h3>
              <Calendar className="w-5 h-5 text-gray-300" />
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Direct Revenue</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {earnings?.daily_breakdown?.map((day: any) => (
                  <tr key={day.date} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5 text-sm font-bold text-gray-700">{new Date(day.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                    <td className="px-8 py-5 text-xs text-gray-400 font-medium">L1 - General Practice</td>
                    <td className="px-8 py-5">
                      <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight">Completed</span>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-gray-900 group-hover:text-violet-600 transition-colors">₹{day.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-20">
               <IndianRupee className="w-16 h-16" />
             </div>
             <p className="text-violet-100/70 text-xs font-bold uppercase tracking-widest mb-6">Payment Snapshot</p>
             <div className="space-y-4">
               <div>
                 <p className="text-[11px] font-bold text-violet-200/60 uppercase">Settled Today</p>
                 <p className="text-3xl font-black">₹{earnings?.daily_total?.toLocaleString('en-IN')}</p>
               </div>
               <div className="pt-4 border-t border-white/10">
                 <p className="text-[11px] font-bold text-violet-200/60 uppercase">Next Cycle Payout</p>
                 <p className="text-xl font-bold opacity-80">Scheduled for Apr 15</p>
               </div>
             </div>
             <button className="w-full mt-8 bg-white text-indigo-600 py-3 rounded-2xl font-bold hover:bg-violet-50 transition-all text-sm">
               View Payout History
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 mb-6 tracking-tight">Revenue Sources</h3>
            <div className="space-y-6">
              <SourceItem label="Clinical Consultation" percent={82} color="bg-violet-500" />
              <SourceItem label="Digital Follow-ups" percent={12} color="bg-sky-500" />
              <SourceItem label="Emergency Handling" percent={6} color="bg-emerald-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceItem({ label, percent, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-tighter">
        <span>{label}</span>
        <span className="text-gray-900">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
