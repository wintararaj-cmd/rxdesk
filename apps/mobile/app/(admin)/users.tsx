import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

interface AppUser {
  id: string;
  phone: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

const ROLE_OPTIONS = ['all', 'patient', 'doctor', 'shop_owner'] as const;
const ROLE_ICON: Record<string, string> = { patient: '🏥', doctor: '👨‍⚕️', shop_owner: '💊', admin: '🔑' };
const ROLE_COLOR: Record<string, string> = { patient: 'text-sky-600', doctor: 'text-emerald-600', shop_owner: 'text-violet-600', admin: 'text-red-600' };
const ROLE_BG: Record<string, string> = { patient: 'bg-sky-50', doctor: 'bg-emerald-50', shop_owner: 'bg-violet-50', admin: 'bg-red-50' };

export default function AdminUsersScreen() {
  const [roleFilter, setRoleFilter] = useState<typeof ROLE_OPTIONS[number]>('all');
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading, refetch, isRefetching } = useQuery<AppUser[]>({
    queryKey: ['admin-users', roleFilter],
    queryFn: () => apiClient.get('/admin/users', { params: roleFilter !== 'all' ? { role: roleFilter } : {} })
      .then((r) => r.data.data),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.phone?.includes(q) || u.role?.includes(q);
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <Text className="text-xl font-bold text-gray-900">All Users</Text>
        <Text className="text-gray-400 text-xs mt-0.5">{users.length} total · {filtered.length} shown</Text>
      </View>

      {/* Search */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <TextInput
          className="bg-gray-100 rounded-xl px-4 h-10 text-sm text-gray-900"
          placeholder="Search by phone number…"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Role filter chips */}
      <View className="flex-row gap-2 px-4 py-2 bg-white border-b border-gray-100">
        {ROLE_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRoleFilter(r)}
            className={`px-3 py-1 rounded-full ${roleFilter === r ? 'bg-red-600' : 'bg-gray-100'}`}
          >
            <Text className={`text-xs font-medium ${roleFilter === r ? 'text-white' : 'text-gray-500'}`}>
              {r === 'all' ? 'All' : r === 'shop_owner' ? 'Shops' : r.charAt(0).toUpperCase() + r.slice(1) + 's'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#DC2626" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">👥</Text>
              <Text className="text-gray-400 text-base">No {roleFilter === 'all' ? '' : roleFilter} users found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex-row items-center gap-3">
              <View className={`w-10 h-10 ${ROLE_BG[item.role] ?? 'bg-gray-100'} rounded-full items-center justify-center flex-shrink-0`}>
                <Text className="text-base">{ROLE_ICON[item.role] ?? '👤'}</Text>
              </View>

              <View className="flex-1">
                <Text className="font-semibold text-gray-900 text-sm">+91 {item.phone}</Text>
                <Text className={`text-xs font-medium capitalize mt-0.5 ${ROLE_COLOR[item.role] ?? 'text-gray-500'}`}>
                  {item.role?.replace('_', ' ')}
                </Text>
              </View>

              <View className="items-end gap-1">
                <View className={`px-2 py-0.5 rounded-full ${item.is_active ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  <Text className={`text-xs ${item.is_active ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                {item.is_verified && (
                  <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                    <Text className="text-blue-600 text-xs">✓ Verified</Text>
                  </View>
                )}
                <Text className="text-gray-300 text-xs">
                  {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
