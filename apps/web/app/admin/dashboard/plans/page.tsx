'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../../lib/apiClient';
import { 
  Package, Plus, Edit2, Check, X, Shield, 
  Users, Calendar, Monitor, IndianRupee, Save
} from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  max_doctors: number;
  max_appointments_per_month: number;
  max_sessions: number;
  features: string | string[] | null;
  is_active: boolean;
  _count?: { subscriptions: number };
}

export default function PlansPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SubscriptionPlan>>({});
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminApi.getPlans().then(r => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updatePlan(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      setEditingId(null);
      alert('Plan updated successfully');
    },
    onError: () => alert('Failed to update plan'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createPlan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      setShowAddModal(false);
      setEditForm({});
      alert('Plan created successfully');
    },
    onError: () => alert('Failed to create plan'),
  });

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingId(plan.id);
    setEditForm(plan);
  };

  const handleSave = () => {
    if (!editingId) return;
    const data = { 
      ...editForm,
      features: typeof editForm.features === 'string' 
        ? editForm.features.split(',').map(f => f.trim()).filter(Boolean)
        : editForm.features
    };
    updateMutation.mutate({ id: editingId, data });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...editForm,
      features: typeof editForm.features === 'string'
        ? editForm.features.split(',').map(f => f.trim()).filter(Boolean)
        : editForm.features
    };
    createMutation.mutate(data);
  };

  const toggleActive = (plan: SubscriptionPlan) => {
    updateMutation.mutate({ 
      id: plan.id, 
      data: { is_active: !plan.is_active } 
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pricing Plans</h1>
          <p className="text-gray-500 text-sm">Manage subscription pricing and platform limits</p>
        </div>
        <button 
          onClick={() => { setEditForm({}); setShowAddModal(true); }}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-600/20"
        >
          <Plus className="w-4 h-4" />
          Create New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans?.map((plan: SubscriptionPlan) => (
          <div key={plan.id} className={`bg-[#0d1117] border ${editingId === plan.id ? 'border-rose-500/50 ring-1 ring-rose-500/20' : 'border-white/[0.08]'} rounded-2xl overflow-hidden transition-all group relative`}>
            {!plan.is_active && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Disabled</span>
              </div>
            )}
            
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${plan.is_active ? 'bg-rose-500/10 text-rose-500' : 'bg-gray-500/10 text-gray-500'}`}>
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  {editingId === plan.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={handleSave} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleEdit(plan)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {editingId === plan.id ? (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    value={editForm.name || ''}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-white font-bold"
                  />
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="number" 
                      value={editForm.price_monthly || 0}
                      onChange={e => setEditForm({...editForm, price_monthly: Number(e.target.value)})}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-xl font-black"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Features (comma separated)</label>
                    <textarea 
                      value={Array.isArray(editForm.features) ? editForm.features.join(', ') : (editForm.features || '')}
                      onChange={e => setEditForm({...editForm, features: e.target.value})}
                      placeholder="e.g. 24/7 Support, Cloud Backup"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-white text-xs min-h-[60px] focus:outline-none focus:border-rose-500/50"
                    />
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-black text-white">₹{plan.price_monthly}</span>
                    <span className="text-gray-500 text-sm font-medium">/month</span>
                  </div>
                  {plan.features && Array.isArray(plan.features) && plan.features.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {plan.features.slice(0, 3).map((f, i) => (
                        <span key={i} className="text-[9px] bg-white/[0.05] text-gray-400 px-2 py-0.5 rounded-full border border-white/[0.05]">{f}</span>
                      ))}
                      {plan.features.length > 3 && <span className="text-[9px] text-gray-600">+{plan.features.length - 3} more</span>}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 mt-6">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-gray-500">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">Doctors Allowed</p>
                    {editingId === plan.id ? (
                      <input 
                        type="number"
                        value={editForm.max_doctors || 0}
                        onChange={e => setEditForm({...editForm, max_doctors: Number(e.target.value)})}
                        className="w-full bg-transparent border-b border-white/10 text-white font-bold focus:outline-none"
                      />
                    ) : (
                      <p className="text-white font-bold">{plan.max_doctors} max</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-gray-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">Monthly Appointments</p>
                    {editingId === plan.id ? (
                      <input 
                        type="number"
                        value={editForm.max_appointments_per_month || 0}
                        onChange={e => setEditForm({...editForm, max_appointments_per_month: Number(e.target.value)})}
                        className="w-full bg-transparent border-b border-white/10 text-white font-bold focus:outline-none"
                      />
                    ) : (
                      <p className="text-white font-bold">{plan.max_appointments_per_month} max</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-gray-500">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">Device Sessions</p>
                    {editingId === plan.id ? (
                      <input 
                        type="number"
                        value={editForm.max_sessions || 0}
                        onChange={e => setEditForm({...editForm, max_sessions: Number(e.target.value)})}
                        className="w-full bg-transparent border-b border-white/10 text-white font-bold focus:outline-none"
                      />
                    ) : (
                      <p className="text-white font-bold">{plan.max_sessions} active</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Active Installs</p>
                  <p className="text-sm text-white font-bold mt-0.5">{plan._count?.subscriptions || 0} Shops</p>
                </div>
                <button 
                  onClick={() => toggleActive(plan)}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all
                    ${plan.is_active 
                      ? 'border-gray-800 text-gray-500 hover:border-rose-500/50 hover:text-rose-500' 
                      : 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10'}`}
                >
                  {plan.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal Placeholder/Logic could go here, but focusing on user request for editing */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0d1117] border border-white/[0.08] rounded-3xl p-8 w-full max-w-lg shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 to-red-600" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Pricing Plan</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Plan Name</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Starter, Pro, Enterprise"
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Monthly Price (â‚¹)</label>
                  <input 
                    required
                    type="number" 
                    placeholder="0"
                    onChange={e => setEditForm({...editForm, price_monthly: Number(e.target.value)})}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Max Doctors</label>
                  <input 
                    required
                    type="number" 
                    placeholder="1"
                    onChange={e => setEditForm({...editForm, max_doctors: Number(e.target.value)})}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Appts / Month</label>
                  <input 
                    required
                    type="number" 
                    placeholder="100"
                    onChange={e => setEditForm({...editForm, max_appointments_per_month: Number(e.target.value)})}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Max Sessions</label>
                  <input 
                    required
                    type="number" 
                    placeholder="2"
                    onChange={e => setEditForm({...editForm, max_sessions: Number(e.target.value)})}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/50 transition-colors"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={createMutation.isPending}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-rose-600/20 mt-4 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Launch Plan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
