import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import '../global.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RootGuard() {
  const { user, isHydrated, accessToken } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (accessToken && user && inAuthGroup && user.is_profile_complete !== false) {
      // Profile complete (or legacy users without the flag) — route to correct role group
      switch (user.role) {
        case 'patient':    router.replace('/(patient)'); break;
        case 'doctor':     router.replace('/(doctor)'); break;
        case 'shop_owner': router.replace('/(shop)'); break;
        case 'admin':      router.replace('/(admin)'); break;
        default:           router.replace('/(auth)/select-role'); break;
      }
    } else if (accessToken && !user && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [isHydrated, accessToken, user]);

  return null;
}

export default function RootLayout() {
  const { hydrateAuth, accessToken, user } = useAuthStore();

  useEffect(() => {
    hydrateAuth();
  }, []);

  usePushNotifications(!!accessToken && !!user);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(patient)" />
            <Stack.Screen name="(doctor)" />
            <Stack.Screen name="(shop)" />
            <Stack.Screen name="(admin)" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
