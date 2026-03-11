import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function SetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const isValid = password.length >= 8 && password === confirmPassword;

  const handleSetPassword = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await authApi.setPassword(password, confirmPassword);
      // After password is set, continue the standard onboarding flow
      if (!user?.is_profile_complete) {
        router.replace('/(auth)/select-role');
      } else {
        // Existing user who went through OTP for some reason — go home
        router.replace('/(auth)/select-role');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-2xl bg-sky-500 items-center justify-center mb-4">
            <Text className="text-white text-2xl font-bold">DN</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">Set Your Password</Text>
          <Text className="text-gray-500 mt-2 text-center text-sm">
            Create a password to use for future logins
          </Text>
        </View>

        {/* Password */}
        <Text className="text-sm font-medium text-gray-700 mb-2">New Password</Text>
        <View className="border border-gray-300 rounded-xl px-4 h-14 mb-4 justify-center">
          <TextInput
            className="text-base text-gray-900"
            placeholder="At least 8 characters"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="next"
          />
        </View>

        {/* Confirm Password */}
        <Text className="text-sm font-medium text-gray-700 mb-2">Confirm Password</Text>
        <View className={`border rounded-xl px-4 h-14 mb-2 justify-center ${confirmPassword.length > 0 && password !== confirmPassword ? 'border-red-400' : 'border-gray-300'}`}>
          <TextInput
            className="text-base text-gray-900"
            placeholder="Re-enter your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSetPassword}
            returnKeyType="done"
          />
        </View>
        {confirmPassword.length > 0 && password !== confirmPassword && (
          <Text className="text-red-500 text-xs mb-4">Passwords do not match</Text>
        )}

        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center mt-4 ${isValid ? 'bg-sky-500' : 'bg-gray-200'}`}
          onPress={handleSetPassword}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`text-base font-semibold ${isValid ? 'text-white' : 'text-gray-400'}`}>
              Set Password & Continue
            </Text>
          )}
        </TouchableOpacity>

        <Text className="text-gray-400 text-xs text-center mt-8">
          You'll use this password every time you sign in.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
