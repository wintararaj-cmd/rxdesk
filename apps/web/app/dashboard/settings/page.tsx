'use client';

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopApi, subscriptionApi, chamberApi } from '../../../lib/apiClient';
import { useAuthStore } from '../../../store/authStore';

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

  const { user } = useAuthStore();
  const { data: shopRes, isLoading, isError: shopNotFound } = useQuery({
    queryKey: ['shop-profile'],
    queryFn: () => shopApi.getMyShop(),
    retry: false,
    // treat 404 (no shop yet) as a non-error — isError will be true but we handle it as isNewShop
  });

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
    mutationFn: (planId: string) => subscriptionApi.subscribe(planId),
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

  const shop: ShopProfile | null = shopRes?.data?.data ?? null;
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
              <p className="text-sm font-medium text-gray-700 mb-3">Available Plans</p>
              {subError && <p className="text-red-500 text-sm mb-3">{subError}</p>}
              {plans.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plans.map((plan) => (
                    <div key={plan.id} className="border border-gray-200 rounded-xl p-4">
                      <p className="font-semibold text-gray-900">{plan.name}</p>
                      <p className="text-xl font-bold text-violet-600 mt-1">
                        ₹{plan.price_monthly}<span className="text-sm font-normal text-gray-400">/mo</span>
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-gray-600">
                        <li>✓ Up to {plan.max_doctors} doctor{plan.max_doctors !== 1 ? 's' : ''}</li>
                        <li>✓ {plan.max_appointments_per_month >= 99999 ? 'Unlimited' : plan.max_appointments_per_month} appointments/month</li>
                        <li>✓ {plan.max_sessions} active session{plan.max_sessions !== 1 ? 's' : ''}</li>
                      </ul>
                      <button
                        onClick={() => subscribeMutation.mutate(plan.id)}
                        disabled={subscribeMutation.isPending}
                        className="mt-3 w-full py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50"
                      >
                        {subscribeMutation.isPending ? 'Processing…' : 'Subscribe'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
      </div>
    </div>
  );
}
