import { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { prescriptionApi, medicineApi } from '../../api/client';

interface MedicineSuggestion { id: string; name: string; generic_name?: string; form?: string; }
interface PrescriptionItem { medicine_name: string; dosage: string; frequency: string; duration_days: string; instructions: string; }

const DEFAULT_ITEM: PrescriptionItem = { medicine_name: '', dosage: '', frequency: '', duration_days: '', instructions: '' };

export default function PrescribeScreen() {
  const { appointmentId, patientName } = useLocalSearchParams<{ appointmentId?: string; patientName?: string }>();
  const router = useRouter();

  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...DEFAULT_ITEM }]);
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);

  const searchMedicines = async (query: string, idx: number) => {
    setActiveItemIdx(idx);
    updateItem(idx, 'medicine_name', query);
    if (query.length >= 2) {
      try {
        const res = await medicineApi.search(query);
        setSuggestions(res.data.data as MedicineSuggestion[]);
      } catch { setSuggestions([]); }
    } else {
      setSuggestions([]);
    }
  };

  const updateItem = (idx: number, key: keyof PrescriptionItem, value: string) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };

  const addItem = () => setItems((prev) => [...prev, { ...DEFAULT_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const createMutation = useMutation({
    mutationFn: (data: object) => prescriptionApi.create(data),
    onSuccess: () => {
      Alert.alert('✅ Prescription Created', 'The prescription has been issued and a QR code has been generated.', [
        { text: 'Back to Appointments', onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to create prescription.'),
  });

  const handleSubmit = () => {
    if (!diagnosis.trim()) { Alert.alert('Required', 'Please enter a diagnosis.'); return; }
    if (!appointmentId) { Alert.alert('Error', 'No appointment selected.'); return; }
    const validItems = items.filter((i) => i.medicine_name && i.dosage && i.frequency && i.duration_days);
    if (validItems.length === 0) { Alert.alert('Required', 'Add at least one medicine.'); return; }

    createMutation.mutate({
      appointment_id: appointmentId,
      diagnosis,
      advice: notes || undefined,
      items: validItems.map((i) => ({
        medicine_name: i.medicine_name,
        dosage: i.dosage,
        frequency: i.frequency,
        duration: `${i.duration_days} days`,
        instructions: i.instructions || undefined,
        quantity: 1,
      })),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-emerald-500 px-5 pt-4 pb-5 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-white text-lg">←</Text>
        </TouchableOpacity>
        <View>
          <Text className="text-white text-lg font-bold">Write Prescription</Text>
          {patientName && <Text className="text-emerald-100 text-sm">Patient: {patientName}</Text>}
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {/* Diagnosis */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Diagnosis *</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm h-16"
            placeholder="Enter diagnosis / chief complaint"
            placeholderTextColor="#9CA3AF"
            multiline
            value={diagnosis}
            onChangeText={setDiagnosis}
          />
        </View>

        {/* Medicines */}
        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-sm font-semibold text-gray-700">Medicines *</Text>
            <TouchableOpacity onPress={addItem} className="bg-emerald-100 px-3 py-1 rounded-full">
              <Text className="text-emerald-700 text-xs font-medium">+ Add</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, idx) => (
            <View key={idx} className="mb-4 pb-4 border-b border-gray-100 last:border-0">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-xs font-medium text-gray-500">MEDICINE {idx + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(idx)}>
                    <Text className="text-red-400 text-xs">Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Medicine name with autocomplete */}
              <View className="mb-2">
                <TextInput
                  className="border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-900"
                  placeholder="Medicine name"
                  placeholderTextColor="#9CA3AF"
                  value={item.medicine_name}
                  onChangeText={(v) => searchMedicines(v, idx)}
                  onFocus={() => setActiveItemIdx(idx)}
                />
                {/* Suggestions dropdown */}
                {activeItemIdx === idx && suggestions.length > 0 && (
                  <View className="absolute top-10 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-36 overflow-hidden">
                    <ScrollView nestedScrollEnabled>
                      {suggestions.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => { updateItem(idx, 'medicine_name', s.name); setSuggestions([]); }}
                          className="px-3 py-2.5 border-b border-gray-50"
                        >
                          <Text className="text-sm text-gray-900">{s.name}</Text>
                          {s.generic_name && <Text className="text-xs text-gray-400">{s.generic_name}</Text>}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View className="flex-row gap-2 mb-2">
                {[
                  { key: 'dosage', placeholder: 'Dosage (e.g. 1 tab)' },
                  { key: 'frequency', placeholder: 'Frequency (e.g. TDS)' },
                ].map(({ key, placeholder }) => (
                  <TextInput
                    key={key}
                    className="flex-1 border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-900"
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={item[key as keyof PrescriptionItem]}
                    onChangeText={(v) => updateItem(idx, key as keyof PrescriptionItem, v)}
                  />
                ))}
              </View>

              <View className="flex-row gap-2">
                <TextInput
                  className="w-24 border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-900"
                  placeholder="Days"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={item.duration_days}
                  onChangeText={(v) => updateItem(idx, 'duration_days', v)}
                />
                <TextInput
                  className="flex-1 border border-gray-200 rounded-xl px-3 h-10 text-sm text-gray-900"
                  placeholder="Instructions (after food…)"
                  placeholderTextColor="#9CA3AF"
                  value={item.instructions}
                  onChangeText={(v) => updateItem(idx, 'instructions', v)}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Notes */}
        <View className="bg-white rounded-2xl p-4 mb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Doctor's Notes</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm h-16"
            placeholder="Optional notes, follow-up instructions…"
            placeholderTextColor="#9CA3AF"
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center mb-8 ${createMutation.isPending ? 'bg-gray-300' : 'bg-emerald-500'}`}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-semibold text-base">Issue Prescription + QR</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
