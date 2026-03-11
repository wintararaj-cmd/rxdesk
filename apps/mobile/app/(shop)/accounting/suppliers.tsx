import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { accountingApi } from '../../../api/client';

interface Supplier {
  id: string;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  city: string | null;
  is_active: boolean;
}

interface LedgerEntry {
  id: string;
  type: 'purchase' | 'payment';
  date: string;
  amount: number;
  note: string;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function SupplierLedgerModal({
  supplier,
  visible,
  onClose,
}: {
  supplier: Supplier | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-ledger', supplier?.id],
    queryFn: () => accountingApi.getSupplierLedger(supplier!.id).then((r) => r.data.data),
    enabled: !!supplier,
  });

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-row items-center px-4 py-4 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={onClose} className="mr-3">
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </TouchableOpacity>
          <Text className="text-gray-900 font-semibold flex-1" numberOfLines={1}>
            {supplier?.supplier_name}
          </Text>
        </View>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#6366F1" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
                <Text className="text-gray-500 text-xs">Total Purchased</Text>
                <Text className="text-gray-900 font-bold text-base">
                  {fmt(data?.summary?.total_purchased ?? 0)}
                </Text>
              </View>
              <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
                <Text className="text-gray-500 text-xs">Outstanding</Text>
                <Text className="text-red-600 font-bold text-base">
                  {fmt(data?.summary?.outstanding ?? 0)}
                </Text>
              </View>
            </View>

            <Text className="text-gray-600 font-medium mb-2">Transaction History</Text>
            {(data?.ledger as LedgerEntry[])?.map((entry) => (
              <View key={entry.id} className="bg-white rounded-xl p-3 mb-2 flex-row items-center shadow-sm">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                    entry.type === 'purchase' ? 'bg-blue-100' : 'bg-green-100'
                  }`}
                >
                  <Ionicons
                    name={entry.type === 'purchase' ? 'bag-outline' : 'checkmark-outline'}
                    size={16}
                    color={entry.type === 'purchase' ? '#3B82F6' : '#22C55E'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-700 text-sm">{entry.note}</Text>
                  <Text className="text-gray-400 text-xs">
                    {new Date(entry.date).toLocaleDateString('en-IN')}
                  </Text>
                </View>
                <Text
                  className={`font-semibold text-sm ${
                    entry.type === 'purchase' ? 'text-blue-600' : 'text-green-600'
                  }`}
                >
                  {entry.type === 'purchase' ? '-' : '+'}{fmt(entry.amount)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export default function SuppliersScreen() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [gstin, setGstin] = useState('');

  const { data, isLoading, refetch } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => accountingApi.listSuppliers().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: object) => accountingApi.createSupplier(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setShowAdd(false);
      resetForm();
    },
    onError: () => Alert.alert('Error', 'Failed to create supplier'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deactivateSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    onError: () => Alert.alert('Error', 'Failed to deactivate supplier'),
  });

  function resetForm() {
    setSupplierName('');
    setContactPerson('');
    setPhone('');
    setCity('');
    setGstin('');
  }

  function handleCreate() {
    if (!supplierName.trim()) return Alert.alert('Validation', 'Supplier name is required');
    createMutation.mutate({
      supplier_name: supplierName.trim(),
      contact_person: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      gstin: gstin.trim() || undefined,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-indigo-600 px-5 pt-4 pb-6">
        <Text className="text-white text-xl font-bold">Suppliers</Text>
        <Text className="text-indigo-200 text-sm">{data?.length ?? 0} active suppliers</Text>
      </View>

      <ScrollView
        className="-mt-2"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#6366F1" />
          </View>
        ) : data?.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="people-outline" size={40} color="#D1D5DB" />
            <Text className="text-gray-400 mt-2">No suppliers added</Text>
          </View>
        ) : (
          <View className="px-4 pt-4 gap-3">
            {data?.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSelected(s)}
                className="bg-white rounded-xl p-4 shadow-sm"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold">{s.supplier_name}</Text>
                    {s.contact_person && (
                      <Text className="text-gray-500 text-sm">{s.contact_person}</Text>
                    )}
                    <View className="flex-row gap-3 mt-1">
                      {s.phone && (
                        <Text className="text-gray-400 text-xs">{s.phone}</Text>
                      )}
                      {s.city && (
                        <Text className="text-gray-400 text-xs">{s.city}</Text>
                      )}
                    </View>
                    {s.gstin && (
                      <Text className="text-gray-400 text-xs mt-0.5">GSTIN: {s.gstin}</Text>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
                      <Text className="text-indigo-600 text-xs">View Ledger</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert('Deactivate', `Remove ${s.supplier_name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => deactivateMutation.mutate(s.id),
                          },
                        ])
                      }
                      className="p-1"
                    >
                      <Ionicons name="close-circle-outline" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowAdd(true)}
        className="absolute bottom-8 right-6 bg-indigo-600 w-14 h-14 rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Ledger Modal */}
      <SupplierLedgerModal supplier={selected} visible={!!selected} onClose={() => setSelected(null)} />

      {/* Add Supplier Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-6 pb-10">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-gray-900 text-lg font-bold">Add Supplier</Text>
              <TouchableOpacity onPress={() => { setShowAdd(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {[
              { label: 'Supplier Name *', value: supplierName, set: setSupplierName, placeholder: 'e.g. Medico Pharma' },
              { label: 'Contact Person', value: contactPerson, set: setContactPerson, placeholder: 'Sales rep name' },
              { label: 'Phone', value: phone, set: setPhone, placeholder: '9876543210', keyboard: 'phone-pad' },
              { label: 'City', value: city, set: setCity, placeholder: 'Mumbai' },
              { label: 'GSTIN', value: gstin, set: setGstin, placeholder: '27AAACR0345E1ZZ' },
            ].map((f) => (
              <View key={f.label} className="mb-4">
                <Text className="text-gray-600 text-sm mb-1">{f.label}</Text>
                <TextInput
                  value={f.value}
                  onChangeText={f.set}
                  placeholder={f.placeholder}
                  keyboardType={(f.keyboard as any) ?? 'default'}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={handleCreate}
              disabled={createMutation.isPending}
              className="bg-indigo-600 py-4 rounded-xl items-center mt-2"
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Save Supplier</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
