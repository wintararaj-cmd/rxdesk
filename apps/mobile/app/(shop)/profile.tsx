import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { shopApi, authApi, subscriptionApi, chamberApi } from '../../api/client';
import { useRouter } from 'expo-router';

interface ShopProfile { id: string; shop_name: string; address_line: string; city: string; state: string; pin_code: string; contact_phone?: string; drug_license_no: string; verification_status: string; shop_type: string; }
interface Subscription { id: string; status: 'trial' | 'active' | 'expired' | 'cancelled'; trial_ends_at?: string | null; current_period_end?: string | null; plan: { name: string; price_monthly: number }; }
interface Plan { id: string; name: string; price_monthly: number; max_doctors: number; max_appointments_per_month: number; max_sessions: number; features?: Record<string, unknown> | null; }
interface PendingChamber { id: string; consultation_fee: number; status: string; doctor: { full_name: string; specialization: string } | null; }

export default function ShopProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [showPlans, setShowPlans] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const { data: shop, isLoading } = useQuery<ShopProfile>({
    queryKey: ['my-shop-profile'],
    queryFn: () => shopApi.getMyShop().then((r) => r.data.data),
    onSuccess: (d: ShopProfile) => setForm({ shop_name: d.shop_name ?? '', address_line: d.address_line ?? '', city: d.city ?? '', state: d.state ?? '', pin_code: d.pin_code ?? '', contact_phone: d.contact_phone ?? '' }),
  } as any);

  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: ['shop-subscription'],
    queryFn: () => subscriptionApi.getCurrent().then((r) => r.data.data ?? null),
  });

  const { data: pendingChambers = [] } = useQuery<PendingChamber[]>({
    queryKey: ['shop-pending-chambers'],
    queryFn: () => chamberApi.getShopChambers('pending').then((r) => r.data.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => chamberApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-pending-chambers'] });
      qc.invalidateQueries({ queryKey: ['my-shop-profile'] });
      Alert.alert('Approved', 'Doctor has been added to your shop.');
    },
    onError: () => Alert.alert('Error', 'Could not approve the request.'),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionApi.getPlans().then((r) => r.data.data ?? []),
  });

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    try {
      const res = await subscriptionApi.subscribe(planId);
      const data = res.data.data;
      if (data.dev_mode) {
        qc.invalidateQueries({ queryKey: ['shop-subscription'] });
        setShowPlans(false);
        Alert.alert('Activated', 'Subscription activated (dev mode).');
      } else if (data.short_url) {
        setShowPlans(false);
        await Linking.openURL(data.short_url);
      }
    } catch {
      Alert.alert('Error', 'Could not initiate subscription. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  const updateMutation = useMutation({
    mutationFn: (data: object) => shopApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-shop-profile'] });
      qc.invalidateQueries({ queryKey: ['my-shop'] });
      setEditing(false);
    },
    onError: () => Alert.alert('Error', 'Could not update shop profile.'),
  });

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* noop */ }
    await clearAuth();
    router.replace('/(auth)/login');
  };

  if (isLoading) return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#8B5CF6" /></View>;

  const vStatus = shop?.verification_status;

  const FIELDS = [
    { key: 'shop_name', label: 'Shop Name' },
    { key: 'contact_phone', label: 'Shop Phone', keyboardType: 'number-pad' as const },
    { key: 'address_line', label: 'Address', multiline: true },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pin_code', label: 'PIN Code', keyboardType: 'number-pad' as const },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-violet-600 px-6 pt-5 pb-8 items-center">
          <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3">
            <Text className="text-4xl">💊</Text>
          </View>
          <Text className="text-white text-xl font-bold text-center">{shop?.shop_name ?? 'My Shop'}</Text>
          <Text className="text-violet-200 text-sm mt-1">{shop?.city}</Text>

          <View className={`mt-3 px-4 py-1 rounded-full ${vStatus === 'approved' ? 'bg-white/20' : vStatus === 'pending' ? 'bg-amber-400/40' : 'bg-red-400/40'}`}>
            <Text className="text-white text-xs font-semibold">
              {vStatus === 'approved' ? '✅ Verified' : vStatus === 'pending' ? '⏳ Verification Pending' : '❌ Rejected'}
            </Text>
          </View>
        </View>

        {/* Details card */}
        <View className="mx-4 -mt-4 bg-white rounded-2xl shadow-sm p-5 mb-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-semibold text-gray-900">Shop Details</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text className="text-violet-500 text-sm font-medium">{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {/* License (read-only) */}
          <View className="mb-3">
            <Text className="text-xs text-gray-400 mb-1">Drug License No.</Text>
            <Text className="text-gray-900 text-sm">{shop?.drug_license_no}</Text>
          </View>

          {FIELDS.map(({ key, label, keyboardType, multiline }) => (
            <View key={key} className="mb-3">
              <Text className="text-xs text-gray-400 mb-1">{label}</Text>
              {editing
                ? <TextInput
                    className={`border border-gray-200 rounded-xl px-3 text-gray-900 text-sm ${multiline ? 'h-16 pt-2' : 'h-10'}`}
                    value={form[key] ?? ''}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    onChangeText={(v) => setForm({ ...form, [key]: v })}
                  />
                : <Text className="text-gray-900 text-sm">{form[key] || <Text className="text-gray-400">Not set</Text>}</Text>
              }
            </View>
          ))}

          <View className="mb-3">
            <Text className="text-xs text-gray-400 mb-1">Owner Mobile</Text>
            <Text className="text-gray-900 text-sm">{user?.phone}</Text>
          </View>

          {editing && (
            <TouchableOpacity
              className="bg-violet-600 h-11 rounded-xl items-center justify-center mt-2"
              onPress={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-semibold">Save Changes</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Pending Doctor Requests */}
        {pendingChambers.length > 0 && (
          <View className="mx-4 bg-white rounded-2xl shadow-sm p-5 mb-4">
            <Text className="font-semibold text-gray-900 mb-3">⏳ Pending Doctor Requests ({pendingChambers.length})</Text>
            {pendingChambers.map((c) => (
              <View key={c.id} className="flex-row items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <View className="flex-1 mr-3">
                  <Text className="font-medium text-gray-900">{c.doctor?.full_name ?? 'Doctor'}</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">{c.doctor?.specialization} · Fee: ₹{c.consultation_fee}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    'Approve Doctor',
                    `Approve Dr. ${c.doctor?.full_name ?? ''} to see patients at your shop?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Approve', onPress: () => approveMutation.mutate(c.id) },
                    ]
                  )}
                  className="bg-emerald-500 px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-white text-xs font-semibold">Approve</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Subscription info */}
        <View className="mx-4 bg-white rounded-2xl shadow-sm p-5 mb-4">
          <Text className="font-semibold text-gray-900 mb-3">Subscription</Text>
          {subscription ? (() => {
            const statusColors: Record<string, string> = {
              trial: 'text-violet-700',
              active: 'text-green-700',
              cancelled: 'text-red-600',
              expired: 'text-gray-500',
            };
            const bgColors: Record<string, string> = {
              trial: 'bg-violet-50 border-violet-200',
              active: 'bg-green-50 border-green-200',
              cancelled: 'bg-red-50 border-red-200',
              expired: 'bg-gray-50 border-gray-200',
            };
            const icons: Record<string, string> = { trial: '🚀', active: '✅', cancelled: '❌', expired: '⏰' };
            const expiryDate = subscription.current_period_end ?? subscription.trial_ends_at;
            const expiryLabel = subscription.status === 'trial' ? 'Trial ends' :
              subscription.status === 'active' ? 'Renews' : 'Ended';
            return (
              <View className={`rounded-xl p-3 border ${bgColors[subscription.status] ?? 'bg-gray-50 border-gray-200'}`}>
                <View className="flex-row justify-between items-center">
                  <Text className={`font-semibold text-sm ${statusColors[subscription.status] ?? 'text-gray-700'}`}>
                    {icons[subscription.status]} {subscription.plan.name}
                  </Text>
                  <View className="bg-white/60 px-2 py-0.5 rounded-full">
                    <Text className={`text-xs font-semibold capitalize ${statusColors[subscription.status] ?? 'text-gray-500'}`}>
                      {subscription.status}
                    </Text>
                  </View>
                </View>
                {expiryDate && (
                  <Text className="text-gray-500 text-xs mt-1.5">
                    {expiryLabel}: {new Date(expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
                <Text className="text-gray-400 text-xs mt-0.5">₹{subscription.plan.price_monthly}/month</Text>
                {['expired', 'cancelled'].includes(subscription.status) && (
                  <TouchableOpacity
                    onPress={() => setShowPlans(true)}
                    className="mt-3 bg-violet-600 h-9 rounded-lg items-center justify-center"
                  >
                    <Text className="text-white font-semibold text-sm">Renew Subscription</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })() : (
            <View className="bg-violet-50 rounded-xl p-3 border border-violet-200">
              <Text className="text-violet-700 font-semibold text-sm">🚀 Free Trial</Text>
              <Text className="text-violet-500 text-xs mt-1">Upgrade to Premium for SMS reminders, advanced analytics, and more.</Text>
              <TouchableOpacity
                onPress={() => setShowPlans(true)}
                className="mt-3 bg-violet-600 h-9 rounded-lg items-center justify-center"
              >
                <Text className="text-white font-semibold text-sm">View Plans</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Logout */}
        <View className="mx-4 bg-white rounded-2xl shadow-sm p-5 mb-6">
          <TouchableOpacity onPress={handleLogout} className="py-2">
            <Text className="text-red-500 font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Plans modal */}
      <Modal visible={showPlans} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPlans(false)}>
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
            <Text className="text-lg font-bold text-gray-900">Choose a Plan</Text>
            <TouchableOpacity onPress={() => setShowPlans(false)}><Text className="text-violet-600 font-medium">Close</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {plans.length === 0 && <Text className="text-gray-400 text-center mt-8">No plans available.</Text>}
            {plans.map((plan) => (
              <View key={plan.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <Text className="text-base font-bold text-gray-900">{plan.name}</Text>
                <Text className="text-2xl font-bold text-violet-600 mt-1">₹{plan.price_monthly}<Text className="text-sm font-normal text-gray-400">/month</Text></Text>
                <View className="mt-3 gap-1">
                  <Text className="text-gray-600 text-sm">✓ Up to {plan.max_doctors} doctor{plan.max_doctors !== 1 ? 's' : ''}</Text>
                  <Text className="text-gray-600 text-sm">✓ {plan.max_appointments_per_month >= 99999 ? 'Unlimited' : plan.max_appointments_per_month} appointments/month</Text>
                  <Text className="text-gray-600 text-sm">✓ {plan.max_sessions} active session{plan.max_sessions !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity
                  className="mt-4 bg-violet-600 h-11 rounded-xl items-center justify-center disabled:opacity-50"
                  onPress={() => handleSubscribe(plan.id)}
                  disabled={subscribing !== null}
                >
                  {subscribing === plan.id
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-semibold">Subscribe</Text>
                  }
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
