import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { doctorApi, chamberApi, appointmentApi } from '../../../api/client';

interface Chamber {
  id: string;
  consultation_fee: number;
  status: string;
  shop: { id: string; shop_name: string; address_line: string; city: string; pin_code: string; contact_phone: string; };
}

interface Slot {
  start: string;
  end: string;
  token: number;
  status: 'available' | 'booked' | 'blocked';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DoctorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [selectedChamber, setSelectedChamber] = useState<Chamber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor', id],
    queryFn: () => doctorApi.getProfile(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery<Slot[]>({
    queryKey: ['slots', selectedChamber?.id, selectedDate],
    queryFn: () =>
      chamberApi.getAvailableSlots(selectedChamber!.id, selectedDate).then((r) => r.data.data.slots ?? r.data.data),
    enabled: !!(selectedChamber && selectedDate),
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      appointmentApi.book({
        chamber_id: selectedChamber!.id,
        appointment_date: selectedDate,
        slot_start_time: selectedSlot!.start,
        slot_end_time: selectedSlot!.end,
      }),
    onSuccess: () => {
      setShowBooking(false);
      Alert.alert('✅ Booked!', 'Your appointment has been booked successfully.', [
        { text: 'View Appointments', onPress: () => router.replace('/(patient)/appointments') },
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: any) =>
      Alert.alert('Booking Failed', err?.response?.data?.error?.message ?? 'Could not book appointment.'),
  });

  // Generate next 7 dates
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0EA5E9" />
      </View>
    );
  }

  if (!doctor) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-400">Doctor not found.</Text>
        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="text-sky-500 font-medium">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const chambers: Chamber[] = doctor.chambers ?? [];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-sky-500 px-5 pt-4 pb-6 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-white text-xl">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">{doctor.full_name}</Text>
          <Text className="text-sky-100 text-sm">{doctor.specialization}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Doctor info card */}
        <View className="mx-4 -mt-3 bg-white rounded-2xl p-4 shadow-sm">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              {doctor.qualifications?.length > 0 && (
                <Text className="text-gray-500 text-sm">{doctor.qualifications.join(', ')}</Text>
              )}
              <Text className="text-gray-600 text-sm mt-1">{doctor.experience_years ?? 0} yrs experience</Text>
              {doctor.languages?.length > 0 && (
                <Text className="text-gray-400 text-xs mt-1">Speaks: {doctor.languages.join(', ')}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Chambers/Clinics */}
        <View className="mx-4 mt-4">
          <Text className="text-base font-semibold text-gray-900 mb-2">Available At</Text>
          {chambers.length === 0 ? (
            <View className="bg-white rounded-2xl p-5 items-center">
              <Text className="text-gray-400 text-sm">No active chambers available</Text>
            </View>
          ) : (
            chambers.map((chamber) => (
              <TouchableOpacity
                key={chamber.id}
                onPress={() => { setSelectedChamber(chamber); setShowBooking(true); }}
                className={`bg-white rounded-2xl p-4 mb-3 border-2 shadow-sm ${selectedChamber?.id === chamber.id ? 'border-sky-400' : 'border-transparent'}`}
              >
                <Text className="font-semibold text-gray-900">{chamber.shop.shop_name}</Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                  📍 {chamber.shop.address_line}, {chamber.shop.city} - {chamber.shop.pin_code}
                </Text>
                <Text className="text-gray-400 text-xs mt-0.5">📞 {chamber.shop.contact_phone}</Text>
                <View className="flex-row justify-between items-center mt-2">
                  <Text className="text-emerald-600 font-semibold">₹{chamber.consultation_fee}</Text>
                  <View className="bg-sky-50 px-3 py-1 rounded-full">
                    <Text className="text-sky-600 text-xs font-medium">Book Slot →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={showBooking} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-5 pt-4 pb-3 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-lg font-bold text-gray-900">Book Appointment</Text>
            <TouchableOpacity onPress={() => { setShowBooking(false); setSelectedSlot(null); setSelectedDate(''); }}>
              <Text className="text-gray-400">Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-5 pt-4">
            {selectedChamber && (
              <View className="bg-sky-50 rounded-xl p-3 mb-4">
                <Text className="font-medium text-sky-900">{selectedChamber.shop.shop_name}</Text>
                <Text className="text-sky-700 text-sm">Fee: ₹{selectedChamber.consultation_fee}</Text>
              </View>
            )}

            {/* Date picker */}
            <Text className="text-sm font-medium text-gray-700 mb-2">Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {next7Days.map((d) => {
                  const iso = d.toISOString().split('T')[0];
                  const isSelected = selectedDate === iso;
                  return (
                    <TouchableOpacity
                      key={iso}
                      onPress={() => { setSelectedDate(iso); setSelectedSlot(null); }}
                      className={`w-14 h-16 rounded-xl items-center justify-center border ${isSelected ? 'bg-sky-500 border-sky-500' : 'bg-white border-gray-200'}`}
                    >
                      <Text className={`text-xs ${isSelected ? 'text-white' : 'text-gray-500'}`}>{DAYS[d.getDay()]}</Text>
                      <Text className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Slots */}
            {selectedDate && (
              <>
                <Text className="text-sm font-medium text-gray-700 mb-2">Available Slots</Text>
                {slotsLoading ? (
                  <ActivityIndicator color="#0EA5E9" className="mt-4" />
                ) : slots.length === 0 ? (
                  <Text className="text-gray-400 text-sm text-center mt-4">No slots available for this date</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {slots.filter((s) => s.status === 'available').map((slot) => {
                      const isSelected = selectedSlot?.start === slot.start;
                      return (
                        <TouchableOpacity
                          key={slot.start}
                          onPress={() => setSelectedSlot(slot)}
                          className={`px-4 py-2 rounded-xl border ${isSelected ? 'bg-sky-500 border-sky-500' : 'bg-white border-gray-200'}`}
                        >
                          <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                            {slot.start}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100">
            <TouchableOpacity
              className={`h-14 rounded-xl items-center justify-center ${selectedSlot ? 'bg-sky-500' : 'bg-gray-200'}`}
              disabled={!selectedSlot || bookMutation.isPending}
              onPress={() => bookMutation.mutate()}
            >
              {bookMutation.isPending
                ? <ActivityIndicator color="white" />
                : <Text className={`font-semibold text-base ${selectedSlot ? 'text-white' : 'text-gray-400'}`}>
                    Confirm Booking
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
