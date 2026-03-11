import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { doctorApi, shopApi } from '../../api/client';

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
  experience_years: number;
  distance_km?: number;
  chambers?: { consultation_fee: number; shop: { shop_name: string; city: string } }[];
}

interface NearbyShop {
  id: string;
  shop_name: string;
  address_line: string;
  city: string;
  pin_code: string;
  contact_phone: string;
  latitude?: number;
  longitude?: number;
}

export default function SearchScreen() {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<'doctors' | 'shops'>(initialTab === 'shops' ? 'shops' : 'doctors');
  const [query, setQuery] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const router = useRouter();

  // Auto-fetch location when shops tab is active
  useEffect(() => {
    if (activeTab === 'shops' && !location) {
      fetchLocation();
    }
  }, [activeTab]);

  const fetchLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Location permission is needed to find nearby shops.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert('Error', 'Could not get your location. Please try again.');
    } finally {
      setLocLoading(false);
    }
  };

  const { data: doctors, isLoading: doctorsLoading } = useQuery<Doctor[]>({
    queryKey: ['doctor-search', query, pinCode],
    queryFn: () =>
      doctorApi.search({ q: query || undefined, pin_code: pinCode || undefined }).then((r) => r.data.data as Doctor[]),
    enabled: activeTab === 'doctors' && !!(query || pinCode),
  });

  const { data: shops, isLoading: shopsLoading } = useQuery<NearbyShop[]>({
    queryKey: ['nearby-shops', location?.lat, location?.lng],
    queryFn: () =>
      shopApi.getNearby({ lat: location!.lat, lng: location!.lng, radius: 10 }).then((r) => r.data.data as NearbyShop[]),
    enabled: activeTab === 'shops' && !!location,
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900 mb-3">Find Care</Text>

        {/* Tabs */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 mb-3">
          {(['doctors', 'shops'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`text-sm font-semibold ${activeTab === tab ? 'text-sky-600' : 'text-gray-500'}`}>
                {tab === 'doctors' ? '👨‍⚕️ Doctors' : '💊 Nearby Shops'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'doctors' ? (
          <>
            <TextInput
              className="bg-gray-100 rounded-xl px-4 h-11 text-base text-gray-900 mb-2"
              placeholder="Search by name or specialization..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
            />
            <TextInput
              className="bg-gray-100 rounded-xl px-4 h-11 text-base text-gray-900"
              placeholder="Filter by pin code (optional)"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={6}
              value={pinCode}
              onChangeText={setPinCode}
            />
          </>
        ) : (
          <View className="flex-row items-center gap-2">
            <View className="flex-1 bg-gray-100 rounded-xl px-4 h-11 justify-center">
              <Text className="text-gray-500 text-sm">
                {location
                  ? `📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : locLoading ? 'Getting location…' : 'Location not set'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={fetchLocation}
              disabled={locLoading}
              className="bg-sky-500 h-11 px-4 rounded-xl items-center justify-center"
            >
              {locLoading
                ? <ActivityIndicator size="small" color="white" />
                : <Text className="text-white text-sm font-semibold">Refresh</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Results */}
      {activeTab === 'doctors' ? (
        doctorsLoading ? (
          <ActivityIndicator className="mt-8" color="#0EA5E9" />
        ) : (
          <FlatList
            data={doctors ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View className="items-center mt-12">
                <Text className="text-4xl mb-3">🔍</Text>
                <Text className="text-gray-400 text-sm">
                  {query || pinCode ? 'No doctors found' : 'Search for doctors above'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
                onPress={() => router.push({ pathname: '/(patient)/doctor/[id]', params: { id: item.id } } as any)}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900 text-base">{item.full_name}</Text>
                    <Text className="text-sky-600 text-sm mt-0.5">{item.specialization}</Text>
                    <Text className="text-gray-400 text-xs mt-1">{item.experience_years} yrs exp</Text>
                    {item.chambers?.[0] && (
                      <Text className="text-gray-500 text-xs mt-1">
                        📍 {item.chambers[0].shop.shop_name}, {item.chambers[0].shop.city}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-emerald-600 font-semibold">
                      {item.chambers?.[0]?.consultation_fee != null ? `₹${item.chambers[0].consultation_fee}` : ''}
                    </Text>
                    {item.distance_km != null && (
                      <Text className="text-gray-400 text-xs mt-1">{item.distance_km.toFixed(1)} km</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        locLoading || shopsLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#0EA5E9" size="large" />
            <Text className="text-gray-400 text-sm mt-3">{locLoading ? 'Getting your location…' : 'Finding nearby shops…'}</Text>
          </View>
        ) : !location ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-4">📍</Text>
            <Text className="text-gray-700 font-semibold text-base text-center mb-2">Location Required</Text>
            <Text className="text-gray-400 text-sm text-center mb-6">Allow location access to find medical shops near you</Text>
            <TouchableOpacity onPress={fetchLocation} className="bg-sky-500 px-8 py-3 rounded-xl">
              <Text className="text-white font-semibold">Enable Location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={shops ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View className="items-center mt-12">
                <Text className="text-4xl mb-3">💊</Text>
                <Text className="text-gray-400 text-sm">No shops found within 10 km</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <Text className="font-semibold text-gray-900 text-base">{item.shop_name}</Text>
                <Text className="text-gray-500 text-sm mt-1">📍 {item.address_line}, {item.city} - {item.pin_code}</Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${item.contact_phone}`)}
                  className="mt-2 flex-row items-center gap-1"
                >
                  <Text className="text-sky-500 text-sm">📞 {item.contact_phone}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )
      )}
    </SafeAreaView>
  );
}
