'use client';

import { useQuery } from '@tanstack/react-query';
import { doctorApi } from '../../../lib/apiClient';
import { 
  Calendar, 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  PlusCircle,
  Stethoscope,
  Award,
  Share2
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import Link from 'next/link';

export default function PracticeDashboard() {
  const { data: profile } = useQuery({
    queryKey: ['doctor-profile'],
    queryFn: () => doctorApi.getProfile().then(res => res.data.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['doctor-stats'],
    queryFn: () => doctorApi.getStats().then(res => res.data.data),
  });

  const { data: earnings } = useQuery({
    queryKey: ['doctor-earnings'],
    queryFn: () => doctorApi.getEarnings().then(res => res.data.data),
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const chartData = earnings?.daily_breakdown?.map((day: any) => ({
    name: day.date.split('-')[2],
    revenue: day.amount
  })) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Panel with Glassmorphism */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 shadow-2xl shadow-violet-500/20">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-black/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">
              {getGreeting()}, Dr. {profile?.full_name?.split(' ')[0]}
            </h1>
            <p className="text-violet-100/80 font-medium flex items-center gap-2">
              <Stethoscope className="w-4 h-4 opacity-70" />
              Your clinic is live today. You have {stats?.today_count || 0} appointments scheduled.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/appointments"
              className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              View Queue
            </Link>
            <Link 
              href="/dashboard/practice/templates"
              className="bg-white text-violet-700 hover:bg-violet-50 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              New Prescription
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Today's Patients" 
          value={stats?.today_count || 0} 
          icon={<Users className="w-6 h-6" />}
          trend="+12% from yesterday"
          color="violet"
        />
        <StatCard 
          label="This Month" 
          value={stats?.month_count || 0} 
          icon={<Calendar className="w-6 h-6" />}
          trend="Steady growth"
          color="sky"
        />
        <StatCard 
          label="Revenue (Month)" 
          value={`₹${earnings?.monthly_total?.toLocaleString('en-IN') || 0}`} 
          icon={<TrendingUp className="w-6 h-6" />}
          trend={`Avg. ₹${(earnings?.monthly_total / 30 || 0).toFixed(0)}/day`}
          color="emerald"
        />
        <StatCard 
          label="Experience" 
          value={`${profile?.experience_years || 0} Years`} 
          icon={<Award className="w-6 h-6" />}
          trend="Certified professional"
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Revenue Analysis</h3>
              <p className="text-gray-500 text-sm">Last 7 days performance</p>
            </div>
            <Link href="/dashboard/practice/earnings" className="text-violet-600 font-bold text-xs hover:underline flex items-center gap-1">
              View Report <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontWeight: 700
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#7c3aed" 
                  strokeWidth={4} 
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Tools */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-6">Quick Tools</h3>
            <div className="space-y-3">
              <ToolLink icon={<Share2 className="w-4 h-4" />} label="Share Profile QR" color="orange" />
              <ToolLink icon={<Activity className="w-4 h-4" />} label="Medicine Catalog" color="sky" />
              <ToolLink icon={<Users className="w-4 h-4" />} label="Patient Archives" color="violet" />
            </div>
          </div>
          
          <div className="bg-indigo-50 rounded-[2rem] p-8 border border-indigo-100 relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-lg font-black text-indigo-900 mb-2">Practice Branding</h3>
              <p className="text-indigo-700/70 text-xs font-medium mb-4">Print your high-res clinic QR poster for your desk.</p>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">
                Generate Poster
              </button>
            </div>
            <Share2 className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-600/5 group-hover:rotate-12 transition-transform duration-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, trend, color }: any) {
  const colors: any = {
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600'
  };

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 ${colors[color]} rounded-2xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
      <h4 className="text-3xl font-black text-gray-900 mb-2">{value}</h4>
      <p className="text-gray-400 text-[10px] font-bold flex items-center gap-1">
        <TrendingUp className="w-3 h-3 text-emerald-500" />
        {trend}
      </p>
    </div>
  );
}

function ToolLink({ icon, label, color }: any) {
  const colors: any = {
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    sky: 'bg-sky-50 text-sky-600 hover:bg-sky-100',
    violet: 'bg-violet-50 text-violet-600 hover:bg-violet-100'
  };

  return (
    <button className={`w-full flex items-center gap-4 p-4 rounded-2xl ${colors[color]} transition-all group`}>
      <div className="transition-transform group-hover:scale-110">
        {icon}
      </div>
      <span className="font-bold text-sm">{label}</span>
      <ChevronRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </button>
  );
}
