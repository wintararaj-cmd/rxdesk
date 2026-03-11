'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorApi, authApi } from '../../../../lib/apiClient';
import { useAuthStore } from '../../../../store/authStore';
import { useRouter } from 'next/navigation';

interface DoctorProfile {
  id: string;
  full_name: string;
  mci_number: string;
  specialization?: string;
  qualifications?: string[];
  experience_years?: number;
  gender?: string;
  languages?: string[];
  verification_status: string;
  rejection_reason?: string;
}

const VERIFICATION_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: '✓ Verified',         className: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: '⏳ Pending Review',   className: 'bg-amber-100 text-amber-700' },
  rejected: { label: '✕ Rejected',          className: 'bg-red-100 text-red-700' },
};

export default function DoctorProfilePage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: profile, isLoading } = useQuery<DoctorProfile>({
    queryKey: ['doctor-web-profile-edit'],
    queryFn: () => doctorApi.getProfile().then((r) => r.data.data),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? '',
        specialization: profile.specialization ?? '',
        mci_number: profile.mci_number ?? '',
        qualifications: (profile.qualifications ?? []).join(', '),
        experience_years: String(profile.experience_years ?? ''),
        gender: profile.gender ?? '',
        languages: (profile.languages ?? []).join(', '),
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: object) => doctorApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-web-profile-edit'] });
      qc.invalidateQueries({ queryKey: ['doctor-web-profile'] });
      setEditing(false);
    },
    onError: (err: any) => alert(err?.response?.data?.error?.message ?? 'Could not update profile.'),
  });

  const handleSave = () => {
    updateMutation.mutate({
      full_name: form.full_name,
      specialization: form.specialization || undefined,
      qualifications: form.qualifications.split(',').map((q) => q.trim()).filter(Boolean),
      experience_years: form.experience_years ? Number(form.experience_years) : undefined,
      gender: form.gender || undefined,
      languages: form.languages.split(',').map((l) => l.trim()).filter(Boolean),
    });
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* noop */ }
    clearAuth();
    router.push('/doctor/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const badge = VERIFICATION_BADGE[profile?.verification_status ?? ''];

  const FIELDS: { key: string; label: string; placeholder?: string; type?: string; readOnly?: boolean }[] = [
    { key: 'full_name',       label: 'Full Name',                      placeholder: 'Dr. Your Name' },
    { key: 'mci_number',      label: 'MCI Registration Number',        readOnly: true },
    { key: 'specialization',  label: 'Specialization',                  placeholder: 'e.g. Cardiologist' },
    { key: 'qualifications',  label: 'Qualifications (comma-separated)', placeholder: 'MBBS, MD Medicine' },
    { key: 'experience_years',label: 'Years of Experience',             placeholder: '0', type: 'number' },
    { key: 'gender',          label: 'Gender',                          placeholder: 'male / female / other' },
    { key: 'languages',       label: 'Languages (comma-separated)',      placeholder: 'Hindi, English' },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          {badge && (
            <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {profile?.verification_status === 'rejected' && profile.rejection_reason && (
            <p className="text-red-500 text-sm mt-1">Reason: {profile.rejection_reason}</p>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        {FIELDS.map(({ key, label, placeholder, type, readOnly }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">{label}</label>
            {editing && !readOnly ? (
              <input
                value={form[key] ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                type={type ?? 'text'}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            ) : (
              <p className={`text-sm ${readOnly && editing ? 'text-gray-400' : 'text-gray-900'}`}>
                {form[key] || (readOnly ? profile?.[key as keyof DoctorProfile] as string : '—') || '—'}
                {readOnly && editing && <span className="ml-2 text-xs text-gray-400">(cannot be edited)</span>}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div className="mt-6 pt-6 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="text-red-500 text-sm hover:text-red-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          Sign out
        </button>
      </div>
    </div>
  );
}
