import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { notificationApi } from '../api/client';

// Configure notification handling behaviour while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function hasNotificationPermission(): Promise<boolean> {
  // expo-modules-core PermissionResponse includes `granted: boolean`
  const existing = await Notifications.getPermissionsAsync() as unknown as { granted: boolean };
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync() as unknown as { granted: boolean };
  return requested.granted;
}

/**
 * Registers the device for Expo push notifications and syncs the token with
 * the backend.  Call this hook once from the root layout after the user has
 * authenticated.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function registerForPushTokenAsync() {
      const granted = await hasNotificationPermission();
      if (!granted) return; // User denied — fail silently

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B5CF6',
        });
      }

      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          (Constants as any)?.easConfig?.projectId;

        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );

        await notificationApi.registerPushToken(tokenData.data);
      } catch {
        // Non-fatal — emulators and simulators cannot get a push token; fail silently
      }
    }

    registerForPushTokenAsync();

    // Listen to incoming notifications while foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Future: update badge / in-app notification count
      }
    );

    // Listen for user tapping a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (_response) => {
        // Future: navigate to the relevant screen based on
        // _response.notification.request.content.data
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);
}
