'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';

type Step = 'login' | 'otp' | 'set-password';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<Step>('login');
  const [otp, setOtp] = useState('');
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [forgotMode, setForgotMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [registering, setRegistering] = useState(false);
  const { setTokens, setUser, accessToken, user } = useAuthStore();

  useEffect(() => {
    setRegistering(searchParams.get('register') === '1');
  }, [searchParams]);

  // Redirect already-authenticated shop owners straight to the dashboard.
  // Only applies on the 'login' step so the OTP-verify → set-password flow
  // isn't interrupted by the token being set mid-flow.
  useEffect(() => {
    if (step === 'login' && accessToken && user?.role === 'shop_owner') {
      router.replace('/dashboard');
    }
  }, [accessToken, user, router, step]);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [resendTimer]);

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);
  const fullPhone = '+91' + phone;

  // ── Password Login ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!isValidPhone || password.length < 8) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.loginWithPassword(fullPhone, password);
      const { access_token, refresh_token, user: authUser } = res.data.data;

      if (authUser.role !== 'shop_owner') {
        setError('This phone number is not registered as a Medical Shop account.');
        return;
      }

      setTokens(access_token, refresh_token);
      setUser(authUser);
      router.push('/dashboard');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'PASSWORD_NOT_SET') {
        // First-time user — switch to OTP flow
        setError('No password set yet. Please login with OTP first.');
      } else if (code === 'SESSION_LIMIT_EXCEEDED') {
        setError(err?.response?.data?.error?.message ?? 'Session limit reached. Please sign out from another device first.');
      } else {
        setError(err?.response?.data?.error?.message ?? 'Invalid phone number or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Send OTP (first-time / OTP login) ─────────────────────────────────────
  const handleSendOtp = async (forgot = false) => {
    setError('');
    setLoading(true);
    setForgotMode(forgot);
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

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(fullPhone, otp, ref);
      const { access_token, refresh_token, user: authUser } = res.data.data;

      // Set tokens first so subsequent authenticated calls work
      setTokens(access_token, refresh_token);

      // Registration flow: promote role to shop_owner if not already
      if (registering && authUser.role !== 'shop_owner') {
        await authApi.updateRole('shop_owner');
        authUser.role = 'shop_owner';
      }

      if (!registering && authUser.role !== 'shop_owner') {
        setError('This phone number is not registered as a Medical Shop account.');
        setStep('login');
        setOtp('');
        setRef('');
        return;
      }

      setUser({ ...authUser, role: 'shop_owner' });

      if (authUser.requires_password_setup || forgotMode || registering) {
        setStep('set-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'SESSION_LIMIT_EXCEEDED') {
        setError(err?.response?.data?.error?.message ?? 'Session limit reached. Please sign out from another device first.');
      } else {
        setError(err?.response?.data?.error?.message ?? 'Invalid OTP.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Set Password (first-time) ─────────────────────────────────────────────
  const handleSetPassword = async () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) return;
    setError('');
    setLoading(true);
    try {
      await authApi.setPassword(newPassword, confirmPassword);
      router.push(registering ? '/dashboard/settings' : '/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to set password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-10 w-48 h-48 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-violet-500/25">
              <span className="text-white text-2xl font-bold tracking-tight">RX</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">RxDesk</h1>
            <p className="text-gray-500 text-sm mt-1.5">Medical Shop Panel</p>
          </div>

          {step === 'login' && registering && (
            <div className="slide-up">
              <h2 className="text-lg font-semibold text-white/90 mb-1">Register your Shop</h2>
              <p className="text-gray-500 text-sm mb-5">Enter your mobile number to get started with OTP</p>

              {/* Phone */}
              <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 h-13 mb-4 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all">
                <span className="text-gray-500 mr-2 text-sm font-medium">+91</span>
                <div className="w-px h-5 bg-gray-700 mr-3" />
                <input
                  className="flex-1 outline-none text-white text-base bg-transparent placeholder:text-gray-600 py-3"
                  placeholder="10-digit mobile number"
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && isValidPhone && handleSendOtp(false)}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl text-sm mb-4">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  {error}
                </div>
              )}

              <button
                className={`w-full h-12 rounded-xl text-base font-semibold transition-all duration-200 ${
                  isValidPhone
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-600/25 active:scale-[0.98]'
                    : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'
                }`}
                disabled={!isValidPhone || loading}
                onClick={() => handleSendOtp(false)}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending OTP…
                  </span>
                ) : 'Get Started with OTP'}
              </button>

              <div className="flex items-center justify-center gap-2 mt-5">
                <span className="text-gray-600 text-sm">Already registered?</span>
                <button
                  className="text-violet-400 text-sm font-medium hover:text-violet-300 transition-colors"
                  onClick={() => setRegistering(false)}
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {step === 'login' && !registering && (
            <div className="slide-up">
              <h2 className="text-lg font-semibold text-white/90 mb-5">Sign in to your account</h2>

              {/* Phone */}
              <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 h-13 mb-3 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all">
                <span className="text-gray-500 mr-2 text-sm font-medium">+91</span>
                <div className="w-px h-5 bg-gray-700 mr-3" />
                <input
                  className="flex-1 outline-none text-white text-base bg-transparent placeholder:text-gray-600 py-3"
                  placeholder="10-digit mobile number"
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pwd-input')?.focus()}
                />
              </div>

              {/* Password */}
              <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 h-13 mb-4 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all">
                <input
                  id="pwd-input"
                  className="flex-1 outline-none text-white text-base bg-transparent placeholder:text-gray-600 py-3"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && isValidPhone && password.length >= 8 && handleLogin()}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl text-sm mb-4">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  {error}
                </div>
              )}

              <button
                className={`w-full h-12 rounded-xl text-base font-semibold transition-all duration-200 ${
                  isValidPhone && password.length >= 8
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-600/25 active:scale-[0.98]'
                    : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'
                }`}
                disabled={!isValidPhone || password.length < 8 || loading}
                onClick={handleLogin}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>

              {/* Forgot password & First-time OTP login */}
              <div className="flex flex-col items-center gap-2 mt-5">
                <button
                  className="text-gray-500 text-sm hover:text-violet-400 transition-colors"
                  disabled={!isValidPhone || loading}
                  onClick={() => handleSendOtp(true)}
                >
                  Forgot password?
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-sm">First time here? </span>
                  <button
                    className="text-violet-400 text-sm font-medium hover:text-violet-300 transition-colors"
                    disabled={!isValidPhone || loading}
                    onClick={() => handleSendOtp(false)}
                  >
                    Login with OTP
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div className="slide-up">
              <button onClick={() => setStep('login')} className="text-violet-400 text-sm mb-5 flex items-center gap-1 hover:text-violet-300 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back
              </button>
              <h2 className="text-lg font-semibold text-white/90 mb-1">Enter OTP</h2>
              <p className="text-gray-500 text-sm mb-5">Sent to <span className="text-violet-400/80">+91 {phone}</span></p>
              <input
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 h-13 text-xl text-center tracking-[0.5em] text-white outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 mb-4 placeholder:text-gray-600 py-3 transition-all"
                placeholder="● ● ● ● ● ●"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && handleVerifyOtp()}
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl text-sm mb-4">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  {error}
                </div>
              )}
              <button
                className={`w-full h-12 rounded-xl text-base font-semibold transition-all duration-200 ${otp.length === 6
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-600/25 active:scale-[0.98]'
                    : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'
                  }`}
                disabled={otp.length < 6 || loading}
                onClick={handleVerifyOtp}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying…
                  </span>
                ) : 'Verify & Continue'}
              </button>
              <div className="text-center mt-5">
                {resendTimer > 0 ? (
                  <p className="text-gray-600 text-sm">Resend in <span className="text-violet-400/80 font-medium">{resendTimer}s</span></p>
                ) : (
                  <button className="text-violet-400 text-sm font-medium hover:text-violet-300 transition-colors disabled:opacity-50" disabled={loading} onClick={handleResendOtp}>
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'set-password' && (
            <div className="slide-up">
              <h2 className="text-lg font-semibold text-white/90 mb-1">Set Your Password</h2>
              <p className="text-gray-500 text-sm mb-5">Create a password to use for future logins</p>

              <input
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 h-13 text-base text-white outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 mb-3 placeholder:text-gray-600 py-3 transition-all"
                placeholder="New password (min. 8 characters)"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                className={`w-full bg-white/[0.06] border rounded-xl px-4 h-13 text-base text-white outline-none focus:ring-2 focus:ring-violet-500/10 mb-4 placeholder:text-gray-600 py-3 transition-all ${
                  confirmPassword.length > 0 && newPassword !== confirmPassword
                    ? 'border-red-500/50 focus:border-red-500/50'
                    : 'border-white/[0.08] focus:border-violet-500/50'
                }`}
                placeholder="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              />
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-red-400 text-xs mb-3">Passwords do not match</p>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl text-sm mb-4">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  {error}
                </div>
              )}

              <button
                className={`w-full h-12 rounded-xl text-base font-semibold transition-all duration-200 ${
                  newPassword.length >= 8 && newPassword === confirmPassword
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-600/25 active:scale-[0.98]'
                    : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'
                }`}
                disabled={newPassword.length < 8 || newPassword !== confirmPassword || loading}
                onClick={handleSetPassword}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Set Password & Enter Dashboard'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-700 text-xs mt-6">Powered by RxDesk Technologies</p>
      </div>
    </div>
  );
}
