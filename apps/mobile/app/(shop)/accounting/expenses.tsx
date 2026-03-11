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

const CATEGORIES = [
  'rent', 'salary', 'electricity', 'water', 'phone', 'internet',
  'maintenance', 'transport', 'advertising', 'miscellaneous',
];

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  payment_method: string;
  entry_date: string;
  is_auto_entry: boolean;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    rent: 'bg-red-100 text-red-700',
    salary: 'bg-blue-100 text-blue-700',
    electricity: 'bg-yellow-100 text-yellow-700',
    purchase: 'bg-indigo-100 text-indigo-700',
    miscellaneous: 'bg-gray-100 text-gray-700',
  };
  return map[cat] ?? 'bg-purple-100 text-purple-700';
}

export default function ExpensesScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('miscellaneous');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  const { data, isLoading, refetch } = useQuery<{ expenses: Expense[]; total: number }>({
    queryKey: ['expenses'],
    queryFn: () => accountingApi.listExpenses().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: object) => accountingApi.createExpense(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['pl'] });
      setShowModal(false);
      resetForm();
    },
    onError: () => Alert.alert('Error', 'Failed to create expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['pl'] });
    },
    onError: () => Alert.alert('Error', 'Cannot delete auto-generated entries'),
  });

  function resetForm() {
    setCategory('miscellaneous');
    setAmount('');
    setDescription('');
    setPaymentMethod('cash');
  }

  function handleCreate() {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return Alert.alert('Validation', 'Enter a valid amount');
    createMutation.mutate({ category, amount: parsed, description, payment_method: paymentMethod });
  }

  function confirmDelete(expense: Expense) {
    if (expense.is_auto_entry) {
      return Alert.alert('Info', 'Auto-generated entries cannot be deleted');
    }
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(expense.id) },
    ]);
  }

  const total = data?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-red-500 px-5 pt-4 pb-6">
        <Text className="text-white text-xl font-bold">Expenses</Text>
        <Text className="text-red-100 text-sm mt-0.5">Total: {fmt(total)}</Text>
      </View>

      <ScrollView
        className="-mt-2"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#EF4444" />
          </View>
        ) : data?.expenses.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="card-outline" size={40} color="#D1D5DB" />
            <Text className="text-gray-400 mt-2">No expenses recorded</Text>
          </View>
        ) : (
          <View className="px-4 pt-4 gap-3">
            {data?.expenses.map((exp) => (
              <View key={exp.id} className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className={`px-2 py-0.5 rounded-full ${categoryColor(exp.category).split(' ')[0]}`}>
                        <Text className={`text-xs capitalize ${categoryColor(exp.category).split(' ')[1]}`}>
                          {exp.category}
                        </Text>
                      </View>
                      {exp.is_auto_entry && (
                        <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                          <Text className="text-gray-500 text-xs">auto</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-800 font-semibold">{fmt(exp.amount)}</Text>
                    {exp.description && (
                      <Text className="text-gray-500 text-xs mt-0.5">{exp.description}</Text>
                    )}
                    <Text className="text-gray-400 text-xs mt-1">
                      {new Date(exp.entry_date).toLocaleDateString('en-IN')} · {exp.payment_method}
                    </Text>
                  </View>
                  {!exp.is_auto_entry && (
                    <TouchableOpacity
                      onPress={() => confirmDelete(exp)}
                      className="p-2"
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        className="absolute bottom-8 right-6 bg-red-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Expense Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-6 pb-10">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-gray-900 text-lg font-bold">Add Expense</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Category picker */}
            <Text className="text-gray-600 text-sm mb-2">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full ${
                      category === c ? 'bg-red-500' : 'bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-xs capitalize ${
                        category === c ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Amount */}
            <Text className="text-gray-600 text-sm mb-1">Amount (₹)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
            />

            {/* Description */}
            <Text className="text-gray-600 text-sm mb-1">Note (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Monthly rent"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
            />

            {/* Payment method */}
            <Text className="text-gray-600 text-sm mb-2">Payment Method</Text>
            <View className="flex-row gap-3 mb-6">
              {(['cash', 'upi', 'card'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPaymentMethod(m)}
                  className={`flex-1 py-2 rounded-xl ${
                    paymentMethod === m ? 'bg-red-500' : 'bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-center text-sm capitalize ${
                      paymentMethod === m ? 'text-white font-medium' : 'text-gray-600'
                    }`}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={createMutation.isPending}
              className="bg-red-500 py-4 rounded-xl items-center"
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Save Expense</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
