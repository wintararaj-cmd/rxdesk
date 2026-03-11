import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { patientApi, prescriptionApi } from '../../api/client';

interface PrescriptionItem { id: string; medicine_name: string; dosage: string; frequency: string; duration?: string | null; instructions?: string; }
interface Prescription {
  id: string;
  created_at: string;
  diagnosis: string;
  advice?: string;
  doctor?: { full_name: string; specialization: string };
  items: PrescriptionItem[];
  pdf_url?: string;
}

export default function PrescriptionsScreen() {
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  const { data: prescriptions = [], isLoading, refetch, isRefetching } = useQuery<Prescription[]>({
    queryKey: ['patient-prescriptions'],
    queryFn: () => patientApi.getPrescriptions({ limit: 50 }).then((r) => r.data.data),
  });

  const handleSharePdf = async (pdfUrl: string) => {
    try {
      const localUri = FileSystem.cacheDirectory + 'prescription.pdf';
      await FileSystem.downloadAsync(pdfUrl, localUri);
      await Sharing.shareAsync(localUri, { mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Could not download or share the prescription.');
    }
  };

  const handleGetPdf = async (prescriptionId: string) => {
    if (loadingPdf) return;
    setLoadingPdf(prescriptionId);
    try {
      const res = await prescriptionApi.getPdf(prescriptionId);
      const url: string | null = res.data?.data?.url ?? null;
      if (!url) {
        Alert.alert('Not Available', 'PDF could not be generated. Please try again later.');
        return;
      }
      await handleSharePdf(url);
    } catch {
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    } finally {
      setLoadingPdf(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">My Prescriptions</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#0EA5E9" />
      ) : (
        <FlatList
          data={prescriptions}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">📋</Text>
              <Text className="text-gray-400 text-base">No prescriptions yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Header */}
              <View className="bg-sky-50 px-4 py-3 flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">
                    {item.doctor ? item.doctor.full_name : 'Doctor'}
                  </Text>
                  {item.doctor?.specialization && (
                    <Text className="text-sky-600 text-xs mt-0.5">{item.doctor.specialization}</Text>
                  )}
                </View>
                <Text className="text-gray-400 text-xs">
                  {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>

              {/* Body */}
              <View className="px-4 py-3">
                <Text className="text-sm font-medium text-gray-700 mb-2">Diagnosis: <Text className="font-normal text-gray-600">{item.diagnosis}</Text></Text>

                {item.items.map((med) => (
                  <View key={med.id} className="bg-gray-50 rounded-xl px-3 py-2.5 mb-2">
                    <Text className="font-medium text-gray-900 text-sm">{med.medicine_name}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">
                      {med.dosage} · {med.frequency}{med.duration ? ` · ${med.duration}` : ''}
                    </Text>
                    {med.instructions && <Text className="text-gray-400 text-xs mt-0.5">{med.instructions}</Text>}
                  </View>
                ))}

                {item.advice && <Text className="text-gray-400 text-xs mt-1">Note: {item.advice}</Text>}
              </View>

              {/* Actions */}
              <TouchableOpacity
                onPress={() => handleGetPdf(item.id)}
                disabled={loadingPdf === item.id}
                className="border-t border-gray-100 px-4 py-3 flex-row items-center gap-2"
              >
                {loadingPdf === item.id
                  ? <ActivityIndicator size="small" color="#0EA5E9" />
                  : <Text className="text-sky-500 text-sm font-medium">📤 {item.pdf_url ? 'Share PDF' : 'Generate & Share PDF'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
