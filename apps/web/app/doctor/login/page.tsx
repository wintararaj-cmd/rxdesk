'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, doctorApi } from '../../../lib/apiClient';
import { useAuthStore } from '../../../store/authStore';

const GENDER_OPTIONS = ['male', 'female', 'other'];

export default function DoctorLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'login' | 'otp' | 'set-password' | 'register'>('login');
  const [otp, setOtp] = useState('');
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [forgotMode, setForgotMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);

  // Registration form state
  const [reg, setReg] = useState({
    full_name: '',
    mci_number: '',
    specialization: '',
    qualifications: '',
    experience_years: '',
    gender: '',
    languages: 'Hindi, English',
  });
  const [regError, setRegError] = useState('');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { setTokens, setUser, accessToken, user } = useAuthStore();

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [resendTimer]);

  // Redirect already authenticated doctors
  useEffect(() => {
    if (step === 'login' && accessToken && user?.role === 'doctor') {
      router.replace('/doctor/dashboard');
    }
  }, [accessToken, user, router, step]);

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);
  const fullPhone = '+91' + phone;

  // ── Password login ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!isValidPhone || password.length < 8) return;
    setError(''); setLoading(true);
    try {
      const res = await authApi.loginWithPassword(fullPhone, password);
      const { access_token, refresh_token, user: authUser } = res.data.data;
      if (authUser.role !== 'doctor') {
        setError('This phone number is not registered as a Doctor account.');
        return;
      }
      setTokens(access_token, refresh_token);
      setUser(authUser);
      router.push('/doctor/dashboard');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'PASSWORD_NOT_SET') {
        setError('No password set yet. Use "Login with OTP" below.');
      } else {
        setError(err?.response?.data?.error?.message ?? 'Invalid phone number or password.');
      }
    } finally { setLoading(false); }
  };

  const handleSendOtp = async (forgot = false) => {
    setError(''); setLoading(true); setForgotMode(forgot);
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

      // Always store tokens — needed for authenticated calls during register step
      setTokens(access_token, refresh_token);
      setUser(user);

      const profileIncomplete = !(user.role === 'doctor' && user.is_profile_complete);
      if (user.requires_password_setup || forgotMode) {
        setNeedsProfile(profileIncomplete);
        setStep('set-password');
      } else if (profileIncomplete) {
        setStep('register');
      } else {
        router.push('/doctor/dashboard');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) return;
    setError(''); setLoading(true);
    try {
      await authApi.setPassword(newPassword, confirmPassword);
      if (needsProfile) {
        setStep('register');
      } else {
        router.push('/doctor/dashboard');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to set password.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setRegError('');
    if (!reg.full_name.trim()) { setRegError('Full name is required.'); return; }
    if (!reg.mci_number.trim()) { setRegError('MCI number is required.'); return; }
    if (!reg.qualifications.trim()) { setRegError('Qualifications are required.'); return; }

    setLoading(true);
    try {
      const { user } = useAuthStore.getState();

      // Upgrade role to doctor if not already
      if (user?.role !== 'doctor') {
        await authApi.updateRole('doctor');
        // Refresh the JWT so it carries role: doctor (role is baked into the token at issue time)
        const { refreshToken: storedRefreshToken } = useAuthStore.getState();
        const refreshRes = await authApi.refreshToken(storedRefreshToken!);
        const { access_token: newAccessToken, refresh_token: newRefreshToken } = refreshRes.data.data;
        setTokens(newAccessToken, newRefreshToken);
      }

      // Create doctor profile
      await doctorApi.createProfile({
        full_name: reg.full_name.trim(),
        mci_number: reg.mci_number.trim().toUpperCase(),
        specialization: reg.specialization.trim() || undefined,
        qualifications: reg.qualifications.split(',').map((q) => q.trim()).filter(Boolean),
        experience_years: reg.experience_years ? Number(reg.experience_years) : 0,
        gender: reg.gender || undefined,
        languages: reg.languages.split(',').map((l) => l.trim()).filter(Boolean),
      });

      // Update stored user to reflect new role
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        setUser({ ...currentUser, role: 'doctor', is_profile_complete: true });
      }

      router.push('/doctor/dashboard');
    } catch (err: any) {
      setRegError(err?.response?.data?.error?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 placeholder:text-gray-600 transition-all';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase mb-1';

  return (
    <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-7">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/25">
              <span className="text-white text-xl font-bold tracking-tight">RX</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">RxDesk</h1>
            <p className="text-gray-500 text-sm mt-1">
              {step === 'register' ? 'Create Doctor Account' : step === 'set-password' ? 'Set Password' : 'Doctor Panel'}
            </p>
          </div>

          {/* ── Step: Login (phone + password) ── */}
          {step === 'login' && (
            <div>
              <h2 className="text-lg font-semibold text-white/90 mb-5">Sign in to Doctor Panel</h2>

              {/* Phone */}
              <div className="mb-4">
                <label className={labelCls}>Mobile Number</label>
                <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                  <span className="text-gray-500 mr-2 text-sm font-medium">+91</span>
                  <div className="w-px h-5 bg-gray-700 mr-3" />
                  <input
                    className="flex-1 outline-none text-white text-sm bg-transparent placeholder:text-gray-600 py-3"
                    placeholder="10-digit mobile number"
                    type="tel" maxLength={10} value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && isValidPhone && document.getElementById('doc-pw')?.focus()}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-2">
                <label className={labelCls}>Password</label>
                <input
                  id="doc-pw"
                  className={inputCls}
                  placeholder="Your password (min. 8 characters)"
                  type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && isValidPhone && password.length >= 8 && handleLogin()}
                />
              </div>

              {/* Forgot password */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => { if (!isValidPhone) { setError('Enter your mobile number first.'); return; } setError(''); handleSendOtp(true); }}
                  className="text-emerald-400/80 text-xs font-medium hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {error && <ErrorBanner>{error}</ErrorBanner>}

              <button
                className={`w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isValidPhone && password.length >= 8
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 active:scale-[0.98]'
                    : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'}`}
                disabled={!isValidPhone || password.length < 8 || loading}
                onClick={handleLogin}
              >
                {loading ? <Spinner label="Signing in…" /> : 'Sign In'}
              </button>

              {/* First time / OTP login */}
              <div className="text-center mt-5">
                <button
                  onClick={() => { if (!isValidPhone) { setError('Enter your mobile number first.'); return; } setError(''); handleSendOtp(false); }}
                  className="text-gray-500 text-sm hover:text-gray-300 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  First time?{' '}<span className="text-emerald-400 font-medium">Login with OTP</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Step: OTP ── */}
          {step === 'otp' && (
            <div>
              <button onClick={() => { setStep('login'); setOtp(''); setError(''); }} className="text-emerald-400 text-sm mb-5 flex items-center gap-1 hover:text-emerald-300 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back
              </button>
              <h2 className="text-lg font-semibold text-white/90 mb-1">Enter OTP</h2>
              <p className="text-gray-500 text-sm mb-5">Sent to <span className="text-emerald-400/80">+91 {phone}</span></p>
              <input
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 text-xl text-center tracking-[0.5em] text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 mb-4 placeholder:text-gray-600 py-3 transition-all"
                placeholder="● ● ● ● ● ●"
                type="text" inputMode="numeric" maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && handleVerifyOtp()}
              />
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <button
                className={`w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 ${otp.length === 6
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 active:scale-[0.98]'
                  : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'}`}
                disabled={otp.length < 6 || loading} onClick={handleVerifyOtp}
              >
                {loading ? <Spinner label="Verifying…" /> : 'Verify & Continue'}
              </button>
              <div className="text-center mt-5">
                {resendTimer > 0 ? (
                  <p className="text-gray-600 text-sm">Resend in <span className="text-emerald-400/80 font-medium">{resendTimer}s</span></p>
                ) : (
                  <button className="text-emerald-400 text-sm font-medium hover:text-emerald-300 transition-colors disabled:opacity-50" disabled={loading} onClick={handleResendOtp}>
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Set Password ── */}
          {step === 'set-password' && (
            <div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2.5 rounded-xl mb-5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {forgotMode ? 'OTP verified! Set your new password below.' : 'OTP verified! Create a password to sign in faster next time.'}
              </div>
              <div className="mb-4">
                <label className={labelCls}>{forgotMode ? 'New Password' : 'Create Password'}</label>
                <input className={inputCls} type="password" placeholder="Min. 8 characters"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="mb-4">
                <label className={labelCls}>Confirm Password</label>
                <input className={inputCls} type="password" placeholder="Repeat password"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()} />
              </div>
              {newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <ErrorBanner>Passwords do not match.</ErrorBanner>
              )}
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <button
                className={`w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  newPassword.length >= 8 && newPassword === confirmPassword
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 active:scale-[0.98]'
                    : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'}`}
                disabled={newPassword.length < 8 || newPassword !== confirmPassword || loading}
                onClick={handleSetPassword}
              >
                {loading ? <Spinner label="Saving…" /> : 'Set Password & Continue'}
              </button>
            </div>
          )}

          {/* ── Step: Register ── */}
          {step === 'register' && (
            <div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2.5 rounded-xl mb-5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                OTP verified! Complete your doctor profile below.
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input className={inputCls} placeholder="Dr. Your Full Name" value={reg.full_name}
                    onChange={(e) => setReg((p) => ({ ...p, full_name: e.target.value }))} />
                </div>

                <div>
                  <label className={labelCls}>MCI Registration Number *</label>
                  <input className={inputCls} placeholder="e.g. MH-12345" value={reg.mci_number}
                    onChange={(e) => setReg((p) => ({ ...p, mci_number: e.target.value }))}
                    autoCapitalize="characters" />
                </div>

                <div>
                  <label className={labelCls}>Qualifications * (comma-separated)</label>
                  <input className={inputCls} placeholder="MBBS, MD Medicine" value={reg.qualifications}
                    onChange={(e) => setReg((p) => ({ ...p, qualifications: e.target.value }))} />
                </div>

                <div>
                  <label className={labelCls}>Specialization</label>
                  <input className={inputCls} placeholder="e.g. Cardiologist, General Physician" value={reg.specialization}
                    onChange={(e) => setReg((p) => ({ ...p, specialization: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Experience (years)</label>
                    <input className={inputCls} placeholder="0" type="number" min={0} value={reg.experience_years}
                      onChange={(e) => setReg((p) => ({ ...p, experience_years: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select
                      className={`${inputCls} appearance-none`}
                      value={reg.gender}
                      onChange={(e) => setReg((p) => ({ ...p, gender: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {GENDER_OPTIONS.map((g) => (
                        <option key={g} value={g} className="bg-gray-900 capitalize">{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Languages (comma-separated)</label>
                  <input className={inputCls} placeholder="Hindi, English" value={reg.languages}
                    onChange={(e) => setReg((p) => ({ ...p, languages: e.target.value }))} />
                </div>
              </div>

              <p className="text-xs text-gray-600 mt-3 mb-4">
                * Your profile will be reviewed by an admin before you can accept appointments.
              </p>

              {regError && <ErrorBanner>{regError}</ErrorBanner>}

              <button
                className={`w-full h-12 rounded-xl text-base font-semibold transition-all duration-200 ${!loading
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 active:scale-[0.98]'
                  : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'}`}
                disabled={loading}
                onClick={handleRegister}
              >
                {loading ? <Spinner label="Creating account…" /> : 'Create Doctor Account'}
              </button>
            </div>
          )}
        </div>
        <p className="text-center text-gray-700 text-xs mt-6">Powered by RxDesk Technologies</p>
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
