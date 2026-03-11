import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { patientApi, authApi } from '../../api/client';
import { useRouter } from 'expo-router';

interface PatientProfile { id: string; full_name?: string; age?: number; gender?: string; blood_group?: string; address_line?: string; }

export default function PatientProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: profile, isLoading } = useQuery<PatientProfile>({
    queryKey: ['patient-profile'],
    queryFn: () => patientApi.getProfile().then((r) => r.data.data),
    onSuccess: (d: PatientProfile) => setForm({ full_name: d.full_name ?? '', age: String(d.age ?? ''), blood_group: d.blood_group ?? '', address_line: d.address_line ?? '' }),
  } as any);

  const updateMutation = useMutation({
    mutationFn: (data: object) => patientApi.updateProfile(data as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-profile'] }); setEditing(false); },
    onError: () => Alert.alert('Error', 'Could not update profile.'),
  });

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* noop */ }
    await clearAuth();
    router.replace('/(auth)/login');
  };

  if (isLoading) return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#0EA5E9" /></View>;

  const FIELDS = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'age', label: 'Age', keyboardType: 'number-pad' as const },
    { key: 'blood_group', label: 'Blood Group' },
    { key: 'address_line', label: 'Address', multiline: true },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View className="bg-sky-500 px-6 pt-5 pb-8 items-center">
          <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3">
            <Text className="text-white text-3xl font-bold">{(profile?.full_name?.[0] ?? user?.phone?.[0] ?? 'P').toUpperCase()}</Text>
          </View>
          <Text className="text-white text-xl font-bold">{profile?.full_name ?? 'My Profile'}</Text>
          <Text className="text-sky-100 text-sm mt-1">{user?.phone}</Text>
        </View>

        {/* Info card */}
        <View className="mx-4 -mt-4 bg-white rounded-2xl shadow-sm p-5 mb-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-semibold text-gray-900">Profile Details</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text className="text-sky-500 text-sm font-medium">{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {FIELDS.map(({ key, label, keyboardType, multiline }) => (
            <View key={key} className="mb-3">
              <Text className="text-xs text-gray-400 mb-1">{label}</Text>
              {editing ? (
                <TextInput
                  className={`border border-gray-200 rounded-xl px-3 text-gray-900 text-sm ${multiline ? 'h-16 pt-2' : 'h-10'}`}
                  value={form[key] ?? ''}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                  keyboardType={keyboardType}
                  multiline={multiline}
                />
              ) : (
                <Text className="text-gray-900 text-sm">{form[key] || <Text className="text-gray-400">Not set</Text>}</Text>
              )}
            </View>
          ))}

          {editing && (
            <TouchableOpacity
              className="bg-sky-500 h-11 rounded-xl items-center justify-center mt-2"
              onPress={() => updateMutation.mutate({ ...form, age: Number(form.age) })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">Save Changes</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Danger zone */}
        <View className="mx-4 bg-white rounded-2xl shadow-sm p-5 mb-6">
          <TouchableOpacity onPress={handleLogout} className="flex-row items-center gap-3 py-2">
            <Text className="text-red-500 font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
