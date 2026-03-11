import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chamberApi, shopApi } from '../../api/client';

interface ScheduleDay { day_of_week: number; start_time: string; end_time: string; slot_duration: number; max_patients: number; }
interface Chamber { id: string; consultation_fee: number; status: string; shop: { id: string; shop_name: string; address_line: string; city: string; pin_code: string; }; schedules: ScheduleDay[]; }
interface ShopResult { id: string; shop_name: string; address_line: string; city: string; pin_code: string; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ChamberScreen() {
  const qc = useQueryClient();
  const [showSchedule, setShowSchedule] = useState<Chamber | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleDay[]>([]);

  // Link-to-shop state
  const [showLink, setShowLink] = useState(false);
  const [shopQuery, setShopQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState<ShopResult | null>(null);
  const [fee, setFee] = useState('');

  const { data: chambers = [], isLoading } = useQuery<Chamber[]>({
    queryKey: ['my-chambers'],
    queryFn: () => chamberApi.getMyChambers().then((r) => r.data.data),
  });

  const { data: shopResults = [], isLoading: shopSearching } = useQuery<ShopResult[]>({
    queryKey: ['shop-search', shopQuery],
    queryFn: () => shopApi.search({ q: shopQuery }).then((r) => r.data.data),
    enabled: shopQuery.length >= 2,
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ chamberId, schedule }: { chamberId: string; schedule: ScheduleDay[] }) =>
      chamberApi.setSchedule(chamberId, schedule),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-chambers'] }); setShowSchedule(null); },
    onError: () => Alert.alert('Error', 'Could not save schedule.'),
  });

  const linkMutation = useMutation({
    mutationFn: (data: { shop_id: string; consultation_fee: number }) => chamberApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-chambers'] });
      setShowLink(false);
      setShopQuery('');
      setSelectedShop(null);
      setFee('');
      Alert.alert('Request Sent', 'Your chamber link request has been sent to the shop for approval.');
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.error?.message ?? 'Could not send link request.'),
  });

  const openSchedule = (chamber: Chamber) => {
    setScheduleForm(chamber.schedules?.length > 0
      ? chamber.schedules
      : [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, start_time: '10:00', end_time: '14:00', slot_duration: 15, max_patients: 20 }))
    );
    setShowSchedule(chamber);
  };

  const toggleDay = (day: number) => {
    const exists = scheduleForm.find((s) => s.day_of_week === day);
    if (exists) {
      setScheduleForm((p) => p.filter((s) => s.day_of_week !== day));
    } else {
      setScheduleForm((p) => [...p, { day_of_week: day, start_time: '10:00', end_time: '14:00', slot_duration: 15, max_patients: 20 }]);
    }
  };

  if (isLoading) return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#10B981" /></View>;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
        <View>
          <Text className="text-xl font-bold text-gray-900">My Chambers</Text>
          <Text className="text-gray-400 text-xs mt-0.5">Clinics where you see patients</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowLink(true)}
          className="bg-emerald-500 px-3 py-2 rounded-xl"
        >
          <Text className="text-white text-xs font-semibold">+ Link Shop</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={chambers}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text className="text-5xl mb-4">🏥</Text>
            <Text className="text-gray-400 text-center text-base font-medium mb-2">No chambers yet</Text>
            <Text className="text-gray-400 text-sm text-center px-8">Link a medical shop to start seeing patients there.</Text>
            <TouchableOpacity
              onPress={() => setShowLink(true)}
              className="mt-4 bg-emerald-500 px-6 py-2.5 rounded-xl"
            >
              <Text className="text-white text-sm font-semibold">Link to a Shop</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Status banner */}
            <View className={`px-4 py-2 ${item.status === 'active' ? 'bg-emerald-50' : item.status === 'pending' ? 'bg-amber-50' : 'bg-red-50'}`}>
              <Text className={`text-xs font-semibold capitalize ${item.status === 'active' ? 'text-emerald-700' : item.status === 'pending' ? 'text-amber-700' : 'text-red-600'}`}>
                {item.status === 'active' ? '✅ Active' : item.status === 'pending' ? '⏳ Verification Pending' : '❌ Rejected'}
              </Text>
            </View>

            <View className="p-4">
              <Text className="font-semibold text-gray-900 text-base">{item.shop.shop_name}</Text>
              <Text className="text-gray-500 text-sm mt-0.5">📍 {item.shop.address_line}, {item.shop.city} - {item.shop.pin_code}</Text>
              <Text className="text-emerald-600 text-sm mt-1 font-medium">Fee: ₹{item.consultation_fee}</Text>

              {/* Schedule summary */}
              {item.schedules?.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mt-3">
                  {item.schedules.map((s) => (
                    <View key={s.day_of_week} className="bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                      <Text className="text-emerald-700 text-xs font-medium">{DAYS[s.day_of_week]} {s.start_time}–{s.end_time}</Text>
                    </View>
                  ))}
                </View>
              )}

              {item.status === 'active' && (
                <TouchableOpacity
                  onPress={() => openSchedule(item)}
                  className="mt-3 bg-emerald-50 border border-emerald-200 h-9 rounded-xl items-center justify-center"
                >
                  <Text className="text-emerald-700 text-sm font-medium">Edit Schedule</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Link-to-Shop Modal */}
      <Modal visible={showLink} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-5 pt-4 pb-3 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-lg font-bold text-gray-900">Link to a Shop</Text>
            <TouchableOpacity onPress={() => { setShowLink(false); setShopQuery(''); setSelectedShop(null); setFee(''); }}>
              <Text className="text-gray-400 text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm text-gray-500 mb-3">Search for a medical shop to link to:</Text>

            <TextInput
              className="border border-gray-200 rounded-xl px-4 h-11 text-sm text-gray-900 mb-2"
              placeholder="Shop name or city…"
              placeholderTextColor="#9CA3AF"
              value={shopQuery}
              onChangeText={(v) => { setShopQuery(v); setSelectedShop(null); }}
            />

            {shopSearching && <ActivityIndicator color="#10B981" className="mt-2" />}

            {!selectedShop && shopResults.length > 0 && (
              <View className="border border-gray-200 rounded-xl overflow-hidden mb-3">
                {shopResults.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => { setSelectedShop(s); setShopQuery(s.shop_name); }}
                    className="px-4 py-3 border-b border-gray-100 last:border-0"
                  >
                    <Text className="font-medium text-gray-900">{s.shop_name}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">📍 {s.address_line}, {s.city} - {s.pin_code}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedShop && (
              <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                <Text className="font-semibold text-emerald-900">✅ {selectedShop.shop_name}</Text>
                <Text className="text-emerald-700 text-xs mt-0.5">📍 {selectedShop.address_line}, {selectedShop.city}</Text>
              </View>
            )}

            <Text className="text-sm font-medium text-gray-700 mb-1">Consultation Fee (₹)</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 h-11 text-sm text-gray-900 mb-6"
              placeholder="e.g. 300"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={fee}
              onChangeText={setFee}
            />
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100">
            <TouchableOpacity
              className={`h-14 rounded-xl items-center justify-center ${selectedShop && fee ? 'bg-emerald-500' : 'bg-gray-200'}`}
              disabled={!selectedShop || !fee || linkMutation.isPending}
              onPress={() => linkMutation.mutate({ shop_id: selectedShop!.id, consultation_fee: Number(fee) })}
            >
              {linkMutation.isPending
                ? <ActivityIndicator color="white" />
                : <Text className={`font-semibold text-base ${selectedShop && fee ? 'text-white' : 'text-gray-400'}`}>Send Link Request</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Schedule Modal */}
      <Modal visible={!!showSchedule} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-5 pt-4 pb-3 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-lg font-bold text-gray-900">Edit Schedule</Text>
            <TouchableOpacity onPress={() => setShowSchedule(null)}>
              <Text className="text-gray-400 text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-5 pt-4">
            <Text className="text-sm text-gray-500 mb-3">Select working days:</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {DAYS.map((day, idx) => {
                const active = !!scheduleForm.find((s) => s.day_of_week === idx);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => toggleDay(idx)}
                    className={`w-12 h-12 rounded-full items-center justify-center ${active ? 'bg-emerald-500' : 'bg-gray-100'}`}
                  >
                    <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-500'}`}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {scheduleForm.sort((a, b) => a.day_of_week - b.day_of_week).map((s) => (
              <View key={s.day_of_week} className="bg-gray-50 rounded-xl p-3 mb-3">
                <Text className="font-medium text-gray-900 mb-2">{DAYS[s.day_of_week]}</Text>
                <View className="flex-row gap-2">
                  {[
                    { key: 'start_time', label: 'From' },
                    { key: 'end_time', label: 'To' },
                  ].map(({ key, label }) => (
                    <View key={key} className="flex-1">
                      <Text className="text-xs text-gray-400 mb-1">{label}</Text>
                      <TextInput
                        className="bg-white border border-gray-200 rounded-lg px-2 h-9 text-sm text-gray-900"
                        value={(s as any)[key]}
                        onChangeText={(v) => {
                          setScheduleForm((p) => p.map((item) =>
                            item.day_of_week === s.day_of_week ? { ...item, [key]: v } : item
                          ));
                        }}
                      />
                    </View>
                  ))}
                  <View className="w-16">
                    <Text className="text-xs text-gray-400 mb-1">Slot (min)</Text>
                    <TextInput
                      className="bg-white border border-gray-200 rounded-lg px-2 h-9 text-sm text-gray-900"
                      keyboardType="number-pad"
                      value={String(s.slot_duration)}
                      onChangeText={(v) => {
                        setScheduleForm((p) => p.map((item) =>
                          item.day_of_week === s.day_of_week ? { ...item, slot_duration: Number(v) || 15 } : item
                        ));
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100">
            <TouchableOpacity
              className="bg-emerald-500 h-14 rounded-xl items-center justify-center"
              onPress={() => scheduleMutation.mutate({ chamberId: showSchedule!.id, schedule: scheduleForm })}
              disabled={scheduleMutation.isPending}
            >
              {scheduleMutation.isPending
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-semibold text-base">Save Schedule</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
