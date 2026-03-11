import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

interface Shop {
  id: string;
  shop_name: string;
  address_line: string;
  city: string;
  state: string;
  drug_license_no: string;
  verification_status: string;
  shop_type?: string;
  created_at: string;
  owner?: { phone: string };
}

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected'] as const;
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pending:  { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  rejected: { bg: 'bg-red-100',     text: 'text-red-600'     },
};

export default function AdminShopsScreen() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[number]>('pending');
  const [search, setSearch] = useState('');

  const { data: shops = [], isLoading, refetch, isRefetching } = useQuery<Shop[]>({
    queryKey: ['admin-shops', statusFilter],
    queryFn: () => apiClient.get('/admin/shops', { params: statusFilter !== 'all' ? { status: statusFilter } : {} })
      .then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      apiClient.patch(`/admin/shops/${id}/verify`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: () => Alert.alert('Error', 'Action failed. Please try again.'),
  });

  const confirmAction = (shop: Shop, status: 'approved' | 'rejected') => {
    Alert.alert(
      status === 'approved' ? 'Approve Shop?' : 'Reject Shop?',
      `${status === 'approved' ? 'Approve' : 'Reject'} ${shop.shop_name}?\nLicense: ${shop.drug_license_no}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'approved' ? 'Approve' : 'Reject',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: () => verifyMutation.mutate({ id: shop.id, status }),
        },
      ],
    );
  };

  const filtered = shops.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.shop_name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.owner?.phone?.includes(q);
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <Text className="text-xl font-bold text-gray-900">Medical Shops</Text>
        <Text className="text-gray-400 text-xs mt-0.5">Manage shop verification</Text>
      </View>

      {/* Search */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <TextInput
          className="bg-gray-100 rounded-xl px-4 h-10 text-sm text-gray-900"
          placeholder="Search by name, city or phone…"
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
          keyExtractor={(s) => s.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">💊</Text>
              <Text className="text-gray-400 text-base">No {statusFilter} shops</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.verification_status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
            return (
              <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-start mb-1">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900 text-sm">{item.shop_name}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">{item.address_line}, {item.city}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">License: {item.drug_license_no}</Text>
                    {item.owner?.phone && <Text className="text-gray-400 text-xs">+91 {item.owner.phone}</Text>}
                    {item.created_at && (
                      <Text className="text-gray-300 text-xs mt-0.5">
                        Registered {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                  <View className="items-end gap-1">
                    <View className={`${sc.bg} px-2 py-0.5 rounded-full`}>
                      <Text className={`${sc.text} text-xs font-medium capitalize`}>{item.verification_status}</Text>
                    </View>
                    {item.shop_type && (
                      <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                        <Text className="text-gray-500 text-xs capitalize">{item.shop_type}</Text>
                      </View>
                    )}
                  </View>
                </View>

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
