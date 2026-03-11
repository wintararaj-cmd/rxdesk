import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '@rxdesk/shared';

const ROLES = [
  {
    role: 'patient' as UserRole,
    title: 'Patient',
    subtitle: 'Book appointments, get prescriptions',
    icon: '🏥',
    color: 'border-sky-400',
    bg: 'bg-sky-50',
  },
  {
    role: 'doctor' as UserRole,
    title: 'Doctor',
    subtitle: 'Manage chambers, appointments, prescriptions',
    icon: '👨‍⚕️',
    color: 'border-emerald-400',
    bg: 'bg-emerald-50',
  },
  {
    role: 'shop_owner' as UserRole,
    title: 'Medical Shop',
    subtitle: 'Manage inventory, billing, appointments',
    icon: '💊',
    color: 'border-violet-400',
    bg: 'bg-violet-50',
  },
] as const;

export default function SelectRoleScreen() {
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser, user } = useAuthStore();

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await authApi.updateRole(selected);
      // Update local user state with new role; keep is_profile_complete: false so
      // RootGuard doesn't redirect out of the auth group before setup is complete
      if (user) await setUser({ ...user, role: selected, is_profile_complete: false });
      router.replace('/(auth)/setup-profile');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to set role.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-2xl font-bold text-gray-900 mb-2">I am a...</Text>
      <Text className="text-gray-500 mb-8">Select your role on DocNear</Text>

      <View className="gap-4 mb-8">
        {ROLES.map(({ role, title, subtitle, icon, color, bg }) => (
          <TouchableOpacity
            key={role}
            onPress={() => setSelected(role)}
            className={`p-5 rounded-2xl border-2 ${selected === role ? color : 'border-gray-200'} ${selected === role ? bg : 'bg-white'}`}
          >
            <Text className="text-3xl mb-2">{icon}</Text>
            <Text className="text-lg font-semibold text-gray-900">{title}</Text>
            <Text className="text-gray-500 text-sm">{subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        className={`h-14 rounded-xl items-center justify-center ${selected ? 'bg-sky-500' : 'bg-gray-200'}`}
        onPress={handleContinue}
        disabled={!selected || loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className={`text-base font-semibold ${selected ? 'text-white' : 'text-gray-400'}`}>
            Continue as {selected ? ROLES.find((r) => r.role === selected)?.title : '...'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
