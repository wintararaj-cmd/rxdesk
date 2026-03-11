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

interface CreditCustomer {
  id: string;
  name: string;
  phone: string | null;
  total_outstanding: number;
  updated_at: string | null;
  overdue: boolean;
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  notes: string | null;
  transaction_date: string;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function LedgerModal({
  customer,
  visible,
  onClose,
}: {
  customer: CreditCustomer | null;
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['credit-ledger', customer?.id],
    queryFn: () => accountingApi.getCreditLedger(customer!.id).then((r) => r.data.data),
    enabled: !!customer,
  });

  const payMutation = useMutation({
    mutationFn: (d: object) => accountingApi.recordCreditPayment(customer!.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit-customers'] });
      qc.invalidateQueries({ queryKey: ['credit-ledger', customer?.id] });
      setShowPayment(false);
      setPayAmount('');
      setPayNote('');
    },
    onError: () => Alert.alert('Error', 'Failed to record payment'),
  });

  function handlePay() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return Alert.alert('Validation', 'Enter a valid amount');
    payMutation.mutate({ amount: amt, notes: payNote.trim() || undefined });
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </TouchableOpacity>
          <Text className="text-gray-900 font-semibold flex-1 ml-3" numberOfLines={1}>
            {customer?.name}
          </Text>
          <TouchableOpacity
            onPress={() => setShowPayment(true)}
            className="bg-orange-500 px-3 py-1.5 rounded-lg"
          >
            <Text className="text-white text-xs font-medium">Record Payment</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#F97316" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          >
            <View className="flex-row gap-3 mb-4">
              <View className={`flex-1 rounded-xl p-4 shadow-sm ${customer?.overdue ? 'bg-red-50' : 'bg-white'}`}>
                <Text className="text-gray-500 text-xs">Outstanding</Text>
                <Text
                  className={`font-bold text-lg ${
                    customer?.overdue ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {fmt(customer?.total_outstanding ?? 0)}
                </Text>
                {customer?.overdue && (
                  <Text className="text-red-400 text-xs">Overdue &gt;30 days</Text>
                )}
              </View>
              {customer?.phone && (
                <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
                  <Text className="text-gray-500 text-xs">Phone</Text>
                  <Text className="text-gray-800 font-medium">{customer.phone}</Text>
                </View>
              )}
            </View>

            <Text className="text-gray-600 font-medium mb-2">Transactions</Text>
            {(data?.transactions as LedgerEntry[])?.map((t) => (
              <View key={t.id} className="bg-white rounded-xl p-3 mb-2 flex-row items-center shadow-sm">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                    t.type === 'credit_given' ? 'bg-red-100' : 'bg-green-100'
                  }`}
                >
                  <Ionicons
                    name={t.type === 'credit_given' ? 'add-outline' : 'arrow-down-outline'}
                    size={16}
                    color={t.type === 'credit_given' ? '#EF4444' : '#22C55E'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-700 text-sm">
                    {t.type === 'credit_given' ? 'Credit Given' : 'Payment Received'}
                  </Text>
                  {t.notes && <Text className="text-gray-400 text-xs">{t.notes}</Text>}
                  <Text className="text-gray-400 text-xs">
                    {new Date(t.transaction_date).toLocaleDateString('en-IN')}
                  </Text>
                </View>
                <Text
                  className={`font-semibold text-sm ${
                    t.type === 'credit_given' ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {t.type === 'credit_given' ? '+' : '-'}{fmt(t.amount)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Record Payment Sheet */}
        <Modal visible={showPayment} animationType="slide" transparent>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl px-5 pt-6 pb-10">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-gray-900 font-bold text-lg">Record Payment</Text>
                <TouchableOpacity onPress={() => setShowPayment(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-500 text-sm mb-4">
                Outstanding: {fmt(customer?.total_outstanding ?? 0)}
              </Text>
              <Text className="text-gray-600 text-sm mb-1">Amount Received (₹)</Text>
              <TextInput
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                placeholder="0.00"
                className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
              />
              <Text className="text-gray-600 text-sm mb-1">Note (optional)</Text>
              <TextInput
                value={payNote}
                onChangeText={setPayNote}
                placeholder="e.g. Cash payment at counter"
                className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-6"
              />
              <TouchableOpacity
                onPress={handlePay}
                disabled={payMutation.isPending}
                className="bg-orange-500 py-4 rounded-xl items-center"
              >
                {payMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Save Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

export default function CreditScreen() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<CreditCustomer | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const { data: rawData, isLoading, refetch } = useQuery<{ customers: CreditCustomer[] }>({
    queryKey: ['credit-customers'],
    queryFn: () => accountingApi.listCreditCustomers().then((r) => r.data.data),
  });
  const data = rawData?.customers;

  const createMutation = useMutation({
    mutationFn: (d: object) => accountingApi.createCreditCustomer(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit-customers'] });
      setShowAdd(false);
      setName('');
      setPhone('');
    },
    onError: () => Alert.alert('Error', 'Failed to add credit customer'),
  });

  const totalOutstanding = data?.reduce((sum, c) => sum + Number(c.total_outstanding), 0) ?? 0;
  const overdueCount = data?.filter((c) => c.overdue).length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-orange-500 px-5 pt-4 pb-6">
        <Text className="text-white text-xl font-bold">Credit Customers</Text>
        <Text className="text-orange-100 text-sm mt-0.5">
          Total due: {fmt(totalOutstanding)}
          {overdueCount > 0 && ` · ${overdueCount} overdue`}
        </Text>
      </View>

      <ScrollView
        className="-mt-2"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#F97316" />
          </View>
        ) : data?.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="time-outline" size={40} color="#D1D5DB" />
            <Text className="text-gray-400 mt-2">No credit customers</Text>
          </View>
        ) : (
          <View className="px-4 pt-4 gap-3">
            {data?.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setSelected(c)}
                className={`bg-white rounded-xl p-4 shadow-sm ${c.overdue ? 'border border-red-200' : ''}`}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-gray-900 font-semibold">{c.name}</Text>
                      {c.overdue && (
                        <View className="bg-red-100 px-2 py-0.5 rounded-full">
                          <Text className="text-red-600 text-xs">Overdue</Text>
                        </View>
                      )}
                    </View>
                    {c.phone && (
                      <Text className="text-gray-400 text-xs mt-0.5">{c.phone}</Text>
                    )}
                    {c.updated_at && (
                      <Text className="text-gray-400 text-xs">
                        Last: {new Date(c.updated_at).toLocaleDateString('en-IN')}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text
                      className={`font-bold text-base ${
                        c.total_outstanding > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {fmt(Number(c.total_outstanding))}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
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
        className="absolute bottom-8 right-6 bg-orange-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <LedgerModal customer={selected} visible={!!selected} onClose={() => setSelected(null)} />

      {/* Add Customer Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-6 pb-10">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-gray-900 text-lg font-bold">Add Credit Customer</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text className="text-gray-600 text-sm mb-1">Customer Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Rahul Sharma"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
            />
            <Text className="text-gray-600 text-sm mb-1">Phone (optional)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="9876543210"
              keyboardType="phone-pad"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-6"
            />
            <TouchableOpacity
              onPress={() => {
                if (!name.trim()) return Alert.alert('Validation', 'Name is required');
                createMutation.mutate({ name: name.trim(), phone: phone.trim() || undefined });
              }}
              disabled={createMutation.isPending}
              className="bg-orange-500 py-4 rounded-xl items-center"
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Save Customer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
