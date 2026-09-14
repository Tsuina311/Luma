import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
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
import { useTheme } from '@/src/ui/theme';

type SettingsData = {
  preferences: Preferences;
  permission: NotificationPermissionState;
  profileName: string;
};

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
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
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>A few defaults. Nothing more.</Text>
      </View>
      {!data && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => { setError(undefined); setRequest((value) => value + 1); }} />
      ) : data ? (
        <>
          <SectionTitle>Reminders</SectionTitle>
          <SettingRow label="Notification permission" value={permissionLabel(data.permission)} />
          {data.permission !== 'granted' && data.permission !== 'unavailable' ? (
            <Button variant="secondary" onPress={() => void handleNotifications()}>
              {data.permission === 'denied' ? 'Open system settings' : 'Enable notifications'}
            </Button>
          ) : null}
          <Divider />

          <SectionTitle>Calendar</SectionTitle>
          <SettingRow label="Week starts" value={data.preferences.weekStartsOn === 1 ? 'Monday' : 'Sunday'} />
          <View style={styles.actions}>
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
          <SettingRow label="Time format" value={data.preferences.timeFormat === '24h' ? '24 hour' : '12 hour'} />
          <View style={styles.actions}>
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
          <SettingRow label="Default urgency profile" value={data.profileName} />
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Additional profile editing is the immediate follow-up; the data model already supports it.
          </Text>

          {__DEV__ ? (
            <>
              <Divider />
              <SectionTitle>Development</SectionTitle>
              <Button variant="secondary" onPress={() => void seed()}>Add sample data</Button>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.textMuted }]}>{value}</Text>
    </View>
  );
}

function permissionLabel(permission: NotificationPermissionState): string {
  if (permission === 'granted') return 'Allowed';
  if (permission === 'denied') return 'Denied';
  if (permission === 'unavailable') return 'Unavailable on web';
  return 'Not requested';
}

const styles = StyleSheet.create({
  heading: { gap: 4, marginBottom: 4 },
  title: { fontSize: 31, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, gap: 16 },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  rowValue: { fontSize: 15 },
  actions: { flexDirection: 'row', gap: 10 },
  note: { fontSize: 13, lineHeight: 19 },
});
