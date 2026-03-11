import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function VerifyOtpScreen() {
  const { phone, ref, mode } = useLocalSearchParams<{ phone: string; ref: string; mode?: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputs = useRef<TextInput[]>([]);
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((p) => p - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleChange = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, code, ref);
      const { access_token, refresh_token, user } = res.data.data;
      await setTokens(access_token, refresh_token);
      // Store full user including phone; mark is_profile_complete from backend
      await setUser({
        id: user.id,
        phone: user.phone ?? phone,
        role: user.role,
        is_verified: true,
        is_profile_complete: user.is_profile_complete,
      });

      if (mode === 'reset') {
        // Forgot-password flow — navigate to reset-password screen with OTP ref
        router.replace({ pathname: '/(auth)/reset-password', params: { phone, otp_ref: ref } });
      } else if (user.requires_password_setup) {
        // First-time login — user must set a password before continuing
        router.replace('/(auth)/set-password');
      } else if (!user.is_profile_complete) {
        // New user (already has password) — pick role and set up profile
        router.replace('/(auth)/select-role');
      }
      // else: RootGuard routes to the correct role group
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.response?.data?.error?.message ?? 'The OTP entered is incorrect. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authApi.sendOtp(phone);
      setResendTimer(30);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      Alert.alert('Error', 'Could not resend OTP.');
    }
  };

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <TouchableOpacity onPress={() => router.back()} className="mb-8">
        <Text className="text-sky-500 text-base">← Back</Text>
      </TouchableOpacity>

      <Text className="text-2xl font-bold text-gray-900 mb-2">Verify OTP</Text>
      <Text className="text-gray-500 mb-8">
        We sent a 6-digit OTP to <Text className="font-semibold text-gray-800">+91 {phone}</Text>
      </Text>

      {/* OTP boxes */}
      <View className="flex-row justify-between mb-8">
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(r) => { if (r) inputs.current[i] = r; }}
            className="w-12 h-14 border-2 rounded-xl text-center text-xl font-bold text-gray-900 border-gray-300 focus:border-sky-500"
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(v) => handleChange(v, i)}
          />
        ))}
      </View>

      <TouchableOpacity
        className={`h-14 rounded-xl items-center justify-center ${otp.join('').length === 6 ? 'bg-sky-500' : 'bg-gray-200'}`}
        onPress={handleVerify}
        disabled={otp.join('').length < 6 || loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-base">Verify & Continue</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-500">Didn't receive it? </Text>
        {resendTimer > 0 ? (
          <Text className="text-gray-400">Resend in {resendTimer}s</Text>
        ) : (
          <TouchableOpacity onPress={handleResend}>
            <Text className="text-sky-500 font-semibold">Resend OTP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
