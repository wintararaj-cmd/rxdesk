import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#DC2626',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FFFFFF', paddingBottom: 4, height: 58 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text> }} />
      <Tabs.Screen name="doctors" options={{ title: 'Doctors', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👨‍⚕️</Text> }} />
      <Tabs.Screen name="shops" options={{ title: 'Shops', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💊</Text> }} />
      <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👥</Text> }} />
    </Tabs>
  );
}
