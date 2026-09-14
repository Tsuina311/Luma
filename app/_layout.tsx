import { Suspense, useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { migrateDatabase } from '@/src/db/migrations';
import { DataRefreshProvider } from '@/src/hooks/useDataRefresh';
import { configureForegroundNotifications, reconcileNotifications } from '@/src/services/notifications';
import { LoadingState } from '@/src/components/ui';

export { ErrorBoundary } from 'expo-router';

configureForegroundNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <Suspense fallback={<LoadingState />}>
      <SQLiteProvider databaseName="luma.db" onInit={migrateDatabase} useSuspense>
        <DataRefreshProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AppLifecycle />
            <StatusBar style="auto" />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="deadline/new" options={{ title: 'New deadline', presentation: 'modal' }} />
              <Stack.Screen name="deadline/[id]" options={{ title: 'Deadline' }} />
              <Stack.Screen name="habit/new" options={{ title: 'New habit', presentation: 'modal' }} />
              <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
            </Stack>
          </ThemeProvider>
        </DataRefreshProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

function AppLifecycle() {
  const db = useSQLiteContext();
  const router = useRouter();

  useEffect(() => {
    const reconcile = () => {
      void reconcileNotifications(db).catch(() => {
        // Scheduling is best-effort; SQLite data remains authoritative.
      });
    };
    reconcile();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcile();
    });
    if (Platform.OS === 'web') return () => appStateSubscription.remove();

    const openNotification = (response: Notifications.NotificationResponse) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === 'string' && /^\/(deadline|habit)\/[^/]+$/.test(route)) {
        router.push(route as never);
      }
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotification(response);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    return () => {
      appStateSubscription.remove();
      responseSubscription.remove();
    };
  }, [db, router]);

  return null;
}
