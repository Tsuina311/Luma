import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import {
  SettingsRepository,
  type Preferences,
  type VisualModePreference,
} from '@/src/db/repositories/settingsRepository';
import {
  Button,
  ErrorState,
  GroupSurface,
  LoadingState,
  SectionHeader,
  SegmentedControl,
  SettingRow,
  TactilePressable,
} from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { useVisualMode } from '@/src/ui/VisualModeProvider';
import { seedDevelopmentData } from '@/src/services/developmentSeed';
import {
  checkAndApplyUpdate,
  getAppReleaseInfo,
} from '@/src/services/appRelease';
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

export function ConfigurationPanel({ active = true }: { active?: boolean }) {
  const db = useSQLiteContext();
  const { refresh } = useDataRefresh();
  const { setVisualModePreference } = useVisualMode();
  const [data, setData] = useState<SettingsData>();
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);
  const [release] = useState(() => getAppReleaseInfo());
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const load = useCallback(() => {
    let activeLoad = true;
    Promise.all([
      new SettingsRepository(db).getPreferences(),
      getNotificationPermissionState(),
      new DeadlineRepository(db).listProfiles(),
    ])
      .then(([preferences, permission, profiles]) => {
        if (!activeLoad) return;
        setData({
          preferences,
          permission,
          profileName:
            profiles.find((profile) => profile.id === preferences.defaultUrgencyProfileId)?.name ??
            'Normal',
        });
        setError(undefined);
      })
      .catch(() => activeLoad && setError('Settings could not be loaded.'));
    return () => {
      activeLoad = false;
    };
  }, [db]);

  useEffect(() => {
    if (!active) return;
    void request;
    return load();
  }, [active, load, request]);

  const updatePreferences = async (patch: Partial<Preferences>) => {
    if (!data) return;
    const preferences = { ...data.preferences, ...patch };
    try {
      await new SettingsRepository(db).savePreferences(preferences);
      setData({ ...data, preferences });
      if (patch.visualMode) setVisualModePreference(patch.visualMode);
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
      Alert.alert(
        'Demo data reset',
        'Deadlines, habits, and progress are back to their fresh demo state.',
      );
    } else {
      Alert.alert('Nothing changed', 'Demo reset is available only in development builds.');
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const outcome = await checkAndApplyUpdate();
    setCheckingUpdate(false);
    if (outcome.status === 'disabled') {
      Alert.alert('Updates unavailable', 'OTA checks only run in release builds with EAS Update enabled.');
      return;
    }
    if (outcome.status === 'upToDate') {
      Alert.alert('You’re up to date', `Running ${release.summary}`);
      return;
    }
    if (outcome.status === 'error') {
      Alert.alert('Update check failed', outcome.message);
    }
  };

  if (!data && !error) return <LoadingState />;
  if (error) {
    return (
      <ErrorState
        message={error}
        retry={() => {
          setError(undefined);
          setRequest((value) => value + 1);
        }}
      />
    );
  }
  if (!data) return null;

  return (
    <>
      <SectionHeader>Reminders</SectionHeader>
      <GroupSurface>
        <SettingRow label="Notification permission" value={permissionLabel(data.permission)} />
        {data.permission !== 'granted' && data.permission !== 'unavailable' ? (
          <View className="self-start pb-3">
            <Button size="compact" variant="secondary" onPress={() => void handleNotifications()}>
              {data.permission === 'denied' ? 'Open system settings' : 'Enable notifications'}
            </Button>
          </View>
        ) : null}
      </GroupSurface>

      <SectionHeader>General</SectionHeader>
      <GroupSurface className="gap-4 py-3">
        <View className="gap-2">
          <Text className="text-[15px] font-medium text-[#F7F1DF]">Week starts</Text>
          <SegmentedControl
            accessibilityLabel="Week starts"
            value={String(data.preferences.weekStartsOn) as '0' | '1'}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
            onChange={(value) => void updatePreferences({ weekStartsOn: Number(value) as 0 | 1 })}
          />
        </View>
        <View className="h-px bg-border" />
        <View className="gap-2">
          <Text className="text-[15px] font-medium text-[#F7F1DF]">Time format</Text>
          <SegmentedControl
            accessibilityLabel="Time format"
            value={data.preferences.timeFormat}
            options={[
              { value: '24h', label: '24 hour' },
              { value: '12h', label: '12 hour' },
            ]}
            onChange={(timeFormat) => void updatePreferences({ timeFormat })}
          />
        </View>
        <View className="h-px bg-border" />
        <SettingRow label="Default urgency profile" value={data.profileName} />
      </GroupSurface>

      <SectionHeader>Version</SectionHeader>
      <GroupSurface className="gap-1 py-3">
        <SettingRow label="App" value={release.appVersion} />
        <SettingRow label="Channel" value={release.channel} />
        <SettingRow
          label="Bundle"
          value={
            release.source === 'ota'
              ? `OTA ${release.updateShortId ?? '—'}`
              : release.source === 'dev'
                ? 'Dev'
                : 'Embedded'
          }
        />
        {release.publishedAt ? <SettingRow label="Published" value={release.publishedAt} /> : null}
        {release.message ? <SettingRow label="Update" value={release.message} /> : null}
        <View className="self-start pt-2">
          <Button
            size="compact"
            variant="secondary"
            disabled={checkingUpdate}
            onPress={() => void handleCheckUpdate()}
          >
            {checkingUpdate ? 'Checking…' : 'Check for update'}
          </Button>
        </View>
      </GroupSurface>

      {__DEV__ ? (
        <>
          <SectionHeader>Development</SectionHeader>
          <GroupSurface className="gap-3 py-3">
            <View className="gap-2">
              <Text className="text-[15px] font-medium text-[#F7F1DF]">Color mode</Text>
              <SegmentedControl<VisualModePreference>
                accessibilityLabel="Color mode"
                value={data.preferences.visualMode}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'green', label: 'Green' },
                  { value: 'yellow', label: 'Yellow' },
                  { value: 'red', label: 'Red' },
                ]}
                onChange={(visualMode) => void updatePreferences({ visualMode })}
              />
            </View>
            <View className="h-px bg-border" />
            <TactilePressable
              accessibilityRole="button"
              onPress={() => void seed()}
              className="min-h-12 flex-row items-center justify-between"
            >
              <Text className="text-[15px] font-medium text-[#F7F1DF]">Reset demo data</Text>
              <Text className="text-lg text-accent-foreground">＋</Text>
            </TactilePressable>
          </GroupSurface>
        </>
      ) : null}
    </>
  );
}

function permissionLabel(permission: NotificationPermissionState): string {
  if (permission === 'granted') return 'Allowed';
  if (permission === 'denied') return 'Denied';
  if (permission === 'unavailable') return 'Unavailable on web';
  return 'Not requested';
}
