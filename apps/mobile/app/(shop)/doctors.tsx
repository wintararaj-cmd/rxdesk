import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chamberApi, doctorApi } from '../../api/client';

interface LinkedDoctor {
  id: string;
  status: string;
  consultation_fee: number;
  requested_by: string;
  created_at: string;
  doctor: {
    id: string;
    full_name: string;
    specialization?: string;
    experience_years?: number;
    profile_photo?: string;
  } | null;
  schedules: { day_of_week: number; start_time: string; end_time: string }[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pending: { bg: 'bg-amber-100',   text: 'text-amber-700'   },
};

export default function ShopDoctorsScreen() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [mciInput, setMciInput] = useState('');
  const [feeInput, setFeeInput] = useState('');
  const [searchQ, setSearchQ] = useState('');

  // ── Doctor search (live, by name/specialization) ──────────────
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['doctor-search', searchQ],
    queryFn: () =>
      doctorApi.search({ q: searchQ, limit: 10 }).then((r) => r.data.data ?? r.data.doctors ?? []),
    enabled: searchQ.trim().length > 1,
  });

  // ── Linked doctors list ────────────────────────────────────────
  const { data: chambers = [], isLoading } = useQuery<LinkedDoctor[]>({
    queryKey: ['shop-chambers'],
    queryFn: () => chamberApi.getShopChambers().then((r) => r.data.data),
  });

  // ── Add doctor mutation ────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: (data: object) => chamberApi.shopAddDoctor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-chambers'] });
      setShowAdd(false);
      setMciInput('');
      setFeeInput('');
      Alert.alert('✅ Doctor Added', 'Doctor has been linked to your shop successfully.');
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Could not add doctor.'),
  });

  const handleAdd = () => {
    const mci = mciInput.trim();
    if (!mci) { Alert.alert('Required', 'Please enter an MCI number.'); return; }
    addMutation.mutate({ mci_number: mci, consultation_fee: feeInput ? Number(feeInput) : 0 });
  };

  const handleAddFromSearch = (mci: string) => {
    setMciInput(mci);
    setShowAdd(true);
    setSearchQ('');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
        <Text className="text-xl font-bold text-gray-900">Doctors</Text>
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          className="bg-violet-600 px-3 py-1.5 rounded-xl"
        >
          <Text className="text-white text-xs font-semibold">+ Add Doctor</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View className="px-4 pt-3 pb-1">
        <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-3 gap-2">
          <Text className="text-gray-400 text-base">🔍</Text>
          <TextInput
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Search doctors by name or specialization…"
            className="flex-1 py-2.5 text-sm text-gray-800"
            placeholderTextColor="#9CA3AF"
          />
          {searching && <ActivityIndicator size="small" color="#8B5CF6" />}
        </View>
        {searchResults.length > 0 && searchQ.trim().length > 1 && (
          <View className="bg-white border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-sm">
            {searchResults.slice(0, 6).map((doc: any) => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => handleAddFromSearch(doc.mci_number)}
                className="flex-row items-center px-4 py-3 border-b border-gray-50 last:border-0"
              >
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900 text-sm">Dr. {doc.full_name}</Text>
                  {doc.specialization && (
                    <Text className="text-gray-400 text-xs">{doc.specialization}</Text>
                  )}
                  <Text className="text-violet-500 text-xs mt-0.5">MCI: {doc.mci_number}</Text>
                </View>
                <Text className="text-violet-500 text-xs font-semibold">Add →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Linked doctors list */}
      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#8B5CF6" />
      ) : (
        <FlatList
          data={chambers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">👨‍⚕️</Text>
              <Text className="text-gray-400 text-base">No doctors linked yet</Text>
              <Text className="text-gray-400 text-sm mt-1">Tap "+ Add Doctor" to link one</Text>
            </View>
          }
          renderItem={({ item }) => {
            const colors = STATUS_COLORS[item.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
            return (
              <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="font-bold text-gray-900 text-base">
                      Dr. {item.doctor?.full_name ?? 'Unknown'}
                    </Text>
                    {item.doctor?.specialization && (
                      <Text className="text-gray-500 text-xs mt-0.5">{item.doctor.specialization}</Text>
                    )}
                    {item.doctor?.experience_years !== undefined && (
                      <Text className="text-gray-400 text-xs">{item.doctor.experience_years} yrs experience</Text>
                    )}
                  </View>
                  <View className={`${colors.bg} px-2.5 py-1 rounded-full ml-2`}>
                    <Text className={`${colors.text} text-xs font-semibold capitalize`}>{item.status}</Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                  <View>
                    <Text className="text-gray-400 text-xs">Consultation Fee</Text>
                    <Text className="text-gray-900 font-semibold text-sm">₹{item.consultation_fee}</Text>
                  </View>
                  {item.schedules.length > 0 && (
                    <View className="flex-1">
                      <Text className="text-gray-400 text-xs mb-1">Schedule</Text>
                      <View className="flex-row flex-wrap gap-1">
                        {item.schedules.map((s) => (
                          <View key={s.day_of_week} className="bg-violet-50 px-2 py-0.5 rounded-full">
                            <Text className="text-violet-700 text-xs">{DAY_NAMES[s.day_of_week]}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {item.status === 'pending' && item.requested_by === 'doctor' && (
                  <TouchableOpacity
                    onPress={() =>
                      chamberApi.approve(item.id).then(() =>
                        qc.invalidateQueries({ queryKey: ['shop-chambers'] })
                      ).catch(() => Alert.alert('Error', 'Could not approve.'))
                    }
                    className="mt-3 bg-emerald-600 py-2 rounded-xl items-center"
                  >
                    <Text className="text-white text-sm font-semibold">Approve Request</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Add Doctor Modal ──────────────────────────────── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View className="flex-1 bg-white px-6 pt-8">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">Add Doctor</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); setMciInput(''); setFeeInput(''); }}>
              <Text className="text-gray-400 text-2xl font-light">✕</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-gray-500 mb-5">
            Enter the doctor's MCI registration number. They must be an approved RxDesk user.
          </Text>

          <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">MCI Number *</Text>
          <TextInput
            value={mciInput}
            onChangeText={setMciInput}
            placeholder="e.g. MH-12345"
            autoCapitalize="characters"
            className="border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 text-gray-800"
            placeholderTextColor="#9CA3AF"
          />

          <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Consultation Fee (₹)</Text>
          <TextInput
            value={feeInput}
            onChangeText={setFeeInput}
            placeholder="0"
            keyboardType="number-pad"
            className="border border-gray-200 rounded-xl px-4 py-3 text-sm mb-8 text-gray-800"
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            onPress={handleAdd}
            disabled={addMutation.isPending}
            className="bg-violet-600 py-3.5 rounded-2xl items-center"
          >
            {addMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Link Doctor</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
