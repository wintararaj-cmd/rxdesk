'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopApi, subscriptionApi, chamberApi, accountingApi } from '../../../lib/apiClient';
import { useAuthStore } from '../../../store/authStore';
import { Phone, Mail, Clock, X, Database, Download, Upload, AlertCircle, Check } from 'lucide-react';

type GstType = 'unregistered' | 'composite' | 'regular';

interface ShopProfile {
  id: string;
  shop_name: string;
  drug_license_no: string;
  address_line: string;
  city: string;
  state: string;
  pin_code: string;
  contact_phone: string;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  gst_number: string | null;
  gst_type: GstType;
  owner?: { phone: string };
}

interface Subscription {
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan?: { name: string; price_monthly: number };
}

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  max_doctors: number;
  max_appointments_per_month: number;
  max_sessions: number;
}
interface PendingChamber {
  id: string;
  consultation_fee: number;
  doctor: { full_name: string; specialization: string } | null;
}

function Field({
  label,
  field,
  type = 'text',
  placeholder = '',
  form,
  onChange,
}: {
  label: string;
  field: keyof ShopProfile;
  type?: string;
  placeholder?: string;
  form: Partial<ShopProfile>;
  onChange: (field: keyof ShopProfile, value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={(form[field] as string) ?? ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white"
      />
    </div>
  );
}

const statusStyle: Record<string, string> = {
  trial: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-orange-50 text-orange-700 border-orange-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  const [subError, setSubError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('6');
  const [showContactModal, setShowContactModal] = useState(false);

  const { user } = useAuthStore();
  const { data: shopRes, isLoading, isError: shopNotFound } = useQuery({
    queryKey: ['shop-profile'],
    queryFn: () => shopApi.getMyShop(),
    retry: false,
    // treat 404 (no shop yet) as a non-error — isError will be true but we handle it as isNewShop
  });

  // Derive shop early so queries below can use it as an `enabled` guard
  const shop: ShopProfile | null = shopRes?.data?.data ?? null;

  const { data: subRes } = useQuery({
    queryKey: ['shop-subscription'],
    queryFn: () => subscriptionApi.getCurrent(),
    enabled: !!shop,
  });

  const { data: plansRes } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionApi.getPlans(),
    enabled: showPlans,
  });

  const { data: pendingChambersRes, refetch: refetchPending } = useQuery({
    queryKey: ['web-pending-chambers'],
    queryFn: () => chamberApi.getShopChambers('pending'),
    enabled: !!shop,
  });
  const pendingChambers: PendingChamber[] = pendingChambersRes?.data?.data ?? [];

  const plans: Plan[] = plansRes?.data?.data ?? [];

  const subscribeMutation = useMutation({
    mutationFn: ({ planId, period }: { planId: string; period: string }) => subscriptionApi.subscribe(planId, period),
    onSuccess: (res) => {
      const data = res.data.data;
      qc.invalidateQueries({ queryKey: ['shop-subscription'] });
      if (data?.dev_mode) {
        setShowPlans(false);
        setSubError('');
      } else if (data?.short_url) {
        window.open(data.short_url, '_blank');
        setShowPlans(false);
      }
    },
    onError: (err: any) => {
      setSubError(err?.response?.data?.error?.message ?? 'Could not initiate subscription.');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => chamberApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-pending-chambers'] });
      refetchPending();
    },
  });

  const sub: Subscription | null = subRes?.data?.data ?? null;

  const [form, setForm] = useState<Partial<ShopProfile>>({});

  // Initialize form when shop data loads
  const isNewShop = !shop && !isLoading;

  const activeForm: Partial<ShopProfile> = Object.keys(form).length
    ? form
    : {
      shop_name: shop?.shop_name ?? '',
      drug_license_no: shop?.drug_license_no ?? '',
      address_line: shop?.address_line ?? '',
      city: shop?.city ?? '',
      state: shop?.state ?? '',
      pin_code: shop?.pin_code ?? '',
      contact_phone: shop?.contact_phone ?? user?.phone ?? '',
      contact_email: shop?.contact_email ?? '',
      gst_type: shop?.gst_type ?? 'unregistered',
      gst_number: shop?.gst_number ?? '',
    };

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ShopProfile>) => shopApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-profile'] });
      qc.invalidateQueries({ queryKey: ['web-shop'] });
      setSaved(true);
      setFormError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => {
      const details = err?.response?.data?.error?.details;
      const fieldErrors = details && typeof details === 'object'
        ? Object.entries(details as Record<string, string[]>)
          .map(([f, msgs]) => `${f}: ${(msgs as string[]).join(', ')}`)
          .join('; ')
        : null;
      setFormError(fieldErrors ?? err?.response?.data?.error?.message ?? 'Failed to save changes.');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ShopProfile>) => shopApi.createShop(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-profile'] });
      qc.invalidateQueries({ queryKey: ['web-shop'] });
      setSaved(true);
      setFormError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => {
      const details = err?.response?.data?.error?.details;
      const fieldErrors = details && typeof details === 'object'
        ? Object.entries(details as Record<string, string[]>)
          .map(([f, msgs]) => `${f}: ${(msgs as string[]).join(', ')}`)
          .join('; ')
        : null;
      setFormError(fieldErrors ?? err?.response?.data?.error?.message ?? 'Failed to create shop profile.');
    },
  });

  const handleChange = (field: keyof ShopProfile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /** Normalises a 10-digit or +91-prefixed number to +91XXXXXXXXXX */
  const normalisePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return raw.trim(); // return as-is and let server validate edge cases
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm.shop_name?.trim()) {
      setFormError('Shop name is required.');
      return;
    }
    if (isNewShop && !activeForm.drug_license_no?.trim()) {
      setFormError('Drug license number is required.');
      return;
    }
    if (isNewShop && !activeForm.contact_phone?.trim()) {
      setFormError('Contact phone is required.');
      return;
    }
    setFormError('');
    const payload = {
      ...activeForm,
      contact_phone: normalisePhone(activeForm.contact_phone ?? ''),
    };
    if (isNewShop) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const expiryDate = sub?.current_period_end ?? sub?.trial_ends_at;



  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your shop profile and subscription.</p>
        </div>

        {/* Subscription card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Subscription</h2>
          {sub ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-gray-900 font-medium">{sub.plan?.name ?? 'Free Trial'}</p>
                {expiryDate && (
                  <p className="text-gray-500 text-sm mt-0.5">
                    Valid until {new Date(expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {sub.plan?.price_monthly !== undefined && (
                  <p className="text-gray-500 text-sm">₹{sub.plan.price_monthly}/month</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${statusStyle[sub.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {sub.status}
                </span>
                {['trial', 'active'].includes(sub.status) && (
                  <button
                    onClick={() => setShowPlans(!showPlans)}
                    className="px-4 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700"
                  >
                    {showPlans ? 'Hide Plans' : sub.status === 'trial' ? 'Subscribe' : 'Upgrade'}
                  </button>
                )}
                {['expired', 'cancelled'].includes(sub.status) && (
                  <button
                    onClick={() => setShowPlans(!showPlans)}
                    className="px-4 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700"
                  >
                    {showPlans ? 'Hide Plans' : 'Renew'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 font-medium">Free Trial</p>
                <p className="text-gray-500 text-sm mt-0.5">Upgrade for SMS reminders and advanced analytics.</p>
              </div>
              <button
                onClick={() => setShowPlans(!showPlans)}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700"
              >
                View Plans
              </button>
            </div>
          )}

          {/* Plans grid */}
          {showPlans && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                <p className="text-sm font-medium text-gray-700">Available Plans</p>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="1">Monthly Recharge</option>
                  <option value="3">Quarterly Recharge (3 Mo)</option>
                  <option value="6">Half-Yearly Recharge (6 Mo)</option>
                  <option value="12">Yearly Recharge (12 Mo)</option>
                </select>
              </div>

              {/* Pricing Rules Helper */}
              {(() => {
                const getPricePerMonth = (planName: string, period: string) => {
                  const p = period.toString();
                  if (planName === 'Basic') {
                    if (p === '1') return 799;
                    if (p === '3') return 699;
                    if (p === '6') return 599;
                    if (p === '12') return 499;
                  }
                  if (planName === 'Standard') {
                    if (p === '1') return 1299;
                    if (p === '3') return 1199;
                    if (p === '6') return 1099;
                    if (p === '12') return 999;
                  }
                  if (planName === 'Premium') {
                    if (p === '1') return 2299;
                    if (p === '3') return 2199;
                    if (p === '6') return 2099;
                    if (p === '12') return 1999;
                  }
                  return 0;
                };

                return (
                  <>
                    {subError && <p className="text-red-500 text-sm mb-3">{subError}</p>}
                    {plans.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {plans.map((plan) => {
                          const months = Number(selectedPeriod);
                          const pricePerMonth = getPricePerMonth(plan.name, selectedPeriod) || (Number(plan.price_monthly));
                          const totalAmount = pricePerMonth * months;
                          return (
                            <div key={plan.id} className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">{plan.name}</p>
                                <p className="text-xl font-bold text-violet-600 mt-1">
                                  ₹{totalAmount}<span className="text-sm font-normal text-gray-400">/{months === 1 ? 'mo' : `${months} mo`}</span>
                                </p>
                                {months > 1 && (
                                  <p className="text-xs text-gray-500 mt-0.5">Base: ₹{pricePerMonth}/mo</p>
                                )}
                                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                                  <li>✓ Up to {plan.max_doctors} doctor{plan.max_doctors !== 1 ? 's' : ''}</li>
                                  <li>✓ {plan.max_appointments_per_month >= 99999 ? 'Unlimited' : plan.max_appointments_per_month} appointments/month</li>
                                  <li>✓ {plan.max_sessions} active session{plan.max_sessions !== 1 ? 's' : ''}</li>
                                </ul>
                              </div>
                              <button
                                onClick={() => setShowContactModal(true)}
                                className="mt-3 w-full py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors"
                              >
                                Subscribe
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Pending Doctor Requests */}
        {pendingChambers.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">⏳ Pending Doctor Requests ({pendingChambers.length})</h2>
            <div className="divide-y divide-gray-100">
              {pendingChambers.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">{c.doctor?.full_name ?? 'Doctor'}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{c.doctor?.specialization} &middot; Fee: ₹{c.consultation_fee}</p>
                  </div>
                  <button
                    onClick={() => approveMutation.mutate(c.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New shop setup banner */}
        {isNewShop && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="font-semibold text-amber-800 text-sm">⚠️ Complete your shop setup</p>
            <p className="text-amber-700 text-xs mt-1">Your account is ready, but you need to fill in your shop details before you can use inventory, billing, and other features.</p>
          </div>
        )}

        {/* Profile form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-5">{isNewShop ? 'Create Shop Profile' : 'Shop Profile'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Shop Name *" field="shop_name" placeholder="Enter shop name" form={activeForm} onChange={handleChange} />
            <Field label="Drug License No *" field="drug_license_no" placeholder="e.g. MH-MUM-123456" form={activeForm} onChange={handleChange} />
            <Field label="Address" field="address_line" placeholder="Street address" form={activeForm} onChange={handleChange} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" field="city" placeholder="City" form={activeForm} onChange={handleChange} />
              <Field label="State" field="state" placeholder="State" form={activeForm} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="PIN Code" field="pin_code" placeholder="6-digit PIN" form={activeForm} onChange={handleChange} />
              <Field label="Phone" field="contact_phone" placeholder="Contact number" form={activeForm} onChange={handleChange} />
            </div>
            <Field label="Email" field="contact_email" type="email" placeholder="shop@example.com" form={activeForm} onChange={handleChange} />

            {/* GST Settings */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">GST Registration</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(activeForm.gst_type === 'unregistered' || activeForm.gst_type === 'composite')
                      ? 'Invoices will be generated as \'Bill of Supply\''
                      : 'Invoices will be generated as \'Tax Invoice\''}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${activeForm.gst_type === 'regular'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : activeForm.gst_type === 'composite'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                  {activeForm.gst_type === 'regular' ? 'Tax Invoice' : 'Bill of Supply'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Type</label>
                <select
                  value={activeForm.gst_type ?? 'unregistered'}
                  onChange={(e) => handleChange('gst_type', e.target.value as GstType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                >
                  <option value="unregistered">Unregistered — not registered under GST</option>
                  <option value="composite">Composite — registered under Composition Scheme</option>
                  <option value="regular">Regular — registered with full GST (GSTIN required)</option>
                </select>
              </div>
              {activeForm.gst_type === 'regular' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN (GST Number) *</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={(activeForm.gst_number as string) ?? ''}
                    onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
                    placeholder="e.g. 29AABCT1332L1ZX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">15-character GSTIN as on your GST certificate.</p>
                </div>
              )}
            </div>

            {formError && (
              <p className="text-red-500 text-sm">{formError}</p>
            )}

            {saved && (
              <p className="text-green-600 text-sm font-medium">✓ Changes saved successfully.</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending || createMutation.isPending}
                className="px-6 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {(updateMutation.isPending || createMutation.isPending)
                  ? 'Saving…'
                  : isNewShop ? 'Create Shop Profile' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Backup & Restore */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-violet-600" />
            <h2 className="text-base font-semibold text-gray-800">Accounting Backup & Restore</h2>
          </div>
          <p className="text-gray-500 text-sm mb-6">
            Keep your financial records safe. Export all accounting data (Suppliers, Purchases, Expenses, Income, etc.) to a JSON file or restore from a previous backup.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={async () => {
                try {
                  const res = await accountingApi.backup();
                  const data = res.data.data;
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `rxdesk-accounting-backup-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (err) {
                  alert('Failed to generate backup');
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Backup (JSON)
            </button>

            <div className="flex-1 relative">
              <input
                type="file"
                accept=".json"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (!confirm('WARNING: Restoring will OVERWRITE all current accounting data. This cannot be undone. Are you sure you want to proceed?')) {
                    e.target.value = '';
                    return;
                  }

                  try {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      try {
                        const json = JSON.parse(event.target?.result as string);
                        await accountingApi.restore(json);
                        alert('Accounting data restored successfully!');
                        qc.invalidateQueries();
                      } catch (err: any) {
                        alert('Restore failed: ' + (err.response?.data?.error?.message ?? 'Invalid file format'));
                      }
                    };
                    reader.readAsText(file);
                  } catch (err) {
                    alert('Failed to read file');
                  }
                  e.target.value = '';
                }}
              />
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
                <Upload className="w-4 h-4" />
                Upload & Restore
              </button>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <strong>Note:</strong> Restore operation is destructive. It will remove all existing suppliers, 
              purchases, and payment records for the current shop before importing the backup file. 
              Inventory and Bill records are NOT affected, but links to accounting entries may be lost if 
              they aren't part of the backup.
            </div>
          </div>
        </div>
      </div>

      {/* Contact Support Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="relative p-6 sm:p-8">
              <button
                onClick={() => setShowContactModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-violet-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Contact Support</h3>
                <p className="text-gray-500 text-sm mt-1">
                  To subscribe or upgrade your plan, please reach out to our team.
                </p>
              </div>

              <div className="space-y-4">
                <a
                  href="mailto:support@rxdesk.in"
                  className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl hover:bg-violet-50 hover:border-violet-200 transition-all group"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                    <Mail className="w-5 h-5 text-gray-400 group-hover:text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Us</p>
                    <p className="text-sm font-bold text-gray-900">support@rxdesk.in</p>
                  </div>
                </a>

                <a
                  href="tel:+919830450252"
                  className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                    <Phone className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Call Us</p>
                    <p className="text-sm font-bold text-gray-900">+91 98304 50252</p>
                  </div>
                </a>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Support Hours</p>
                    <p className="text-sm font-bold text-gray-700">5 to 9</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowContactModal(false)}
                className="mt-8 w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
