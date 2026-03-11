import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notificationApi } from '../api/client';

interface Notification {
  id: string;
  title?: string;
  body: string;
  category: string;
  is_read: boolean;
  created_at: string;
  reference_id?: string;
  reference_type?: string;
}

const CATEGORY_ICON: Record<string, string> = {
  appointment_confirmed: '📅',
  appointment_reminder:  '⏰',
  prescription_ready:    '📋',
  bill_generated:        '💰',
  stock_alert:           '⚠️',
  subscription_expiry:   '🔔',
  general:               '📢',
};

const CATEGORY_COLOR: Record<string, string> = {
  appointment_confirmed: 'bg-sky-50 border-sky-200',
  appointment_reminder:  'bg-amber-50 border-amber-200',
  prescription_ready:    'bg-emerald-50 border-emerald-200',
  bill_generated:        'bg-violet-50 border-violet-200',
  stock_alert:           'bg-red-50 border-red-200',
  subscription_expiry:   'bg-orange-50 border-orange-200',
  general:               'bg-gray-50 border-gray-200',
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7)  return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list().then((r) => r.data.data),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-gray-900">Notifications</Text>
          {unreadCount > 0 && (
            <Text className="text-gray-500 text-xs mt-0.5">{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="px-3 py-1.5 bg-sky-50 rounded-lg border border-sky-200"
          >
            <Text className="text-sky-600 text-xs font-semibold">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#0EA5E9" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <Text className="text-5xl mb-3">🔔</Text>
              <Text className="text-gray-400 text-base font-medium">No notifications yet</Text>
              <Text className="text-gray-400 text-sm mt-1">You&apos;ll see updates about appointments and prescriptions here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const icon  = CATEGORY_ICON[item.category]  ?? '📢';
            const color = CATEGORY_COLOR[item.category] ?? 'bg-gray-50 border-gray-200';
            return (
              <TouchableOpacity
                onPress={() => { if (!item.is_read) markOneMutation.mutate(item.id); }}
                activeOpacity={0.7}
                className={`rounded-2xl border p-4 flex-row gap-3 ${color} ${item.is_read ? 'opacity-60' : ''}`}
              >
                <Text className="text-2xl mt-0.5">{icon}</Text>
                <View className="flex-1">
                  {item.title && (
                    <Text className="font-semibold text-gray-900 text-sm">{item.title}</Text>
                  )}
                  <Text className={`text-sm mt-0.5 ${item.is_read ? 'text-gray-400' : 'text-gray-700'}`}>
                    {item.body}
                  </Text>
                  <Text className="text-gray-400 text-xs mt-1.5">{fmtDate(item.created_at)}</Text>
                </View>
                {!item.is_read && (
                  <View className="w-2 h-2 bg-sky-500 rounded-full mt-1.5" />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
