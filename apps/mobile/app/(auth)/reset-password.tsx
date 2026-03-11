import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authApi } from '../../api/client';

export default function ResetPasswordScreen() {
  const { phone, otp_ref } = useLocalSearchParams<{ phone: string; otp_ref: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isValid = password.length >= 8 && password === confirmPassword;

  const handleReset = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await authApi.resetPassword(phone, otp_ref, password, confirmPassword);
      Alert.alert('Password Reset', 'Your password has been reset successfully. Please log in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to reset password. The OTP link may have expired.');
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
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-sky-500 text-base">← Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-gray-900 mb-2">Reset Password</Text>
        <Text className="text-gray-500 mb-8">Create a new password for {phone}</Text>

        <TextInput
          className="border border-gray-300 rounded-xl px-4 h-14 text-base text-gray-900 mb-4"
          placeholder="New password (min. 8 characters)"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
        />

        <TextInput
          className="border border-gray-300 rounded-xl px-4 h-14 text-base text-gray-900 mb-6"
          placeholder="Confirm new password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onSubmitEditing={handleReset}
          returnKeyType="done"
        />

        {confirmPassword.length > 0 && password !== confirmPassword && (
          <Text className="text-red-500 text-sm mb-4 -mt-2">Passwords do not match</Text>
        )}

        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center ${isValid ? 'bg-sky-500' : 'bg-gray-200'}`}
          onPress={handleReset}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`text-base font-semibold ${isValid ? 'text-white' : 'text-gray-400'}`}>
              Reset Password
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
