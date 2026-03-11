import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { chamberApi, appointmentApi } from '../../api/client';

interface Chamber { id: string; shop: { shop_name: string; city: string; pin_code: string }; }
interface Appointment {
  id: string;
  token_number: number;
  slot_start_time: string;
  appointment_date: string;
  status: string;
  chief_complaint?: string;
  patient?: { full_name?: string; phone?: string; age?: number; gender?: string };
  chamber?: { shop?: { shop_name?: string; city?: string } };
  prescription?: { id: string } | null;
}

interface HistoryResponse {
  data: Appointment[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const STATUS_COLORS: Record<string, string> = {
  booked:          'text-amber-600',
  confirmed:       'text-sky-600',
  arrived:         'text-orange-600',
  in_consultation: 'text-blue-600',
  completed:       'text-emerald-600',
  cancelled:       'text-red-500',
  no_show:         'text-gray-400',
};

const STATUS_BG: Record<string, string> = {
  completed:  'bg-emerald-50 border-emerald-100',
  cancelled:  'bg-red-50 border-red-100',
  no_show:    'bg-gray-50 border-gray-100',
};

const HISTORY_STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'No-Show', value: 'no_show' },
] as const;

export default function DoctorAppointmentsScreen() {
  const [tab, setTab] = useState<'today' | 'history'>('today');
  const [selectedChamber, setSelectedChamber] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState<string | undefined>(undefined);
  const [historyPage, setHistoryPage] = useState(1);
  const qc = useQueryClient();
  const router = useRouter();

  const { data: chambers = [], isLoading: loadingChambers } = useQuery<Chamber[]>({
    queryKey: ['my-chambers'],
    queryFn: () => chamberApi.getMyChambers().then((r) => r.data.data),
    onSuccess: (d: Chamber[]) => { if (d.length > 0 && !selectedChamber) setSelectedChamber(d[0].id); },
  } as any);

  /* ── Today Tab ─────────────────────────────────────────────────────────── */
  const { data: appointments = [], isLoading: loadingAppts, refetch, isRefetching } = useQuery<Appointment[]>({
    queryKey: ['doctor-today', selectedChamber],
    queryFn: () => appointmentApi.getTodayForDoctor(selectedChamber!).then((r) => r.data.data),
    enabled: !!selectedChamber && tab === 'today',
    refetchInterval: tab === 'today' ? 30_000 : false,
  });

  /* ── History Tab ───────────────────────────────────────────────────────── */
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory, isRefetching: isRefetchingHistory } =
    useQuery<HistoryResponse>({
      queryKey: ['doctor-history', selectedChamber, historyStatus, historyPage],
      queryFn: () =>
        appointmentApi
          .getDoctorHistory({
            chamber_id: selectedChamber ?? undefined,
            status: historyStatus,
            page: historyPage,
            limit: 20,
          })
          .then((r) => ({ data: r.data.data, pagination: r.data.pagination })),
      enabled: tab === 'history',
    });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => appointmentApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-today'] }),
  });

  if (loadingChambers) return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#10B981" /></View>;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Chamber selector */}
      {chambers.length > 1 && (
        <View className="px-4 pt-4 pb-2">
          <FlatList
            data={chambers}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedChamber(item.id)}
                className={`mr-2 px-4 py-2 rounded-full border ${selectedChamber === item.id ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-200'}`}
              >
                <Text className={`text-sm font-medium ${selectedChamber === item.id ? 'text-white' : 'text-gray-700'}`}>
                  {item.shop.shop_name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Tab bar */}
      <View className="flex-row px-4 pt-2 pb-0 bg-white border-b border-gray-100">
        {(['today', 'history'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`mr-6 pb-2 border-b-2 ${tab === t ? 'border-emerald-500' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-semibold capitalize ${tab === t ? 'text-emerald-600' : 'text-gray-400'}`}>
              {t === 'today' ? "Today's Patients" : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
        <View className="flex-1" />
        {tab === 'today' && (
          <Text className="text-gray-400 text-sm pb-2">{appointments.length} total</Text>
        )}
        {tab === 'history' && history && (
          <Text className="text-gray-400 text-sm pb-2">{history.pagination.total} total</Text>
        )}
      </View>

      {/* ── Today content ─────────────────────────────────────────────────── */}
      {tab === 'today' && (
        loadingAppts ? (
          <ActivityIndicator className="mt-12" color="#10B981" />
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            onRefresh={refetch}
            refreshing={isRefetching}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            ListEmptyComponent={
              <View className="items-center mt-16">
                <Text className="text-5xl mb-4">✅</Text>
                <Text className="text-gray-400 text-base">No appointments today</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 bg-emerald-100 rounded-full items-center justify-center">
                    <Text className="text-emerald-700 font-bold">#{item.token_number}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900 text-sm">
                      {item.patient?.full_name ?? item.patient?.phone ?? 'Patient'}
                    </Text>
                    <Text className={`text-xs mt-0.5 capitalize ${STATUS_COLORS[item.status] ?? 'text-gray-500'}`}>
                      {item.status.replace('_', ' ')} · {item.slot_start_time}
                    </Text>
                    {item.chief_complaint && (
                      <Text className="text-gray-400 text-xs mt-1">{item.chief_complaint}</Text>
                    )}
                  </View>
                  {/* Actions */}
                  <View className="gap-2">
                    {['booked', 'confirmed', 'arrived'].includes(item.status) && (
                      <TouchableOpacity
                        onPress={() => updateMutation.mutate({ id: item.id, status: 'in_consultation' })}
                        className="bg-blue-500 px-3 py-1.5 rounded-lg"
                      >
                        <Text className="text-white text-xs font-semibold">Call</Text>
                      </TouchableOpacity>
                    )}
                    {item.status === 'in_consultation' && (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(doctor)/prescribe', params: { appointmentId: item.id, patientName: item.patient?.full_name ?? item.patient?.phone } } as any)}
                        className="bg-emerald-500 px-3 py-1.5 rounded-lg"
                      >
                        <Text className="text-white text-xs font-semibold">Prescribe</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        )
      )}

      {/* ── History content ───────────────────────────────────────────────── */}
      {tab === 'history' && (
        <>
          {/* Status filter chips */}
          <View className="px-4 py-2 bg-white border-b border-gray-50">
            <FlatList
              data={HISTORY_STATUS_FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(f) => f.label}
              renderItem={({ item: f }) => (
                <TouchableOpacity
                  onPress={() => { setHistoryStatus(f.value); setHistoryPage(1); }}
                  className={`mr-2 px-3 py-1.5 rounded-full border text-xs ${historyStatus === f.value ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`text-xs font-medium ${historyStatus === f.value ? 'text-white' : 'text-gray-600'}`}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {loadingHistory ? (
            <ActivityIndicator className="mt-12" color="#10B981" />
          ) : (
            <FlatList
              data={history?.data ?? []}
              keyExtractor={(item) => item.id}
              onRefresh={refetchHistory}
              refreshing={isRefetchingHistory}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              ListEmptyComponent={
                <View className="items-center mt-16">
                  <Text className="text-5xl mb-4">📋</Text>
                  <Text className="text-gray-400 text-base">No appointment records found</Text>
                </View>
              }
              ListFooterComponent={
                history && history.pagination.pages > 1 ? (
                  <View className="flex-row justify-center gap-3 mt-4 pb-4">
                    <TouchableOpacity
                      disabled={historyPage <= 1}
                      onPress={() => setHistoryPage((p) => p - 1)}
                      className={`px-4 py-2 rounded-lg border ${historyPage <= 1 ? 'border-gray-200 bg-gray-50' : 'border-emerald-500 bg-emerald-50'}`}
                    >
                      <Text className={historyPage <= 1 ? 'text-gray-400 text-sm' : 'text-emerald-600 text-sm font-medium'}>
                        ← Prev
                      </Text>
                    </TouchableOpacity>
                    <View className="px-4 py-2 justify-center">
                      <Text className="text-gray-500 text-sm">
                        {historyPage} / {history.pagination.pages}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={historyPage >= history.pagination.pages}
                      onPress={() => setHistoryPage((p) => p + 1)}
                      className={`px-4 py-2 rounded-lg border ${historyPage >= history.pagination.pages ? 'border-gray-200 bg-gray-50' : 'border-emerald-500 bg-emerald-50'}`}
                    >
                      <Text className={historyPage >= history.pagination.pages ? 'text-gray-400 text-sm' : 'text-emerald-600 text-sm font-medium'}>
                        Next →
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const cardBg = STATUS_BG[item.status] ?? 'bg-white border-gray-100';
                const apptDate = new Date(item.appointment_date).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                });
                return (
                  <View className={`rounded-2xl p-4 shadow-sm border ${cardBg}`}>
                    <View className="flex-row items-start gap-3">
                      <View className="w-11 h-11 bg-gray-100 rounded-full items-center justify-center">
                        <Text className="text-gray-600 font-bold text-sm">#{item.token_number}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-gray-900 text-sm">
                          {item.patient?.full_name ?? 'Patient'}
                        </Text>
                        {item.patient?.age && (
                          <Text className="text-gray-400 text-xs mt-0.5">
                            {item.patient.age}y {item.patient.gender ? `· ${item.patient.gender}` : ''}
                          </Text>
                        )}
                        <Text className={`text-xs mt-1 capitalize font-medium ${STATUS_COLORS[item.status] ?? 'text-gray-500'}`}>
                          {item.status.replace(/_/g, ' ')}
                        </Text>
                        <Text className="text-gray-400 text-xs mt-0.5">
                          {apptDate} · {item.slot_start_time}
                          {item.chamber?.shop?.shop_name ? ` · ${item.chamber.shop.shop_name}` : ''}
                        </Text>
                        {item.chief_complaint && (
                          <Text className="text-gray-500 text-xs mt-1 italic">"{item.chief_complaint}"</Text>
                        )}
                      </View>
                      {item.prescription?.id && (
                        <View className="bg-emerald-100 px-2 py-1 rounded-lg">
                          <Text className="text-emerald-700 text-xs font-semibold">Rx</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
