import { View, Text, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '../../api/client';

interface Analytics {
  doctors: { total: number; pending: number };
  shops: { total: number; pending: number };
  patients: { total: number };
  appointments: { total: number };
}
interface PendingEntry { id: string; name: string; phone?: string; created_at: string; }

export default function AdminDashboardScreen() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'doctors' | 'shops'>('doctors');

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ['admin-analytics'],
    queryFn: () => apiClient.get('/admin/analytics').then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: pendingDoctors = [], isLoading: pdLoading } = useQuery<PendingEntry[]>({
    queryKey: ['admin-pending-doctors'],
    queryFn: () => apiClient.get('/admin/doctors/pending').then((r) =>
      r.data.data.map((d: any) => ({ id: d.id, name: d.full_name, phone: d.user?.phone, created_at: d.created_at ?? d.user?.created_at }))
    ),
    refetchInterval: 30_000,
  });

  const { data: pendingShops = [], isLoading: psLoading } = useQuery<PendingEntry[]>({
    queryKey: ['admin-pending-shops'],
    queryFn: () => apiClient.get('/admin/shops/pending').then((r) =>
      r.data.data.map((s: any) => ({ id: s.id, name: s.shop_name, phone: s.owner?.phone, created_at: s.created_at }))
    ),
    refetchInterval: 30_000,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, type, status }: { id: string; type: 'doctors' | 'shops'; status: 'approved' | 'rejected' }) =>
      apiClient.patch(`/admin/${type}/${id}/verify`, { status }),
    onSuccess: (_, { type, status }) => {
      qc.invalidateQueries({ queryKey: [type === 'doctors' ? 'admin-pending-doctors' : 'admin-pending-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
      Alert.alert(status === 'approved' ? '✅ Approved' : '🚫 Rejected', `${type === 'doctors' ? 'Doctor' : 'Shop'} has been ${status}.`);
    },
    onError: () => Alert.alert('Error', 'Action failed. Please try again.'),
  });

  const confirmVerify = (item: PendingEntry, type: 'doctors' | 'shops', status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      Alert.alert('Reject?', `Are you sure you want to reject "${item.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => verifyMutation.mutate({ id: item.id, type, status }) },
      ]);
    } else {
      verifyMutation.mutate({ id: item.id, type, status });
    }
  };

  const STAT_CARDS = [
    { label: 'Total Patients', value: analytics?.patients?.total, icon: '🏥', color: 'text-sky-700', bg: 'bg-sky-50' },
    { label: 'Total Doctors', value: analytics?.doctors?.total, icon: '👨‍⚕️', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Total Shops', value: analytics?.shops?.total, icon: '💊', color: 'text-violet-700', bg: 'bg-violet-50' },
    { label: 'Total Appointments', value: analytics?.appointments?.total, icon: '📅', color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'Pending Doctors', value: analytics?.doctors?.pending ?? pendingDoctors.length, icon: '⏳', color: 'text-red-700', bg: 'bg-red-50' },
    { label: 'Pending Shops', value: analytics?.shops?.pending ?? pendingShops.length, icon: '⏳', color: 'text-amber-700', bg: 'bg-amber-50' },
  ];

  const pendingList = activeTab === 'doctors' ? pendingDoctors : pendingShops;
  const listLoading = activeTab === 'doctors' ? pdLoading : psLoading;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Admin Dashboard</Text>
        <Text className="text-gray-400 text-xs mt-0.5">DocNear Control Panel</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats grid */}
        <View className="px-4 pt-4">
          <Text className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Platform Overview</Text>
          {analyticsLoading
            ? <ActivityIndicator color="#DC2626" className="my-6" />
            : (
              <View className="flex-row flex-wrap gap-2">
                {STAT_CARDS.map((card) => (
                  <View key={card.label} className={`${card.bg} rounded-2xl p-4`} style={{ width: '47%' }}>
                    <Text className="text-2xl">{card.icon}</Text>
                    <Text className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value ?? '—'}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5 leading-tight">{card.label}</Text>
                  </View>
                ))}
              </View>
            )
          }
        </View>

        {/* Quick pending verifications */}
        <View className="px-4 pt-5 pb-6">
          <Text className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Pending Verifications</Text>

          <View className="flex-row bg-gray-100 rounded-xl p-1 mb-3">
            {(['doctors', 'shops'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setActiveTab(t)}
                className={`flex-1 py-2 rounded-lg items-center ${activeTab === t ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`text-sm font-medium ${activeTab === t ? 'text-gray-900' : 'text-gray-500'}`}>
                  {t === 'doctors' ? '👨‍⚕️ Doctors' : '💊 Shops'}
                  {t === 'doctors' && pendingDoctors.length > 0 ? ` (${pendingDoctors.length})` : ''}
                  {t === 'shops' && pendingShops.length > 0 ? ` (${pendingShops.length})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {listLoading ? (
            <ActivityIndicator color="#DC2626" />
          ) : pendingList.length === 0 ? (
            <View className="bg-white rounded-2xl p-6 items-center border border-gray-100">
              <Text className="text-3xl mb-2">✅</Text>
              <Text className="text-gray-400 text-sm">No pending {activeTab}</Text>
            </View>
          ) : (
            <FlatList
              data={pendingList}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View className="h-2" />}
              renderItem={({ item }) => (
                <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900 text-sm">{item.name}</Text>
                      {item.phone && <Text className="text-gray-400 text-xs mt-0.5">+91 {item.phone}</Text>}
                      {item.created_at && (
                        <Text className="text-gray-300 text-xs mt-0.5">
                          Applied {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                    <View className="bg-amber-100 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-amber-700 text-xs font-medium">Pending</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => confirmVerify(item, activeTab, 'approved')}
                      disabled={verifyMutation.isPending}
                      className="flex-1 bg-emerald-500 py-2.5 rounded-xl items-center"
                    >
                      <Text className="text-white text-xs font-semibold">✅ Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmVerify(item, activeTab, 'rejected')}
                      disabled={verifyMutation.isPending}
                      className="flex-1 bg-red-50 border border-red-200 py-2.5 rounded-xl items-center"
                    >
                      <Text className="text-red-500 text-xs font-semibold">🚫 Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
