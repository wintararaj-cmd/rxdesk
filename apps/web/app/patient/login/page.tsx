'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Activity, ArrowLeft } from 'lucide-react';
import { authApi, patientApi } from '../../../lib/apiClient';
import { useAuthStore } from '../../../store/authStore';

const GENDER_OPTIONS = ['male', 'female', 'other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function PatientLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'login' | 'otp' | 'set-password' | 'profile'>('login');
  const [otp, setOtp] = useState('');
  const [otpRef, setOtpRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [forgotMode, setForgotMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [profile, setProfile] = useState({ full_name: '', age: '', gender: '', blood_group: '', city: '' });

  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, setUser, accessToken, user } = useAuthStore();
  const redirect = searchParams.get('redirect') ?? '/patient/dashboard';

  // Redirect already authenticated patients
  useEffect(() => {
    if (step === 'login' && accessToken && user?.role === 'patient') {
      router.replace(redirect);
    }
  }, [accessToken, user, router, step, redirect]);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer((t) => t - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timer]);

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);
  const fullPhone = '+91' + phone;

  // â”€â”€ Password login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleLogin = async () => {
    if (!isValidPhone || password.length < 8) return;
    setError(''); setLoading(true);
    try {
      const res = await authApi.loginWithPassword(fullPhone, password);
      const { access_token, refresh_token, user: u } = res.data.data;
      if (u.role !== 'patient') {
        setError('This phone number is not registered as a Patient account.');
        return;
      }
      setTokens(access_token, refresh_token);
      setUser(u);
      router.push(redirect);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'PASSWORD_NOT_SET') {
        setError('No password set yet. Use "Login with OTP" below.');
      } else {
        setError(err?.response?.data?.error?.message ?? 'Invalid phone number or password.');
      }
    } finally { setLoading(false); }
  };

  const sendOtp = async (forgot = false) => {
    setError(''); setLoading(true); setForgotMode(forgot);
    try {
      const res = await authApi.sendOtp(fullPhone);
      setOtpRef(res.data.data.otp_ref);
      setStep('otp'); setTimer(60);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setError(''); setLoading(true);
    try {
      const res = await authApi.verifyOtp(fullPhone, otp, otpRef);
      const { access_token, refresh_token, user: u } = res.data.data;
      setTokens(access_token, refresh_token);
      setUser(u);

      const profileIncomplete = !u.is_profile_complete;
      if (u.requires_password_setup || forgotMode) {
        setNeedsProfile(profileIncomplete);
        setStep('set-password');
      } else if (profileIncomplete) {
        setStep('profile');
      } else {
        router.push(redirect);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) return;
    setError(''); setLoading(true);
    try {
      await authApi.setPassword(newPassword, confirmPassword);
      if (needsProfile) {
        setStep('profile');
      } else {
        router.push(redirect);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to set password.');
    } finally { setLoading(false); }
  };

  const submitProfile = async () => {
    if (!profile.full_name.trim()) { setError('Full name is required.'); return; }
    setError(''); setLoading(true);
    try {
      const payload: Record<string, string | number> = { full_name: profile.full_name.trim() };
      if (profile.age) payload.age = parseInt(profile.age, 10);
      if (profile.gender) payload.gender = profile.gender;
      if (profile.blood_group) payload.blood_group = profile.blood_group;
      if (profile.city) payload.city = profile.city.trim();
      await patientApi.createProfile(payload);
      router.push(redirect);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to save profile. Please try again.');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full h-11 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50 transition-all';

  return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/6 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Back to home */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to RxDesk
        </Link>

        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/20">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">RxDesk</h1>
            <p className="text-gray-500 text-sm mt-1">Patient Portal</p>
          </div>

          {/* â”€â”€ LOGIN STEP â”€â”€ */}
          {step === 'login' && (
            <>
              <h2 className="text-base font-semibold text-white/90 mb-1">Sign in to your account</h2>
              <p className="text-xs text-gray-500 mb-5">Enter your mobile number and password</p>

              {/* Phone */}
              <div className="flex items-center bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 h-11 mb-3 focus-within:border-blue-500/50 transition-all">
                <span className="text-gray-500 text-sm mr-2">+91</span>
                <div className="w-px h-4 bg-gray-700 mr-3" />
                <input
                  type="tel" inputMode="numeric" maxLength={10} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && isValidPhone && document.getElementById('pat-pw')?.focus()}
                  placeholder="10-digit mobile number"
                  className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-gray-600"
                />
              </div>

              {/* Password */}
              <input
                id="pat-pw"
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && isValidPhone && password.length >= 8 && handleLogin()}
                placeholder="Password (min. 8 characters)"
                className={`${inputCls} mb-2`}
              />

              {/* Forgot password */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => { if (!isValidPhone) { setError('Enter your mobile number first.'); return; } setError(''); sendOtp(true); }}
                  className="text-blue-400/80 text-xs font-medium hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

              <button
                onClick={handleLogin} disabled={!isValidPhone || password.length < 8 || loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow shadow-blue-500/20"
              >
                {loading ? 'Signing inâ€¦' : 'Sign In'}
              </button>

              <div className="text-center mt-5">
                <button
                  onClick={() => { if (!isValidPhone) { setError('Enter your mobile number first.'); return; } setError(''); sendOtp(false); }}
                  className="text-gray-500 text-sm hover:text-gray-300 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  First time?{' '}<span className="text-blue-400 font-medium">Login with OTP</span>
                </button>
              </div>
            </>
          )}

          {/* â”€â”€ OTP STEP â”€â”€ */}
          {step === 'otp' && (
            <>
              <button onClick={() => { setStep('login'); setOtp(''); setError(''); }} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-5 transition-colors">
                <ArrowLeft className="w-3 h-3" /> Back
              </button>

              <h2 className="text-base font-semibold text-white/90 mb-1">Enter OTP</h2>
              <p className="text-xs text-gray-500 mb-5">Sent to <span className="text-white">+91 {phone}</span></p>

              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 h-12 mb-4 focus-within:border-blue-500/50 transition-all flex items-center">
                <input
                  type="tel" inputMode="numeric" maxLength={6} value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && verifyOtp()}
                  placeholder="6-digit OTP"
                  className="w-full bg-transparent outline-none text-white text-sm placeholder:text-gray-600 tracking-[0.2em]"
                />
              </div>

              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

              <button
                onClick={verifyOtp} disabled={otp.length !== 6 || loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {loading ? 'Verifyingâ€¦' : 'Verify & Continue'}
              </button>

              <div className="text-center mt-4">
                {timer > 0 ? (
                  <span className="text-xs text-gray-500">Resend in {timer}s</span>
                ) : (
                  <button onClick={() => sendOtp(forgotMode)} disabled={loading} className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50">
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}

          {/* â”€â”€ SET PASSWORD STEP â”€â”€ */}
          {step === 'set-password' && (
            <>
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-4 py-2.5 rounded-xl mb-5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {forgotMode ? 'OTP verified! Set your new password below.' : 'OTP verified! Create a password to sign in faster next time.'}
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">{forgotMode ? 'New Password' : 'Create Password'}</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                    placeholder="Repeat password" className={inputCls} />
                </div>
              </div>

              {newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-red-400 text-xs mb-3">Passwords do not match.</p>
              )}
              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

              <button
                onClick={handleSetPassword}
                disabled={newPassword.length < 8 || newPassword !== confirmPassword || loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {loading ? 'Savingâ€¦' : 'Set Password & Continue'}
              </button>
            </>
          )}

          {/* â”€â”€ PROFILE SETUP STEP â”€â”€ */}
          {step === 'profile' && (
            <>
              <h2 className="text-base font-semibold text-white/90 mb-1">Complete your profile</h2>
              <p className="text-xs text-gray-500 mb-5">A few details to get you started</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                  <input
                    type="text" value={profile.full_name}
                    onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="Your full name" className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Age</label>
                    <input type="number" min={1} max={120} value={profile.age}
                      onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                      placeholder="Age" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Gender</label>
                    <select value={profile.gender}
                      onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
                      className={`${inputCls} appearance-none`}>
                      <option value="" className="bg-[#111120]">Selectâ€¦</option>
                      {GENDER_OPTIONS.map((g) => (
                        <option key={g} value={g} className="bg-[#111120] capitalize">{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Blood Group</label>
                    <select value={profile.blood_group}
                      onChange={(e) => setProfile((p) => ({ ...p, blood_group: e.target.value }))}
                      className={`${inputCls} appearance-none`}>
                      <option value="" className="bg-[#111120]">Selectâ€¦</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg} className="bg-[#111120]">{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">City</label>
                    <input type="text" value={profile.city}
                      onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                      placeholder="Your city" className={inputCls} />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

              <button
                onClick={submitProfile} disabled={loading}
                className="w-full h-12 mt-5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {loading ? 'Savingâ€¦' : 'Save & Continue'}
              </button>
            </>
          )}
        </div>

        {/* Role switcher */}
        <div className="mt-5 text-center space-y-2">
          <p className="text-xs text-gray-600">Not a patient?</p>
          <div className="flex justify-center gap-4 text-xs">
            <Link href="/doctor/login" className="text-violet-400 hover:text-violet-300 transition-colors">Doctor Login</Link>
            <span className="text-gray-700">Â·</span>
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">Shop / Clinic Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
