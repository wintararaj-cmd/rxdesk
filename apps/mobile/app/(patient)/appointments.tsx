import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { patientApi, appointmentApi } from '../../api/client';

interface Appointment {
  id: string;
  token_number: number;
  appointment_date: string;
  slot_start_time: string;
  status: string;
  chief_complaint?: string;
  chamber?: {
    doctor?: { full_name: string; specialization: string };
    shop?: { shop_name: string; city: string };
  };
  prescription?: { id: string } | null;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  booked:          { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Booked' },
  confirmed:       { bg: 'bg-sky-100',    text: 'text-sky-700',    label: 'Confirmed' },
  arrived:         { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Arrived' },
  in_consultation: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'In Consultation' },
  completed:       { bg: 'bg-emerald-100',text: 'text-emerald-700',label: 'Completed' },
  cancelled:       { bg: 'bg-red-100',    text: 'text-red-500',    label: 'Cancelled' },
  no_show:         { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'No Show' },
};

export default function PatientAppointmentsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: appointments = [], isLoading, refetch, isRefetching } = useQuery<Appointment[]>({
    queryKey: ['patient-appointments'],
    queryFn: () => patientApi.getAppointments({ limit: 50 }).then((r) => r.data.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => appointmentApi.updateStatus(id, 'cancelled'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-appointments'] }),
    onError: () => Alert.alert('Error', 'Could not cancel appointment.'),
  });

  const confirmCancel = (id: string) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel Appointment', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">My Appointments</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#0EA5E9" />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">📅</Text>
              <Text className="text-gray-400 text-base font-medium">No appointments yet</Text>
              <TouchableOpacity
                className="mt-5 bg-sky-500 px-6 py-2.5 rounded-full"
                onPress={() => router.push('/(patient)/search')}
              >
                <Text className="text-white font-semibold">Book Now</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const s = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.booked;
            const canCancel = ['booked', 'confirmed', 'arrived'].includes(item.status);
            return (
              <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">
                      {item.chamber?.doctor?.full_name ?? 'Doctor'}
                    </Text>
                    {item.chamber?.doctor?.specialization && (
                      <Text className="text-sky-600 text-xs mt-0.5">{item.chamber.doctor.specialization}</Text>
                    )}
                  </View>
                  <View className={`${s.bg} px-2.5 py-1 rounded-full`}>
                    <Text className={`${s.text} text-xs font-medium`}>{s.label}</Text>
                  </View>
                </View>

                {item.chamber?.shop && (
                  <Text className="text-gray-400 text-xs mb-1">
                    📍 {item.chamber.shop.shop_name}, {item.chamber.shop.city}
                  </Text>
                )}
                <Text className="text-gray-500 text-xs">
                  🗓 {new Date(item.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {'  '}🕐 {item.slot_start_time}
                  {'  '}Token #{item.token_number}
                </Text>
                {item.chief_complaint && (
                  <Text className="text-gray-400 text-xs mt-1.5">{item.chief_complaint}</Text>
                )}
                {canCancel && (
                  <TouchableOpacity
                    onPress={() => confirmCancel(item.id)}
                    disabled={cancelMutation.isPending}
                    className="mt-3 border border-red-200 rounded-xl py-2 items-center"
                  >
                    <Text className="text-red-500 text-xs font-semibold">Cancel Appointment</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
