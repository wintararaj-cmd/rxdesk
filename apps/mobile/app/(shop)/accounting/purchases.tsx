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
}

interface PurchaseEntry {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  supplier: { supplier_name: string };
}

interface PurchaseItem {
  medicine_name: string;
  quantity: number;
  purchase_price: number;
  mrp: number;
  batch_number?: string;
  expiry_date?: string;
  gst_rate: number;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function statusBadge(status: string) {
  if (status === 'paid') return 'bg-green-100 text-green-700';
  if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function PurchasesScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<PurchaseEntry | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque'>('cash');

  // Purchase form
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([
    { medicine_name: '', quantity: 1, purchase_price: 0, mrp: 0, gst_rate: 12 },
  ]);

  const { data, isLoading, refetch } = useQuery<{ purchases: PurchaseEntry[] }>({
    queryKey: ['purchases'],
    queryFn: () => accountingApi.listPurchases().then((r) => r.data.data),
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => accountingApi.listSuppliers().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: object) => accountingApi.createPurchase(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['pl'] });
      setShowModal(false);
      resetForm();
      Alert.alert('Success', 'Purchase recorded and inventory updated');
    },
    onError: () => Alert.alert('Error', 'Failed to record purchase'),
  });

  const payMutation = useMutation({
    mutationFn: (d: object) => accountingApi.recordSupplierPayment(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      setShowPayModal(null);
      setPayAmount('');
    },
    onError: () => Alert.alert('Error', 'Failed to record payment'),
  });

  function resetForm() {
    setSupplierId('');
    setInvoiceNumber('');
    setPaymentStatus('paid');
    setAmountPaid('');
    setItems([{ medicine_name: '', quantity: 1, purchase_price: 0, mrp: 0, gst_rate: 12 }]);
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { medicine_name: '', quantity: 1, purchase_price: 0, mrp: 0, gst_rate: 12 },
    ]);
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: string | number) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCreate() {
    if (!supplierId) return Alert.alert('Validation', 'Select a supplier');
    if (items.some((it) => !it.medicine_name.trim())) {
      return Alert.alert('Validation', 'All items must have a medicine name');
    }
    const totalAmt = items.reduce(
      (sum, it) => sum + it.purchase_price * it.quantity,
      0
    );
    createMutation.mutate({
      supplier_id: supplierId,
      invoice_number: invoiceNumber.trim() || undefined,
      invoice_date: new Date().toISOString(),
      payment_status: paymentStatus,
      amount_paid: paymentStatus === 'paid' ? totalAmt : parseFloat(amountPaid) || 0,
      items: items.map((it) => ({
        ...it,
        expiry_date: it.expiry_date ?? undefined,
        batch_number: it.batch_number ?? undefined,
      })),
    });
  }

  function handlePay() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return Alert.alert('Validation', 'Enter valid amount');
    payMutation.mutate({
      purchase_entry_id: showPayModal!.id,
      amount: amt,
      payment_method: payMethod,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-5 pt-4 pb-6">
        <Text className="text-white text-xl font-bold">Purchase Entries</Text>
        <Text className="text-blue-200 text-sm">{data?.purchases.length ?? 0} entries</Text>
      </View>

      <ScrollView
        className="-mt-2"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#3B82F6" />
          </View>
        ) : data?.purchases.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="bag-outline" size={40} color="#D1D5DB" />
            <Text className="text-gray-400 mt-2">No purchase entries</Text>
          </View>
        ) : (
          <View className="px-4 pt-4 gap-3">
            {data?.purchases.map((p) => (
              <View key={p.id} className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold">
                      {p.supplier?.supplier_name}
                    </Text>
                    {p.invoice_number && (
                      <Text className="text-gray-400 text-xs">Invoice #{p.invoice_number}</Text>
                    )}
                    <Text className="text-gray-400 text-xs">
                      {new Date(p.invoice_date).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View
                    className={`px-2 py-0.5 rounded-full ${statusBadge(p.payment_status).split(' ')[0]}`}
                  >
                    <Text className={`text-xs capitalize ${statusBadge(p.payment_status).split(' ')[1]}`}>
                      {p.payment_status}
                    </Text>
                  </View>
                </View>
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-gray-600 text-sm">
                      Total: <Text className="font-semibold">{fmt(p.total_amount)}</Text>
                    </Text>
                    <Text className="text-gray-500 text-xs">
                      Paid: {fmt(p.amount_paid)} · Due: {fmt(p.total_amount - p.amount_paid)}
                    </Text>
                  </View>
                  {p.payment_status !== 'paid' && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowPayModal(p);
                        setPayAmount(String(p.total_amount - p.amount_paid));
                      }}
                      className="bg-blue-500 px-3 py-1.5 rounded-lg"
                    >
                      <Text className="text-white text-xs font-medium">Pay Now</Text>
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
        className="absolute bottom-8 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Record Payment Modal */}
      <Modal visible={!!showPayModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-6 pb-10">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-900 font-bold text-lg">Record Payment</Text>
              <TouchableOpacity onPress={() => setShowPayModal(null)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text className="text-gray-500 text-sm mb-4">
              Supplier: {showPayModal?.supplier?.supplier_name} · Due:{' '}
              {fmt((showPayModal?.total_amount ?? 0) - (showPayModal?.amount_paid ?? 0))}
            </Text>
            <Text className="text-gray-600 text-sm mb-1">Amount (₹)</Text>
            <TextInput
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
            />
            <Text className="text-gray-600 text-sm mb-2">Payment Method</Text>
            <View className="flex-row gap-2 mb-6 flex-wrap">
              {(['cash', 'upi', 'bank_transfer', 'cheque'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPayMethod(m)}
                  className={`px-3 py-2 rounded-xl ${payMethod === m ? 'bg-blue-600' : 'bg-gray-100'}`}
                >
                  <Text className={`text-xs capitalize ${payMethod === m ? 'text-white' : 'text-gray-600'}`}>
                    {m.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={handlePay}
              disabled={payMutation.isPending}
              className="bg-blue-600 py-4 rounded-xl items-center"
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

      {/* Add Purchase Modal */}
      <Modal visible={showModal} animationType="slide">
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <Ionicons name="arrow-back" size={22} color="#374151" />
            </TouchableOpacity>
            <Text className="text-gray-900 font-bold text-lg">New Purchase Entry</Text>
            <TouchableOpacity onPress={handleCreate} disabled={createMutation.isPending}>
              <Text className="text-blue-600 font-semibold">
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Supplier selector */}
            <Text className="text-gray-600 text-sm mb-2">Supplier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {(suppliers ?? []).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSupplierId(s.id)}
                    className={`px-3 py-2 rounded-xl ${
                      supplierId === s.id ? 'bg-blue-600' : 'bg-white border border-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-sm ${supplierId === s.id ? 'text-white' : 'text-gray-700'}`}
                    >
                      {s.supplier_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text className="text-gray-600 text-sm mb-1">Invoice Number (optional)</Text>
            <TextInput
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              placeholder="INV-2024-001"
              className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900 bg-white"
            />

            {/* Payment status */}
            <Text className="text-gray-600 text-sm mb-2">Payment Status</Text>
            <View className="flex-row gap-3 mb-4">
              {(['paid', 'unpaid', 'partial'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setPaymentStatus(s)}
                  className={`flex-1 py-2 rounded-xl ${
                    paymentStatus === s ? 'bg-blue-600' : 'bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-center text-sm capitalize ${
                      paymentStatus === s ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentStatus === 'partial' && (
              <>
                <Text className="text-gray-600 text-sm mb-1">Amount Paid (₹)</Text>
                <TextInput
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                  keyboardType="numeric"
                  placeholder="0.00"
                  className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900 bg-white"
                />
              </>
            )}

            {/* Items */}
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-700 font-semibold">Items</Text>
              <TouchableOpacity onPress={addItem} className="flex-row items-center gap-1">
                <Ionicons name="add-circle-outline" size={18} color="#3B82F6" />
                <Text className="text-blue-600 text-sm">Add Item</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, idx) => (
              <View key={idx} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-gray-600 text-sm font-medium">Item {idx + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(idx)}>
                      <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text className="text-gray-500 text-xs mb-1">Medicine Name</Text>
                <TextInput
                  value={item.medicine_name}
                  onChangeText={(v) => updateItem(idx, 'medicine_name', v)}
                  placeholder="Paracetamol 500mg"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-gray-900 mb-3"
                />
                <View className="flex-row gap-3">
                  {[
                    { label: 'Qty', field: 'quantity' as const, placeholder: '10' },
                    { label: 'Cost ₹', field: 'purchase_price' as const, placeholder: '8.50' },
                    { label: 'MRP ₹', field: 'mrp' as const, placeholder: '12.00' },
                  ].map((f) => (
                    <View key={f.field} className="flex-1">
                      <Text className="text-gray-500 text-xs mb-1">{f.label}</Text>
                      <TextInput
                        value={item[f.field] === 0 ? '' : String(item[f.field])}
                        onChangeText={(v) =>
                          updateItem(idx, f.field, f.field === 'quantity' ? parseInt(v) || 0 : parseFloat(v) || 0)
                        }
                        keyboardType="numeric"
                        placeholder={f.placeholder}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                      />
                    </View>
                  ))}
                </View>
                <View className="flex-row gap-3 mt-3">
                  <View className="flex-1">
                    <Text className="text-gray-500 text-xs mb-1">Batch No.</Text>
                    <TextInput
                      value={item.batch_number ?? ''}
                      onChangeText={(v) => updateItem(idx, 'batch_number', v)}
                      placeholder="BT2024"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-500 text-xs mb-1">Expiry (YYYY-MM-DD)</Text>
                    <TextInput
                      value={item.expiry_date ?? ''}
                      onChangeText={(v) => updateItem(idx, 'expiry_date', v)}
                      placeholder="2026-12-31"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
