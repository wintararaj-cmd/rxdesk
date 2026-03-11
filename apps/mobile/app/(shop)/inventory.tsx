import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/client';
import { ScrollView } from 'react-native';

interface InventoryItem {
  id: string;
  medicine_name: string;
  medicine?: { name?: string; generic_name?: string; form?: string; strength?: string };
  stock_qty: number;
  reorder_level: number;
  mrp: number;
  expiry_date?: string;
  batch_number?: string;
}

const DEFAULT_FORM = { medicine_name: '', stock_qty: '', reorder_level: '10', mrp: '', purchase_price: '', batch_number: '', expiry_date: '' };

export default function ShopInventoryScreen() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editQty, setEditQty] = useState('');

  const { data: items = [], isLoading, refetch, isRefetching } = useQuery<InventoryItem[]>({
    queryKey: ['shop-inventory'],
    queryFn: () => inventoryApi.list().then((r) => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: object) => inventoryApi.add(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-inventory'] }); setShowAdd(false); setForm({ ...DEFAULT_FORM }); },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.error?.message ?? 'Could not add item.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => inventoryApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-inventory'] }); setEditItem(null); },
    onError: () => Alert.alert('Error', 'Could not update stock.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-inventory'] }),
  });

  const filtered = items.filter((item) => {
    const name = (item.medicine?.name ?? item.medicine_name ?? '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const lowStockCount = items.filter((i) => i.stock_qty <= i.reorder_level).length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
        <View>
          <Text className="text-xl font-bold text-gray-900">Inventory</Text>
          {lowStockCount > 0 && (
            <Text className="text-red-500 text-xs mt-0.5">⚠️ {lowStockCount} item{lowStockCount > 1 ? 's' : ''} low on stock</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowAdd(true)} className="bg-violet-600 px-4 py-2 rounded-xl">
          <Text className="text-white text-sm font-semibold">+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="px-4 py-2 bg-white border-b border-gray-100">
        <TextInput
          className="bg-gray-100 rounded-xl px-4 h-10 text-sm text-gray-900"
          placeholder="Search medicines…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#8B5CF6" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-5xl mb-4">📦</Text>
              <Text className="text-gray-400 text-base">{search ? 'No results' : 'Inventory is empty'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isLow = item.stock_qty <= item.reorder_level;
            return (
              <View className={`bg-white rounded-2xl px-4 py-3 border ${isLow ? 'border-red-200 bg-red-50' : 'border-gray-100'} shadow-sm`}>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900 text-sm">
                      {item.medicine_name}
                    </Text>
                    {item.medicine?.generic_name && (
                      <Text className="text-gray-400 text-xs mt-0.5">{item.medicine.generic_name}</Text>
                    )}
                    <Text className="text-gray-500 text-xs mt-1">
                      Batch: {item.batch_number ?? '—'} · Exp: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—'}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className={`font-bold text-base ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.stock_qty}</Text>
                    <Text className="text-gray-400 text-xs">units</Text>
                    <Text className="text-violet-600 text-sm font-medium mt-1">₹{item.mrp}</Text>
                  </View>
                </View>

                {isLow && (
                  <Text className="text-red-500 text-xs mt-1.5">⚠️ Low stock (reorder at {item.reorder_level})</Text>
                )}

                <View className="flex-row gap-2 mt-3 pt-2.5 border-t border-gray-100">
                  <TouchableOpacity
                    onPress={() => { setEditItem(item); setEditQty(String(item.stock_qty)); }}
                    className="flex-1 bg-violet-50 border border-violet-200 py-1.5 rounded-lg items-center"
                  >
                    <Text className="text-violet-600 text-xs font-semibold">Update Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Remove Item', 'Remove this item from inventory?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
                    ])}
                    className="flex-1 bg-red-50 border border-red-200 py-1.5 rounded-lg items-center"
                  >
                    <Text className="text-red-500 text-xs font-semibold">Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add item modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-5 pt-4 pb-3 border-b border-gray-100 flex-row justify-between">
            <Text className="text-lg font-bold text-gray-900">Add Inventory Item</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Text className="text-gray-400">Cancel</Text></TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-5 pt-4">
            {[
              { key: 'medicine_name', label: 'Medicine Name *', placeholder: 'e.g. Paracetamol 500mg' },
              { key: 'stock_qty', label: 'Current Stock *', placeholder: '0', keyboardType: 'number-pad' as const },
              { key: 'reorder_level', label: 'Reorder Level', placeholder: '10', keyboardType: 'number-pad' as const },
              { key: 'mrp', label: 'MRP / Selling Price (₹) *', placeholder: '0.00', keyboardType: 'numeric' as const },
              { key: 'purchase_price', label: 'Purchase Price (₹)', placeholder: '0.00', keyboardType: 'numeric' as const },
              { key: 'batch_number', label: 'Batch Number', placeholder: 'Batch no.' },
              { key: 'expiry_date', label: 'Expiry Date (YYYY-MM-DD)', placeholder: '2026-12-31' },
            ].map(({ key, label, placeholder, keyboardType }) => (
              <View key={key} className="mb-3">
                <Text className="text-xs font-medium text-gray-600 mb-1">{label}</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-3 h-11 text-sm text-gray-900"
                  placeholder={placeholder}
                  placeholderTextColor="#9CA3AF"
                  keyboardType={keyboardType ?? 'default'}
                  value={form[key as keyof typeof form]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                />
              </View>
            ))}
          </ScrollView>
          <View className="px-5 py-4 border-t border-gray-100">
            <TouchableOpacity
              className="bg-violet-600 h-13 rounded-xl items-center justify-center py-3"
              onPress={() => addMutation.mutate({
                ...form,
                stock_qty: Number(form.stock_qty),
                reorder_level: Number(form.reorder_level) || 10,
                mrp: Number(form.mrp),
                purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
              })}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">Add to Inventory</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Update stock modal */}
      <Modal visible={!!editItem} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
            <Text className="text-base font-bold text-gray-900 mb-1">Update Stock</Text>
            <Text className="text-gray-500 text-sm mb-4">{editItem?.medicine?.name ?? editItem?.medicine_name}</Text>
            <TextInput
              className="border-2 border-violet-400 rounded-xl px-4 h-14 text-xl text-center font-bold text-gray-900 mb-4"
              keyboardType="number-pad"
              value={editQty}
              onChangeText={setEditQty}
              autoFocus
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setEditItem(null)} className="flex-1 border border-gray-200 py-3 rounded-xl items-center">
                <Text className="text-gray-500 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateMutation.mutate({ id: editItem!.id, data: { stock_qty: Number(editQty) } })}
                disabled={updateMutation.isPending}
                className="flex-1 bg-violet-600 py-3 rounded-xl items-center"
              >
                {updateMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
