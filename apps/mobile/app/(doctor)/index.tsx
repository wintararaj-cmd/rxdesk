import { useQuery } from '@tanstack/react-query';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doctorApi } from '../../api/client';

interface Stats {
  today: number;
  this_week: number;
  this_month: number;
  total: number;
}

interface DoctorProfile {
  full_name?: string;
}

export default function DoctorDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['doctor-stats'],
    queryFn: () => doctorApi.getStats().then((r) => r.data.data as Stats),
  });
  const { data: profile } = useQuery<DoctorProfile>({
    queryKey: ['doctor-profile'],
    queryFn: () => doctorApi.getProfile('me').then((r) => r.data.data),
    staleTime: 300_000,
  });
  const router = useRouter();

  const statCards = [
    { label: "Today's Patients", value: data?.today ?? 0, icon: '👤', color: 'bg-sky-50 border-sky-200' },
    { label: 'This Week', value: data?.this_week ?? 0, icon: '📅', color: 'bg-emerald-50 border-emerald-200' },
    { label: 'This Month', value: data?.this_month ?? 0, icon: '📊', color: 'bg-violet-50 border-violet-200' },
    { label: 'All Time', value: data?.total ?? 0, icon: '🏆', color: 'bg-amber-50 border-amber-200' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="bg-emerald-500 px-6 pt-4 pb-8">
          <Text className="text-white text-2xl font-bold">Doctor Dashboard</Text>
          <Text className="text-emerald-100 mt-1">Welcome, Dr. {profile?.full_name ?? '...'} 👋</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator className="mt-8" color="#10B981" />
        ) : (
          <View className="px-6 -mt-4">
            <View className="flex-row flex-wrap gap-3">
              {statCards.map(({ label, value, icon, color }) => (
                <View key={label} className={`flex-1 min-w-[45%] rounded-2xl border p-4 bg-white ${color}`}>
                  <Text className="text-2xl mb-2">{icon}</Text>
                  <Text className="text-2xl font-bold text-gray-900">{value}</Text>
                  <Text className="text-gray-500 text-xs mt-1">{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="px-6 mt-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</Text>
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => router.push('/(doctor)/appointments')}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex-row items-center"
            >
              <View className="w-10 h-10 bg-emerald-100 rounded-xl items-center justify-center mr-3">
                <Text className="text-xl">📋</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">Today's Appointments</Text>
                <Text className="text-gray-500 text-xs mt-0.5">View and manage your patient queue</Text>
              </View>
              <Text className="text-gray-400">›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(doctor)/prescribe')}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex-row items-center"
            >
              <View className="w-10 h-10 bg-sky-100 rounded-xl items-center justify-center mr-3">
                <Text className="text-xl">📝</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">Write Prescription</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Issue a new prescription for a patient</Text>
              </View>
              <Text className="text-gray-400">›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(doctor)/chambers')}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex-row items-center"
            >
              <View className="w-10 h-10 bg-violet-100 rounded-xl items-center justify-center mr-3">
                <Text className="text-xl">🏥</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">My Chambers</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Manage your clinic schedules</Text>
              </View>
              <Text className="text-gray-400">›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
