/// <reference types="nativewind/types" />
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { patientApi } from '../../api/client';

const QUICK_ACTIONS = [
  { label: 'Find Doctor', icon: '🔍', route: '/(patient)/search' },
  { label: 'My Appointments', icon: '📅', route: '/(patient)/appointments' },
  { label: 'Prescriptions', icon: '📋', route: '/(patient)/prescriptions' },
  { label: 'Nearby Shops', icon: '💊', route: '/(patient)/search?tab=shops' },
] as const;

interface PatientProfile { id: string; full_name?: string; }

const HEALTH_TIPS = [
  { icon: '💧', title: 'Stay Hydrated', tip: 'Drink at least 8 glasses of water daily to maintain good health.' },
  { icon: '🥗', title: 'Eat Balanced Meals', tip: 'Include fruits, vegetables, and whole grains in every meal.' },
  { icon: '🚶', title: 'Daily Exercise', tip: '30 minutes of walking each day can significantly improve your health.' },
  { icon: '😴', title: 'Sleep Well', tip: 'Aim for 7–9 hours of quality sleep every night for optimal recovery.' },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  booked:          { label: 'Upcoming', color: 'text-sky-600' },
  confirmed:       { label: 'Confirmed', color: 'text-emerald-600' },
  arrived:         { label: 'Arrived', color: 'text-amber-600' },
  in_consultation: { label: 'In Consultation', color: 'text-blue-600' },
};

interface Appointment {
  id: string;
  appointment_date: string;
  slot_start_time: string;
  status: string;
  chamber?: {
    doctor?: { full_name: string; specialization: string };
    shop?: { shop_name: string; city: string };
  };
}

export default function PatientHomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  const { data: profile } = useQuery<PatientProfile>({
    queryKey: ['patient-profile'],
    queryFn: () => patientApi.getProfile().then((r) => r.data.data),
    staleTime: 300_000,
  });

  const { data: allAppointments, isLoading: apptLoading } = useQuery<Appointment[]>({
    queryKey: ['patient-upcoming-appointments'],
    queryFn: () => patientApi.getAppointments({ limit: 20 }).then((r) => r.data.data),
    staleTime: 60_000,
  });

  const upcoming = (allAppointments ?? [])
    .filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status) &&
      a.appointment_date.slice(0, 10) >= today)
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
    .slice(0, 3);

  const dailyTip = HEALTH_TIPS[new Date().getDay() % HEALTH_TIPS.length];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-sky-500 px-6 pt-4 pb-8">
          <Text className="text-white text-base">Welcome back,</Text>
          <Text className="text-white text-2xl font-bold">{profile?.full_name ?? 'Patient'} 👋</Text>
        </View>

        {/* Quick actions */}
        <View className="px-6 -mt-4">
          <View className="bg-white rounded-2xl shadow-sm p-4 flex-row flex-wrap gap-y-4">
            {QUICK_ACTIONS.map(({ label, icon, route }) => (
              <TouchableOpacity
                key={label}
                className="w-1/2 items-center py-3"
                onPress={() => router.push(route as any)}
              >
                <View className="w-14 h-14 bg-sky-50 rounded-2xl items-center justify-center mb-2">
                  <Text className="text-2xl">{icon}</Text>
                </View>
                <Text className="text-gray-700 text-sm font-medium text-center">{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming Appointments */}
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-gray-900">Upcoming Appointments</Text>
            {upcoming.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(patient)/appointments')}>
                <Text className="text-sky-500 text-sm font-medium">See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {apptLoading ? (
            <ActivityIndicator color="#0EA5E9" className="mt-4" />
          ) : upcoming.length === 0 ? (
            <View className="bg-white rounded-2xl p-5 items-center justify-center">
              <Text className="text-4xl mb-3">📅</Text>
              <Text className="text-gray-400 text-sm">No upcoming appointments</Text>
              <TouchableOpacity
                className="mt-4 bg-sky-500 px-6 py-2 rounded-full"
                onPress={() => router.push('/(patient)/search')}
              >
                <Text className="text-white font-semibold">Book Now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-3">
              {upcoming.map((appt) => (
                <View key={appt.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900 text-sm">
                        {appt.chamber?.doctor ? `Dr. ${appt.chamber.doctor.full_name}` : 'Doctor'}
                      </Text>
                      {appt.chamber?.doctor?.specialization && (
                        <Text className="text-sky-600 text-xs mt-0.5">{appt.chamber.doctor.specialization}</Text>
                      )}
                      {appt.chamber?.shop && (
                        <Text className="text-gray-400 text-xs mt-1">📍 {appt.chamber.shop.shop_name}, {appt.chamber.shop.city}</Text>
                      )}
                    </View>
                    <View className="items-end">
                      <Text className="text-gray-700 text-xs font-medium">
                        {new Date(appt.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                      <Text className="text-gray-500 text-xs mt-0.5">{appt.slot_start_time}</Text>
                      <Text className={`text-xs font-medium mt-1 ${STATUS_LABEL[appt.status]?.color ?? 'text-gray-500'}`}>
                        {STATUS_LABEL[appt.status]?.label ?? appt.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Daily Health Tip */}
        <View className="px-6 mt-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Health Tip of the Day</Text>
          <View className="bg-sky-500 rounded-2xl p-5">
            <Text className="text-white font-semibold text-base">{dailyTip.icon} {dailyTip.title}</Text>
            <Text className="text-sky-100 text-sm mt-1">{dailyTip.tip}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
