import { useCallback, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Card } from '@/components/ui/card';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { SettingsRepository, type Preferences } from '@/src/db/repositories/settingsRepository';
import { Button, Divider, ErrorState, LoadingState, Screen, SectionTitle } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { seedDevelopmentData } from '@/src/services/developmentSeed';
import {
  getNotificationPermissionState,
  type NotificationPermissionState,
  reconcileNotifications,
  requestNotificationPermission,
} from '@/src/services/notifications';

type SettingsData = {
  preferences: Preferences;
  permission: NotificationPermissionState;
  profileName: string;
};

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { refresh } = useDataRefresh();
  const [data, setData] = useState<SettingsData>();
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);

  const load = useCallback(() => {
    let active = true;
    Promise.all([
      new SettingsRepository(db).getPreferences(),
      getNotificationPermissionState(),
      new DeadlineRepository(db).listProfiles(),
    ])
      .then(([preferences, permission, profiles]) => {
        if (active) {
          setData({
            preferences,
            permission,
            profileName: profiles.find((profile) => profile.id === preferences.defaultUrgencyProfileId)?.name ?? 'Normal',
          });
          setError(undefined);
        }
      })
      .catch(() => active && setError('Settings could not be loaded.'));
    return () => { active = false; };
  }, [db]);

  useFocusEffect(useCallback(() => {
    void request;
    return load();
  }, [load, request]));

  const updatePreferences = async (patch: Partial<Preferences>) => {
    if (!data) return;
    const preferences = { ...data.preferences, ...patch };
    try {
      await new SettingsRepository(db).savePreferences(preferences);
      setData({ ...data, preferences });
      refresh();
    } catch {
      setError('The setting could not be saved.');
    }
  };

  const handleNotifications = async () => {
    if (!data) return;
    if (data.permission === 'denied') {
      await Linking.openSettings();
      return;
    }
    const permission = await requestNotificationPermission();
    setData({ ...data, permission });
    if (permission === 'granted') void reconcileNotifications(db).catch(() => undefined);
  };

  const seed = async () => {
    const seeded = await seedDevelopmentData(db);
    if (seeded) {
      refresh();
      void reconcileNotifications(db).catch(() => undefined);
      Alert.alert('Sample data added', 'Open Attention to see a realistic local data set.');
    } else {
      Alert.alert('Nothing changed', 'Development data is available only in a development build with an empty database.');
    }
  };

  return (
    <Screen>
      <View className="gap-1 py-1">
        <Text className="text-xs font-extrabold uppercase tracking-[1.8px] text-primary">Make it yours</Text>
        <Text className="text-[32px] font-extrabold tracking-[-1px] text-foreground">Settings</Text>
        <Text className="text-sm text-muted-foreground">A few thoughtful defaults. Nothing more.</Text>
      </View>
      {!data && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => { setError(undefined); setRequest((value) => value + 1); }} />
      ) : data ? (
        <>
          <SectionTitle>Reminders</SectionTitle>
          <Card className="gap-3 rounded-3xl border-border bg-card p-4 shadow-sm">
            <SettingRow label="Notification permission" value={permissionLabel(data.permission)} />
            {data.permission === 'granted' ? (
              <View className="self-start rounded-full bg-urgency-green/10 px-3 py-1">
                <Text className="text-xs font-bold text-urgency-green">Ready</Text>
              </View>
            ) : null}
          {data.permission !== 'granted' && data.permission !== 'unavailable' ? (
            <Button variant="secondary" onPress={() => void handleNotifications()}>
              {data.permission === 'denied' ? 'Open system settings' : 'Enable notifications'}
            </Button>
          ) : null}
          </Card>

          <SectionTitle>Calendar</SectionTitle>
          <Card className="gap-4 rounded-3xl border-border bg-card p-4 shadow-sm">
            <SettingRow label="Week starts" value={data.preferences.weekStartsOn === 1 ? 'Monday' : 'Sunday'} />
            <View className="flex-row gap-2">
              <Button
                variant={data.preferences.weekStartsOn === 1 ? 'primary' : 'secondary'}
                onPress={() => void updatePreferences({ weekStartsOn: 1 })}
              >
                Monday
              </Button>
              <Button
                variant={data.preferences.weekStartsOn === 0 ? 'primary' : 'secondary'}
                onPress={() => void updatePreferences({ weekStartsOn: 0 })}
              >
                Sunday
              </Button>
            </View>
            <Divider />
            <SettingRow label="Time format" value={data.preferences.timeFormat === '24h' ? '24 hour' : '12 hour'} />
            <View className="flex-row gap-2">
              <Button
                variant={data.preferences.timeFormat === '24h' ? 'primary' : 'secondary'}
                onPress={() => void updatePreferences({ timeFormat: '24h' })}
              >
                24 hour
              </Button>
              <Button
                variant={data.preferences.timeFormat === '12h' ? 'primary' : 'secondary'}
                onPress={() => void updatePreferences({ timeFormat: '12h' })}
              >
                12 hour
              </Button>
            </View>
            <Divider />
            <SettingRow label="Default urgency profile" value={data.profileName} />
            <Text className="text-sm leading-5 text-muted-foreground">
              Additional profile editing is coming next. Every deadline already keeps its profile independently.
            </Text>
          </Card>

          {__DEV__ ? (
            <>
              <SectionTitle>Development</SectionTitle>
              <Card className="rounded-3xl border-border bg-card p-4 shadow-sm">
                <Button variant="secondary" onPress={() => void seed()}>Add sample data</Button>
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-10 flex-row items-center justify-between gap-4">
      <Text className="flex-1 text-base font-semibold text-foreground">{label}</Text>
      <Text className="text-sm font-medium text-muted-foreground">{value}</Text>
    </View>
  );
}

function permissionLabel(permission: NotificationPermissionState): string {
  if (permission === 'granted') return 'Allowed';
  if (permission === 'denied') return 'Denied';
  if (permission === 'unavailable') return 'Unavailable on web';
  return 'Not requested';
}
