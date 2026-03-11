/// <reference types="nativewind/types" />
import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { shopApi, appointmentApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const API_WS_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://10.0.2.2:3000';

interface QueueItem {
  id: string;
  token_number: number;
  patient?: { full_name?: string; phone?: string };
  status: string;
}

export default function ShopQueueScreen() {
  const { accessToken } = useAuthStore();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const { data: shop } = useQuery({
    queryKey: ['my-shop'],
    queryFn: () => shopApi.getMyShop().then((r) => r.data.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['shop-dashboard'],
    queryFn: () => shopApi.getDashboard().then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  // Bootstrap queue from API so the list is populated before any socket events arrive
  const { data: initialAppts } = useQuery<QueueItem[]>({
    queryKey: ['shop-today-queue'],
    queryFn: () =>
      shopApi.getTodayAppointments().then((r) =>
        (r.data.data as QueueItem[]).filter((a) =>
          ['booked', 'confirmed', 'arrived', 'in_consultation'].includes(a.status)
        )
      ),
    enabled: !!shop?.id,
    staleTime: 30_000,
  });

  // Sync initial API data into queue state once loaded
  useEffect(() => {
    if (initialAppts) {
      setQueue(initialAppts);
    }
  }, [initialAppts]);

  useEffect(() => {
    if (!accessToken || !shop?.id) return;

    const socket = io(API_WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_shop', { shop_id: shop.id });
    });

    socket.on('appointment:new', (data: QueueItem) => {
      setQueue((prev) => {
        // Avoid duplicate if already in queue from API bootstrap
        if (prev.some((q) => q.id === data.id)) return prev;
        return [...prev, data];
      });
    });

    socket.on('appointment:status_updated', (data: { id: string; status: string }) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === data.id ? { ...item, status: data.status } : item))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, shop?.id]);

  const handleMarkDone = async (id: string) => {
    try {
      await appointmentApi.updateStatus(id, 'completed');
    } catch {
      // handled via socket event
    }
  };

  const waiting = queue.filter((q) => ['booked', 'confirmed', 'arrived', 'in_consultation'].includes(q.status));

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-violet-600 px-6 pt-4 pb-6">
        <Text className="text-white text-2xl font-bold">Live Queue</Text>
        <Text className="text-violet-200 mt-1">{shop?.shop_name ?? 'Your Shop'}</Text>

        {/* Stats row */}
        <View className="flex-row mt-4 gap-3">
          {[
            { label: 'Waiting', value: waiting.length, bg: 'bg-violet-500' },
            { label: 'Revenue Today', value: `₹${dashboard?.today_revenue ?? 0}`, bg: 'bg-violet-500' },
          ].map(({ label, value, bg }) => (
            <View key={label} className={`${bg} rounded-xl px-4 py-2 flex-1`}>
              <Text className="text-white text-xl font-bold">{value}</Text>
              <Text className="text-violet-200 text-xs">{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Queue */}
      <FlatList
        data={waiting}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View className="items-center mt-12">
            <Text className="text-5xl mb-4">✅</Text>
            <Text className="text-gray-400 text-base">Queue is empty</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center gap-4">
            <View className="w-12 h-12 bg-violet-100 rounded-full items-center justify-center">
              <Text className="text-violet-700 font-bold text-lg">#{item.token_number}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">
                {item.patient?.full_name ?? item.patient?.phone ?? 'Patient'}
              </Text>
              <Text className={`text-xs mt-1 capitalize ${item.status === 'in_consultation' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {item.status.replace('_', ' ')}
              </Text>
            </View>
            <TouchableOpacity
              className="bg-emerald-500 px-3 py-2 rounded-lg"
              onPress={() => handleMarkDone(item.id)}
            >
              <Text className="text-white text-xs font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
