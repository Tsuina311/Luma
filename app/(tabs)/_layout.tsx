import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTransparent: true,
        headerTintColor: '#F7F1DF',
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: '#F7F1DF' },
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="habits" options={{ headerShown: true, title: 'Habits' }} />
      <Stack.Screen name="progress" options={{ headerShown: true, title: 'Progress' }} />
      <Stack.Screen name="bin" options={{ headerShown: true, title: 'Bin' }} />
    </Stack>
  );
}
