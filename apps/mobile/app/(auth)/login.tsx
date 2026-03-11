import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);
  const isFormValid = isValidPhone && password.length >= 8;

  const handleLogin = async () => {
    if (!isFormValid) return;
    setLoading(true);
    try {
      const fullPhone = '+91' + phone;
      const res = await authApi.loginWithPassword(fullPhone, password);
      const { access_token, refresh_token, user } = res.data.data;
      await setTokens(access_token, refresh_token);
      await setUser({
        id: user.id,
        phone: user.phone ?? fullPhone,
        role: user.role,
        is_verified: true,
        is_profile_complete: user.is_profile_complete,
      });
      // RootGuard will route to the correct role group
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'PASSWORD_NOT_SET') {
        Alert.alert(
          'First Time Login',
          'You haven\'t set a password yet. Please login with OTP to set your password.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Login with OTP', onPress: () => handleSendOtp('+91' + phone, 'otp-login') },
          ]
        );
      } else {
        Alert.alert('Login Failed', err?.response?.data?.error?.message ?? 'Invalid phone number or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (fullPhone: string, mode: 'otp-login' | 'reset' = 'otp-login') => {
    setLoading(true);
    try {
      const res = await authApi.sendOtp(fullPhone);
      const { otp_ref: ref } = res.data.data;
      router.push({ pathname: '/(auth)/verify-otp', params: { phone: fullPhone, ref, mode } });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFirstTimeLogin = () => {
    if (!isValidPhone) {
      Alert.alert('Enter Phone', 'Please enter your 10-digit mobile number first.');
      return;
    }
    handleSendOtp('+91' + phone, 'otp-login');
  };

  const handleForgotPassword = () => {
    if (!isValidPhone) {
      Alert.alert('Enter Phone', 'Please enter your 10-digit mobile number first.');
      return;
    }
    handleSendOtp('+91' + phone, 'reset');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 rounded-2xl bg-sky-500 items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">DN</Text>
          </View>
          <Text className="text-3xl font-bold text-gray-900">RxDesk</Text>
          <Text className="text-gray-500 mt-2 text-center">
            Healthcare at your doorstep
          </Text>
        </View>

        {/* Form */}
        <Text className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</Text>

        {/* Phone */}
        <View className="flex-row items-center border border-gray-300 rounded-xl px-4 h-14 mb-4">
          <Text className="text-gray-500 mr-2 text-base">+91</Text>
          <View className="w-px h-6 bg-gray-300 mr-3" />
          <TextInput
            className="flex-1 text-base text-gray-900"
            placeholder="10-digit mobile number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            returnKeyType="next"
          />
        </View>

        {/* Password */}
        <View className="border border-gray-300 rounded-xl px-4 h-14 mb-2 justify-center">
          <TextInput
            className="text-base text-gray-900"
            placeholder="Password (min. 8 characters)"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />
        </View>

        {/* Forgot password */}
        <TouchableOpacity onPress={handleForgotPassword} className="self-end mb-4">
          <Text className="text-sky-500 text-sm font-medium">Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center ${isFormValid ? 'bg-sky-500' : 'bg-gray-200'}`}
          onPress={handleLogin}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`text-base font-semibold ${isFormValid ? 'text-white' : 'text-gray-400'}`}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* First-time login link */}
        <TouchableOpacity onPress={handleFirstTimeLogin} className="mt-6 items-center">
          <Text className="text-gray-500 text-sm">
            First time here?{' '}
            <Text className="text-sky-500 font-semibold">Login with OTP</Text>
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-400 text-xs text-center mt-6">
          By continuing, you agree to RxDesk's Terms of Service and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
