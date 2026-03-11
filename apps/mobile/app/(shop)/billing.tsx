import { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { prescriptionApi, billApi } from '../../api/client';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface BillItem { id: string; medicine_name: string; quantity: number; mrp: number; line_total: number; }
interface Bill {
  id: string;
  bill_number: string;
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_status: string;
  items: BillItem[];
  patient?: { full_name?: string; phone?: string };
}

export default function ShopBillingScreen() {
  const [qrContent, setQrContent] = useState('');
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const verifyMutation = useMutation({
    mutationFn: (qr: string) => prescriptionApi.verifyQR(qr),
    onSuccess: (res) => {
      const data = res.data.data;
      const pid = data?.prescription?.id ?? data?.id;
      if (pid) {
        setPrescriptionId(pid);
      } else {
        Alert.alert('Invalid', 'QR code not recognized.');
      }
    },
    onError: () => Alert.alert('Invalid QR', 'This prescription QR is invalid or has been tampered.'),
  });

  const generateMutation = useMutation({
    mutationFn: (pid: string) => billApi.generate(pid),
    onSuccess: (res) => setBill(res.data.data as Bill),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.error?.message ?? 'Could not generate bill.'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => billApi.markPaid(id, method),
    onSuccess: (res) => {
      setBill(res.data.data as Bill);
      Alert.alert('✅ Payment Recorded', `Bill ${bill?.bill_number} marked as paid.`);
    },
  });

  const reset = () => { setQrContent(''); setPrescriptionId(null); setBill(null); verifyMutation.reset(); generateMutation.reset(); };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
        <Text className="text-xl font-bold text-gray-900">Billing</Text>
        {bill && <TouchableOpacity onPress={reset}><Text className="text-violet-600 text-sm">New Bill</Text></TouchableOpacity>}
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {!bill ? (
          <>
            {/* QR input */}
            <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <Text className="font-semibold text-gray-900 mb-3">Step 1: Verify Prescription QR</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm h-20"
                placeholder="Paste the QR code content here, or use a QR scanner…"
                placeholderTextColor="#9CA3AF"
                multiline
                value={qrContent}
                onChangeText={setQrContent}
              />
              <View className="flex-row gap-2 mt-3">
                <TouchableOpacity
                  onPress={() => { if (!permission?.granted) requestPermission(); setShowScanner(true); }}
                  className="flex-1 h-11 rounded-xl items-center justify-center bg-violet-100 border border-violet-200"
                >
                  <Text className="text-violet-700 font-semibold text-sm">📷 Scan QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => verifyMutation.mutate(qrContent)}
                  disabled={!qrContent.trim() || verifyMutation.isPending}
                  className={`flex-1 h-11 rounded-xl items-center justify-center ${qrContent.trim() ? 'bg-violet-600' : 'bg-gray-200'}`}
                >
                  {verifyMutation.isPending
                    ? <ActivityIndicator color="white" />
                    : <Text className={`font-semibold text-sm ${qrContent.trim() ? 'text-white' : 'text-gray-400'}`}>Verify</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Step 2 */}
            {prescriptionId && (
              <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
                <Text className="font-semibold text-gray-900 mb-1">Step 2: Generate Bill</Text>
                <Text className="text-gray-400 text-xs mb-3">Prescription verified ✅ — stock will be deducted automatically</Text>
                <TouchableOpacity
                  onPress={() => generateMutation.mutate(prescriptionId)}
                  disabled={generateMutation.isPending}
                  className="bg-emerald-500 h-11 rounded-xl items-center justify-center"
                >
                  {generateMutation.isPending
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-semibold text-sm">Generate Bill & Deduct Stock</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          /* Bill display */
          <View className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            {/* Bill header */}
            <View className="bg-violet-50 px-5 py-4">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="font-bold text-gray-900 text-base">{bill.bill_number}</Text>
                  <Text className="text-gray-500 text-sm mt-0.5">{bill.patient?.full_name ?? bill.patient?.phone ?? 'Patient'}</Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${bill.payment_status === 'paid' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  <Text className={`text-xs font-semibold capitalize ${bill.payment_status === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {bill.payment_status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Items */}
            <View className="px-5 py-3">
              {bill.items.map((item) => (
                <View key={item.id} className="flex-row justify-between py-2 border-b border-gray-50">
                  <View className="flex-1">
                    <Text className="text-gray-900 text-sm">{item.medicine_name}</Text>
                    <Text className="text-gray-400 text-xs">Qty: {item.quantity} × ₹{item.mrp}</Text>
                  </View>
                  <Text className="text-gray-900 text-sm font-medium">₹{item.line_total}</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View className="px-5 pb-4 pt-2">
              <View className="flex-row justify-between py-1">
                <Text className="text-gray-500 text-sm">Subtotal</Text>
                <Text className="text-gray-700 text-sm">₹{bill.subtotal}</Text>
              </View>
              {bill.discount_amount > 0 && (
                <View className="flex-row justify-between py-1">
                  <Text className="text-gray-500 text-sm">Discount</Text>
                  <Text className="text-emerald-600 text-sm">-₹{bill.discount_amount}</Text>
                </View>
              )}
              <View className="flex-row justify-between py-1">
                <Text className="text-gray-500 text-sm">GST (18%)</Text>
                <Text className="text-gray-700 text-sm">₹{bill.gst_amount}</Text>
              </View>
              <View className="flex-row justify-between pt-3 border-t border-gray-100 mt-2">
                <Text className="font-bold text-gray-900 text-base">Total</Text>
                <Text className="font-bold text-gray-900 text-base">₹{bill.total_amount}</Text>
              </View>
            </View>

            {/* Payment buttons */}
            {bill.payment_status !== 'paid' && (
              <View className="px-5 pb-5">
                <Text className="text-xs text-gray-400 mb-2 text-center">Select payment method:</Text>
                <View className="flex-row gap-2">
                  {['cash', 'upi', 'card'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => payMutation.mutate({ id: bill.id, method })}
                      disabled={payMutation.isPending}
                      className="flex-1 border-2 border-violet-200 rounded-xl py-3 items-center"
                    >
                      <Text className="text-2xl mb-0.5">{method === 'cash' ? '💵' : method === 'upi' ? '📱' : '💳'}</Text>
                      <Text className="text-violet-700 text-xs font-semibold uppercase">{method}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Scan Prescription QR</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Text style={{ color: 'white', fontSize: 16 }}>Close ✕</Text>
            </TouchableOpacity>
          </View>
          {permission?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : ({ data }) => {
                setScanned(true);
                setShowScanner(false);
                setQrContent(data);
                setTimeout(() => setScanned(false), 2000);
              }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Text style={{ color: 'white', textAlign: 'center', marginBottom: 20 }}>Camera permission is required to scan QR codes.</Text>
              <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }]}>
            <View style={{ width: 224, height: 224, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 16 }} />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 16 }}>Align QR code within the frame</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
