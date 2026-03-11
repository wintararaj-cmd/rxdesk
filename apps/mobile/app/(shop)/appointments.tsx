import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopApi, appointmentApi, chamberApi } from '../../api/client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Chamber {
  id: string;
  consultation_fee: number;
  doctor: { full_name: string; specialization: string } | null;
}

interface Slot {
  start: string;
  end: string;
  status: 'available' | 'booked' | 'blocked';
}

interface Appointment {
  id: string;
  token_number: number;
  slot_start_time: string;
  status: string;
  chief_complaint?: string;
  patient?: { full_name?: string; age?: number; gender?: string; blood_group?: string };
  chamber?: { doctor?: { full_name: string; specialization: string } };
}

const STATUS_BG: Record<string, string> = {
  booked:          'bg-amber-100',
  confirmed:       'bg-sky-100',
  arrived:         'bg-orange-100',
  in_consultation: 'bg-blue-100',
  completed:       'bg-emerald-100',
  cancelled:       'bg-red-100',
  no_show:         'bg-gray-100',
};
const STATUS_TEXT: Record<string, string> = {
  booked:          'text-amber-700',
  confirmed:       'text-sky-700',
  arrived:         'text-orange-700',
  in_consultation: 'text-blue-700',
  completed:       'text-emerald-700',
  cancelled:       'text-red-600',
  no_show:         'text-gray-500',
};

export default function ShopAppointmentsScreen() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'waiting' | 'completed'>('all');

  // ── Walk-in booking state ──────────────────────────────
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [wiPhone, setWiPhone] = useState('');
  const [wiName, setWiName] = useState('');
  const [wiChamberId, setWiChamberId] = useState('');
  const [wiDate, setWiDate] = useState('');
  const [wiSlot, setWiSlot] = useState<Slot | null>(null);
  const [wiComplaint, setWiComplaint] = useState('');

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });

  const { data: activeChambers = [] } = useQuery<Chamber[]>({
    queryKey: ['shop-active-chambers'],
    queryFn: () => chamberApi.getShopChambers('active').then((r) => r.data.data),
    enabled: showWalkIn,
  });

  const { data: wiSlots = [], isLoading: slotsLoading } = useQuery<Slot[]>({
    queryKey: ['wi-slots', wiChamberId, wiDate],
    queryFn: () => chamberApi.getAvailableSlots(wiChamberId, wiDate).then((r) => r.data.data.slots ?? r.data.data),
    enabled: !!(wiChamberId && wiDate),
  });

  const walkInMutation = useMutation({
    mutationFn: (data: object) => appointmentApi.bookWalkIn(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-appointments'] });
      setShowWalkIn(false);
      setWiPhone(''); setWiName(''); setWiChamberId(''); setWiDate(''); setWiSlot(null); setWiComplaint('');
      Alert.alert('✅ Booked', 'Walk-in appointment has been booked successfully.');
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.error?.message ?? 'Could not book appointment.'),
  });

  const { data: shop } = useQuery({
    queryKey: ['my-shop'],
    queryFn: () => shopApi.getMyShop().then((r) => r.data.data),
  });

  const { data: appointments = [], isLoading, refetch, isRefetching } = useQuery<Appointment[]>({
    queryKey: ['shop-appointments'],
    queryFn: () => shopApi.getTodayAppointments().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => appointmentApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-appointments'] }),
  });

  const filtered = filter === 'all' ? appointments
    : filter === 'waiting' ? appointments.filter((a) => ['booked', 'confirmed', 'arrived', 'in_consultation'].includes(a.status))
    : appointments.filter((a) => a.status === 'completed');

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
        <Text className="text-xl font-bold text-gray-900">Today's Appointments</Text>
        <TouchableOpacity
          onPress={() => setShowWalkIn(true)}
          className="bg-violet-600 px-3 py-1.5 rounded-xl"
        >
          <Text className="text-white text-xs font-semibold">+ Walk-in</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View className="flex-row px-4 pt-3 gap-2">
        {(['all', 'waiting', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full ${filter === f ? 'bg-violet-600' : 'bg-white border border-gray-200'}`}
          >
            <Text className={`text-sm font-medium capitalize ${filter === f ? 'text-white' : 'text-gray-600'}`}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#8B5CF6" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">📅</Text>
              <Text className="text-gray-400 text-base">No {filter === 'all' ? '' : filter} appointments</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <View className="flex-row items-start gap-3">
                <View className="w-10 h-10 bg-violet-100 rounded-full items-center justify-center flex-shrink-0">
                  <Text className="text-violet-700 font-bold text-sm">#{item.token_number}</Text>
                </View>

                <View className="flex-1">
                  <View className="flex-row justify-between">
                    <Text className="font-semibold text-gray-900 text-sm">
                      {item.patient?.full_name ?? item.patient?.phone ?? 'Patient'}
                    </Text>
                    <View className={`${STATUS_BG[item.status] ?? 'bg-gray-100'} px-2 py-0.5 rounded-full`}>
                      <Text className={`${STATUS_TEXT[item.status] ?? 'text-gray-600'} text-xs font-medium capitalize`}>
                        {item.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>

                  {item.chamber?.doctor && (
                    <Text className="text-gray-500 text-xs mt-0.5">Dr. {item.chamber.doctor.full_name} · {item.chamber.doctor.specialization}</Text>
                  )}
                  <Text className="text-gray-400 text-xs mt-0.5">{item.slot_start_time}</Text>
                  {item.chief_complaint && (
                    <Text className="text-gray-400 text-xs mt-1">{item.chief_complaint}</Text>
                  )}
                </View>
              </View>

              {['booked', 'confirmed', 'arrived'].includes(item.status) && (
                <View className="flex-row gap-2 mt-3 pt-3 border-t border-gray-50">
                  <TouchableOpacity
                    onPress={() => updateMutation.mutate({ id: item.id, status: 'in_consultation' })}
                    className="flex-1 bg-blue-50 border border-blue-200 py-2 rounded-lg items-center"
                  >
                    <Text className="text-blue-600 text-xs font-semibold">Call Patient</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateMutation.mutate({ id: item.id, status: 'cancelled' })}
                    className="flex-1 bg-red-50 border border-red-200 py-2 rounded-lg items-center"
                  >
                    <Text className="text-red-500 text-xs font-semibold">Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* ── Walk-in Booking Modal ─────────────────────── */}
      <Modal visible={showWalkIn} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-5 pt-4 pb-3 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-lg font-bold text-gray-900">Book Walk-in</Text>
            <TouchableOpacity onPress={() => setShowWalkIn(false)}>
              <Text className="text-gray-400 text-base">Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
            {/* Patient phone */}
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Patient Phone *</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 h-11 text-gray-900 text-sm mb-4"
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              value={wiPhone}
              onChangeText={setWiPhone}
            />

            {/* Patient name */}
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Patient Name (optional)</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 h-11 text-gray-900 text-sm mb-4"
              placeholder="Leave blank for 'Walk-in Patient'"
              placeholderTextColor="#9CA3AF"
              value={wiName}
              onChangeText={setWiName}
            />

            {/* Doctor/Chamber */}
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">Select Doctor *</Text>
            {activeChambers.length === 0 ? (
              <Text className="text-gray-400 text-sm mb-4">No active chambers</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2 mb-4">
                {activeChambers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => { setWiChamberId(c.id); setWiSlot(null); }}
                    className={`px-4 py-2 rounded-xl border ${wiChamberId === c.id ? 'bg-violet-600 border-violet-600' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`text-sm font-medium ${wiChamberId === c.id ? 'text-white' : 'text-gray-700'}`}>
                      Dr. {c.doctor?.full_name ?? 'Unknown'}
                    </Text>
                    <Text className={`text-xs ${wiChamberId === c.id ? 'text-violet-200' : 'text-gray-400'}`}>
                      {c.doctor?.specialization}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Date */}
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">Select Date *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {next7Days.map((d) => {
                  const iso = d.toISOString().split('T')[0];
                  const sel = wiDate === iso;
                  return (
                    <TouchableOpacity
                      key={iso}
                      onPress={() => { setWiDate(iso); setWiSlot(null); }}
                      className={`w-14 h-16 rounded-xl items-center justify-center border ${sel ? 'bg-violet-600 border-violet-600' : 'bg-white border-gray-200'}`}
                    >
                      <Text className={`text-xs ${sel ? 'text-white' : 'text-gray-500'}`}>{DAYS[d.getDay()]}</Text>
                      <Text className={`text-lg font-bold ${sel ? 'text-white' : 'text-gray-900'}`}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Slots */}
            {wiChamberId && wiDate && (
              <>
                <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">Select Slot *</Text>
                {slotsLoading ? (
                  <ActivityIndicator color="#8B5CF6" className="mb-4" />
                ) : wiSlots.filter((s) => s.status === 'available').length === 0 ? (
                  <Text className="text-gray-400 text-sm mb-4">No slots available for this date</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {wiSlots.filter((s) => s.status === 'available').map((s) => {
                      const sel = wiSlot?.start === s.start;
                      return (
                        <TouchableOpacity
                          key={s.start}
                          onPress={() => setWiSlot(s)}
                          className={`px-4 py-2 rounded-xl border ${sel ? 'bg-violet-600 border-violet-600' : 'bg-white border-gray-200'}`}
                        >
                          <Text className={`text-sm font-medium ${sel ? 'text-white' : 'text-gray-700'}`}>{s.start}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* Chief complaint */}
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Chief Complaint (optional)</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm mb-6 h-20"
              placeholder="Reason for visit…"
              placeholderTextColor="#9CA3AF"
              multiline
              value={wiComplaint}
              onChangeText={setWiComplaint}
            />
          </ScrollView>

          <View className="px-5 pb-5 pt-3 border-t border-gray-100">
            <TouchableOpacity
              className={`h-14 rounded-xl items-center justify-center ${(!wiPhone || !wiChamberId || !wiDate || !wiSlot || walkInMutation.isPending) ? 'bg-gray-200' : 'bg-violet-600'}`}
              disabled={!wiPhone || !wiChamberId || !wiDate || !wiSlot || walkInMutation.isPending}
              onPress={() => walkInMutation.mutate({
                chamber_id: wiChamberId,
                appointment_date: wiDate,
                slot_start_time: wiSlot!.start,
                patient_phone: wiPhone,
                patient_name: wiName || undefined,
                chief_complaint: wiComplaint || undefined,
              })}
            >
              {walkInMutation.isPending
                ? <ActivityIndicator color="white" />
                : <Text className={`font-semibold text-base ${(!wiPhone || !wiChamberId || !wiDate || !wiSlot) ? 'text-gray-400' : 'text-white'}`}>Book Appointment</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
