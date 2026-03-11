import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { doctorApi, authApi } from '../../api/client';
import { useRouter } from 'expo-router';

interface DoctorProfile { id: string; full_name: string; specialization: string; experience_years: number; qualifications: string[]; mci_number: string; verification_status: string; }

export default function DoctorProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: profile, isLoading } = useQuery<DoctorProfile>({
    queryKey: ['doctor-profile'],
    queryFn: () => doctorApi.getProfile('me').then((r) => r.data.data),
    onSuccess: (d: DoctorProfile) => setForm({
      full_name: d.full_name ?? '', specialization: d.specialization ?? '',
      experience_years: String(d.experience_years ?? ''),
      qualifications: (d.qualifications ?? []).join(', '),
      mci_number: d.mci_number ?? '',
    }),
  } as any);

  const updateMutation = useMutation({
    mutationFn: (data: object) => doctorApi.updateProfile(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctor-profile'] }); setEditing(false); },
    onError: () => Alert.alert('Error', 'Could not update profile.'),
  });

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* noop */ }
    await clearAuth();
    router.replace('/(auth)/login');
  };

  if (isLoading) return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#10B981" /></View>;

  const FIELDS = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'specialization', label: 'Specialization' },
    { key: 'mci_number', label: 'MCI Number' },
    { key: 'qualifications', label: 'Qualifications (comma separated)' },
    { key: 'experience_years', label: 'Years of Experience', keyboardType: 'number-pad' as const },
  ];

  const vStatus = profile?.verification_status;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-emerald-500 px-6 pt-5 pb-8 items-center">
          <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3">
            <Text className="text-white text-4xl">👨‍⚕️</Text>
          </View>
          <Text className="text-white text-xl font-bold">Dr. {profile?.full_name ?? '...'}</Text>
          <Text className="text-emerald-100 text-sm mt-1">{profile?.specialization}</Text>

          {/* Verification badge */}
          <View className={`mt-3 px-4 py-1 rounded-full ${vStatus === 'approved' ? 'bg-white/20' : vStatus === 'pending' ? 'bg-amber-400/40' : 'bg-red-400/40'}`}>
            <Text className="text-white text-xs font-semibold">
              {vStatus === 'approved' ? '✅ Verified Doctor' : vStatus === 'pending' ? '⏳ Verification Pending' : '❌ Rejected'}
            </Text>
          </View>
        </View>

        {/* Details card */}
        <View className="mx-4 -mt-4 bg-white rounded-2xl shadow-sm p-5 mb-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-semibold text-gray-900">Profile Details</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text className="text-emerald-500 text-sm font-medium">{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {FIELDS.map(({ key, label, keyboardType }) => (
            <View key={key} className="mb-3">
              <Text className="text-xs text-gray-400 mb-1">{label}</Text>
              {editing
                ? <TextInput
                    className="border border-gray-200 rounded-xl px-3 h-10 text-gray-900 text-sm"
                    value={form[key] ?? ''}
                    keyboardType={keyboardType}
                    onChangeText={(v) => setForm({ ...form, [key]: v })}
                  />
                : <Text className="text-gray-900 text-sm">{form[key] || <Text className="text-gray-400">Not set</Text>}</Text>
              }
            </View>
          ))}

          {/* Mobile number (read-only) */}
          <View className="mb-3">
            <Text className="text-xs text-gray-400 mb-1">Mobile</Text>
            <Text className="text-gray-900 text-sm">{user?.phone}</Text>
          </View>

          {editing && (
            <TouchableOpacity
              className="bg-emerald-500 h-11 rounded-xl items-center justify-center mt-2"
              onPress={() => updateMutation.mutate({
                ...form,
                experience_years: Number(form.experience_years),
                qualifications: form.qualifications?.split(',').map((q) => q.trim()).filter(Boolean) ?? [],
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">Save Changes</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Logout */}
        <View className="mx-4 bg-white rounded-2xl shadow-sm p-5 mb-6">
          <TouchableOpacity onPress={handleLogout} className="py-2">
            <Text className="text-red-500 font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
