import { Suspense, useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { migrateDatabase } from '@/src/db/migrations';
import { DataRefreshProvider } from '@/src/hooks/useDataRefresh';
import { configureForegroundNotifications, reconcileNotifications } from '@/src/services/notifications';
import { LoadingState } from '@/src/components/ui';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import { SafeAreaListener } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';
import { VisualModeProvider } from '@/src/ui/VisualModeProvider';
import { useSystemAppearance } from '@/src/ui/useSystemAppearance';
import { BloomBackground } from '@/src/ui/BloomBackground';
import { resetDevelopmentData } from '@/src/services/developmentSeed';


export { ErrorBoundary } from 'expo-router';

configureForegroundNotifications();

export default function RootLayout() {
  return (
    <SafeAreaListener
      onChange={({ insets }) => {
        Uniwind.updateInsets(insets);
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GluestackUIProvider mode="system" manageTheme={false}>
          <Suspense fallback={<LoadingState />}>
            <SQLiteProvider databaseName="luma.db" onInit={initializeDatabase} useSuspense>
              <DataRefreshProvider>
                <VisualModeProvider>
                  <ThemedApp />
                </VisualModeProvider>
              </DataRefreshProvider>
            </SQLiteProvider>
          </Suspense>
        </GluestackUIProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}

async function initializeDatabase(db: SQLiteDatabase) {
  try {
    await migrateDatabase(db);
    await ensureAutoVisualModePreference(db);
    if (__DEV__) await resetDevelopmentData(db);
  } catch (error) {
    console.error('Database initialization failed', error);
    throw error;
  }
}

/** Move legacy locked-green installs onto auto once. */
async function ensureAutoVisualModePreference(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value_json: string }>(
    'SELECT value_json FROM settings WHERE key = ?',
    'preferences',
  );
  if (!row) return;
  const raw = JSON.parse(row.value_json) as Record<string, unknown>;
  if (raw.visualModeAutoMigrated === true) return;
  raw.visualMode = 'auto';
  raw.visualModeAutoMigrated = true;
  await db.runAsync(
    'UPDATE settings SET value_json = ?, updated_at = ? WHERE key = ?',
    JSON.stringify(raw),
    new Date().toISOString(),
    'preferences',
  );
}

function ThemedApp() {
  const colorScheme = useSystemAppearance();
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: 'transparent',
      card: 'transparent',
    },
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <BloomBackground />
      <ThemeProvider value={navigationTheme}>
        <AppLifecycle />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 1 }}>

          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: 'transparent' },
              headerTransparent: true,
              headerTintColor: '#F7F1DF',
              headerShadowVisible: false,
              headerTitleStyle: { fontSize: 17, fontWeight: '600', color: '#F7F1DF' },
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="deadline/new" options={{ title: 'New deadline', presentation: 'modal' }} />
            <Stack.Screen name="deadline/[id]" options={{ title: 'Deadline' }} />
            <Stack.Screen name="habit/new" options={{ title: 'New habit', presentation: 'modal' }} />
            <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
          </Stack>
        </View>
      </ThemeProvider>
    </View>
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
