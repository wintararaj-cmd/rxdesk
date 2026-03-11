import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="set-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="select-role" />
      <Stack.Screen name="setup-profile" />
    </Stack>
  );
}
