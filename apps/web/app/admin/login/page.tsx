'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../../lib/apiClient';
import { useAuthStore } from '../../../store/authStore';

export default function AdminLoginPage() {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { setTokens, setUser, accessToken, user } = useAuthStore();

  useEffect(() => {
    if (accessToken && user?.role === 'admin') {
      router.replace('/admin/dashboard');
    }
  }, [accessToken, user, router]);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [resendTimer]);

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);
  const fullPhone = '+91' + phone;

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.sendOtp(fullPhone);
      setRef(res.data.data.otp_ref);
      setStep('otp');
      setResendTimer(60);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.sendOtp(fullPhone);
      setRef(res.data.data.otp_ref);
      setOtp('');
      setResendTimer(60);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(fullPhone, otp, ref);
      const { access_token, refresh_token, user } = res.data.data;
      if (user.role !== 'admin') {
        setError('Access denied. This portal is for administrators only.');
        setStep('phone');
        setOtp('');
        setRef('');
        return;
      }
      setTokens(access_token, refresh_token);
      setUser(user);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-16 w-96 h-96 bg-rose-600/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-red-700/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-rose-600 to-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-rose-700/30">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">RxDesk Admin</h1>
            <p className="text-gray-500 text-sm mt-1">System Administration Portal</p>
          </div>

          {step === 'phone' ? (
            <div>
              <h2 className="text-base font-semibold text-white/80 mb-4">Sign in with your mobile</h2>
              <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 mb-4 focus-within:border-rose-500/50 focus-within:ring-2 focus-within:ring-rose-500/10 transition-all">
                <span className="text-gray-500 mr-2 text-sm font-medium">+91</span>
                <div className="w-px h-5 bg-gray-700 mr-3" />
                <input
                  className="flex-1 outline-none text-white text-base bg-transparent placeholder:text-gray-600 py-3"
                  placeholder="10-digit mobile number"
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && isValidPhone && handleSendOtp()}
                />
              </div>
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <button
                className={`w-full h-12 rounded-xl text-base font-semibold transition-all duration-200 ${isValidPhone
                  ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white hover:shadow-lg hover:shadow-rose-700/25 active:scale-[0.98]'
                  : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'}`}
                disabled={!isValidPhone || loading}
                onClick={handleSendOtp}
              >
                {loading ? <Spinner label="Sending…" /> : 'Send OTP'}
              </button>
            </div>
          ) : (
            <div>
              <button onClick={() => setStep('phone')} className="text-rose-400 text-sm mb-5 flex items-center gap-1 hover:text-rose-300 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back
              </button>
              <h2 className="text-base font-semibold text-white/80 mb-1">Enter OTP</h2>
              <p className="text-gray-500 text-sm mb-5">Sent to <span className="text-rose-400/80">+91 {phone}</span></p>
              <input
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 text-xl text-center tracking-[0.5em] text-white outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10 mb-4 placeholder:text-gray-600 py-3 transition-all"
                placeholder="● ● ● ● ● ●"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && handleVerifyOtp()}
              />
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <button
                className={`w-full h-12 rounded-xl text-base font-semibold transition-all duration-200 ${otp.length === 6
                  ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white hover:shadow-lg hover:shadow-rose-700/25 active:scale-[0.98]'
                  : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'}`}
                disabled={otp.length < 6 || loading}
                onClick={handleVerifyOtp}
              >
                {loading ? <Spinner label="Verifying…" /> : 'Sign In as Admin'}
              </button>
              <div className="text-center mt-5">
                {resendTimer > 0 ? (
                  <p className="text-gray-600 text-sm">Resend in <span className="text-rose-400/80 font-medium">{resendTimer}s</span></p>
                ) : (
                  <button className="text-rose-400 text-sm font-medium hover:text-rose-300 transition-colors" disabled={loading} onClick={handleResendOtp}>
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-gray-700 text-xs mt-6">RxDesk · Internal Admin Access Only</p>
      </div>
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl text-sm mb-4">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      {label}
    </span>
  );
}
