import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
  mci_number: string;
  verification_status: string;
  rejection_reason?: string;
  created_at: string;
  user?: { phone: string };
}

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected'] as const;
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pending:  { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  rejected: { bg: 'bg-red-100',     text: 'text-red-600'     },
};

export default function AdminDoctorsScreen() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[number]>('pending');
  const [search, setSearch] = useState('');

  const { data: doctors = [], isLoading, refetch, isRefetching } = useQuery<Doctor[]>({
    queryKey: ['admin-doctors', statusFilter],
    queryFn: () => apiClient.get('/admin/doctors', { params: statusFilter !== 'all' ? { status: statusFilter } : {} })
      .then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status, rejection_reason }: { id: string; status: 'approved' | 'rejected'; rejection_reason?: string }) =>
      apiClient.patch(`/admin/doctors/${id}/verify`, { status, rejection_reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-doctors'] }),
    onError: () => Alert.alert('Error', 'Action failed. Please try again.'),
  });

  const confirmAction = (doctor: Doctor, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      Alert.prompt(
        'Reject Doctor',
        `Provide a reason for rejecting Dr. ${doctor.full_name} (optional):`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: (reason) => verifyMutation.mutate({ id: doctor.id, status, rejection_reason: reason ?? undefined }),
          },
        ],
        'plain-text',
      );
    } else {
      Alert.alert('Approve?', `Approve Dr. ${doctor.full_name}?\nMCI: ${doctor.mci_number}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => verifyMutation.mutate({ id: doctor.id, status }) },
      ]);
    }
  };

  const filtered = doctors.filter((d) => {
    const q = search.toLowerCase();
    return !q || d.full_name?.toLowerCase().includes(q) || d.specialization?.toLowerCase().includes(q) || d.user?.phone?.includes(q);
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <Text className="text-xl font-bold text-gray-900">Doctors</Text>
        <Text className="text-gray-400 text-xs mt-0.5">Manage doctor verification</Text>
      </View>

      {/* Search */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <TextInput
          className="bg-gray-100 rounded-xl px-4 h-10 text-sm text-gray-900"
          placeholder="Search by name, specialization or phone…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status filter chips */}
      <View className="flex-row gap-2 px-4 py-2 bg-white border-b border-gray-100">
        {STATUS_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full ${statusFilter === s ? 'bg-red-600' : 'bg-gray-100'}`}
          >
            <Text className={`text-xs font-medium capitalize ${statusFilter === s ? 'text-white' : 'text-gray-500'}`}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#DC2626" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">👨‍⚕️</Text>
              <Text className="text-gray-400 text-base">No {statusFilter} doctors</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.verification_status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
            return (
              <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-start mb-1">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900 text-sm">Dr. {item.full_name}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">{item.specialization}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">MCI: {item.mci_number}</Text>
                    {item.user?.phone && <Text className="text-gray-400 text-xs">+91 {item.user.phone}</Text>}
                    {item.created_at && (
                      <Text className="text-gray-300 text-xs mt-0.5">
                        Registered {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                  <View className={`${sc.bg} px-2 py-0.5 rounded-full ml-2`}>
                    <Text className={`${sc.text} text-xs font-medium capitalize`}>{item.verification_status}</Text>
                  </View>
                </View>

                {item.rejection_reason && (
                  <View className="bg-red-50 rounded-lg p-2 mt-2 mb-1">
                    <Text className="text-red-500 text-xs">❌ {item.rejection_reason}</Text>
                  </View>
                )}

                {item.verification_status === 'pending' && (
                  <View className="flex-row gap-2 mt-3 pt-3 border-t border-gray-50">
                    <TouchableOpacity
                      onPress={() => confirmAction(item, 'approved')}
                      disabled={verifyMutation.isPending}
                      className="flex-1 bg-emerald-500 py-2.5 rounded-xl items-center"
                    >
                      <Text className="text-white text-xs font-semibold">✅ Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmAction(item, 'rejected')}
                      disabled={verifyMutation.isPending}
                      className="flex-1 bg-red-50 border border-red-200 py-2.5 rounded-xl items-center"
                    >
                      <Text className="text-red-500 text-xs font-semibold">🚫 Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
