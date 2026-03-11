import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { accountingApi } from '../../../api/client';

interface CashRegister {
  id?: string;
  register_date: string;
  opening_balance: number;
  expected_closing_balance: number;
  actual_closing_balance: number | null;
  variance: number | null;
  is_closed: boolean;
  cash_sales: number;
  cash_expenses: number;
  supplier_payments_cash: number;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function VarianceChip({ variance }: { variance: number | null }) {
  if (variance === null) return null;
  const abs = Math.abs(variance);
  if (abs < 1) return <View className="bg-green-100 px-2 py-0.5 rounded-full">
    <Text className="text-green-700 text-xs">Balanced</Text>
  </View>;
  if (variance > 0) return <View className="bg-blue-100 px-2 py-0.5 rounded-full">
    <Text className="text-blue-700 text-xs">+{fmt(variance)} surplus</Text>
  </View>;
  return <View className="bg-red-100 px-2 py-0.5 rounded-full">
    <Text className="text-red-700 text-xs">{fmt(variance)} short</Text>
  </View>;
}

export default function CashRegisterScreen() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [closingAmt, setClosingAmt] = useState('');

  const { data, isLoading, refetch } = useQuery<CashRegister>({
    queryKey: ['cash-register', date],
    queryFn: () => accountingApi.getCashRegister(date).then((r) => r.data.data),
  });

  const closeMutation = useMutation({
    mutationFn: (d: object) => accountingApi.closeCashRegister(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-register'] });
      setClosingAmt('');
      Alert.alert('Success', 'Cash register closed for the day');
    },
    onError: () => Alert.alert('Error', 'Failed to close cash register'),
  });

  function handleClose() {
    const amt = parseFloat(closingAmt);
    if (isNaN(amt) || amt < 0) return Alert.alert('Validation', 'Enter actual cash in hand');
    Alert.alert('Close Register', `Record actual closing balance as ${fmt(amt)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () =>
          closeMutation.mutate({ date, actual_closing_balance: amt }),
      },
    ]);
  }

  const rows = data
    ? [
        { label: 'Opening Balance', value: fmt(data.opening_balance), icon: 'wallet-outline' as const, color: 'text-gray-700' },
        { label: 'Cash Sales', value: fmt(data.cash_sales), icon: 'trending-up-outline' as const, color: 'text-green-600' },
        { label: 'Cash Expenses', value: `−${fmt(data.cash_expenses)}`, icon: 'card-outline' as const, color: 'text-red-600' },
        { label: 'Supplier Payments', value: `−${fmt(data.supplier_payments_cash)}`, icon: 'bag-outline' as const, color: 'text-orange-600' },
        {
          label: 'Expected Closing',
          value: fmt(data.expected_closing_balance),
          icon: 'calculator-outline' as const,
          color: 'text-indigo-700',
        },
      ]
    : [];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-green-600 px-5 pt-4 pb-6">
        <Text className="text-white text-xl font-bold">Cash Register</Text>
        <Text className="text-green-200 text-sm">{date}</Text>
      </View>

      <ScrollView
        className="-mt-2"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Date picker row */}
        <View className="flex-row items-center justify-center gap-3 px-4 py-4">
          <TouchableOpacity
            onPress={() => {
              const d = new Date(date);
              d.setDate(d.getDate() - 1);
              setDate(d.toISOString().slice(0, 10));
            }}
            className="bg-white w-10 h-10 rounded-full items-center justify-center shadow-sm"
          >
            <Ionicons name="chevron-back" size={18} color="#374151" />
          </TouchableOpacity>
          <Text className="text-gray-700 font-semibold text-base">{date}</Text>
          <TouchableOpacity
            onPress={() => {
              const d = new Date(date);
              d.setDate(d.getDate() + 1);
              const next = d.toISOString().slice(0, 10);
              if (next <= today) setDate(next);
            }}
            disabled={date >= today}
            className={`w-10 h-10 rounded-full items-center justify-center shadow-sm ${
              date >= today ? 'bg-gray-100' : 'bg-white'
            }`}
          >
            <Ionicons name="chevron-forward" size={18} color={date >= today ? '#D1D5DB' : '#374151'} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#22C55E" />
          </View>
        ) : (
          <View className="px-4 gap-3">
            {/* Summary rows */}
            <View className="bg-white rounded-xl overflow-hidden shadow-sm">
              {rows.map((row, idx) => (
                <View
                  key={row.label}
                  className={`flex-row items-center px-4 py-3 ${
                    idx < rows.length - 1 ? 'border-b border-gray-50' : 'border-t border-gray-100 bg-gray-50'
                  }`}
                >
                  <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-3">
                    <Ionicons name={row.icon} size={16} color="#6B7280" />
                  </View>
                  <Text className="text-gray-600 flex-1 text-sm">{row.label}</Text>
                  <Text className={`font-semibold text-sm ${row.color}`}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Status */}
            {data?.is_closed ? (
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-gray-700 font-medium">Actual Closing</Text>
                  <Text className="text-gray-900 font-bold">
                    {fmt(data.actual_closing_balance ?? 0)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-500 text-sm">Variance</Text>
                  <VarianceChip variance={data.variance ?? null} />
                </View>
                <View className="flex-row items-center mt-3 gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text className="text-green-600 text-sm font-medium">Register Closed</Text>
                </View>
              </View>
            ) : (
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <Text className="text-gray-700 font-medium mb-3">Close Register</Text>
                <Text className="text-gray-500 text-sm mb-2">
                  Expected: <Text className="font-semibold text-gray-800">{fmt(data?.expected_closing_balance ?? 0)}</Text>
                </Text>
                <Text className="text-gray-600 text-sm mb-1">Actual Cash in Hand (₹)</Text>
                <TextInput
                  value={closingAmt}
                  onChangeText={setClosingAmt}
                  keyboardType="numeric"
                  placeholder={String(data?.expected_closing_balance ?? '0')}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
                />
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={closeMutation.isPending}
                  className="bg-green-600 py-4 rounded-xl items-center"
                >
                  {closeMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold">Close Register for {date}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
