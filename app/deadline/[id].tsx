import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { SettingsRepository, type Preferences } from '@/src/db/repositories/settingsRepository';
import type {
  Deadline,
  DeadlineNotificationRule,
  UrgencyProfile,
} from '@/src/domain/deadlines/schemas';
import { getTimeRemaining } from '@/src/domain/deadlines/logic';
import { DeadlineForm } from '@/src/features/deadlines/DeadlineForm';
import { Button, ErrorState, GroupSurface, LoadingState, Screen, SectionHeader } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { reconcileNotifications } from '@/src/services/notifications';
import { completionFeedback, destructiveFeedback } from '@/src/ui/feedback';
import { dismissScreen } from '@/src/utils/navigation';

type ViewData = {
  deadline: Deadline;
  profiles: UrgencyProfile[];
  rules: DeadlineNotificationRule[];
  preferences: Preferences;
};

export default function DeadlineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { refresh } = useDataRefresh();
  const [data, setData] = useState<ViewData>();
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);

  useFocusEffect(useCallback(() => {
    void request;
    if (!id) return;
    let active = true;
    const repository = new DeadlineRepository(db);
    Promise.all([
      repository.getById(id),
      repository.listProfiles(),
      repository.listRules(id),
      new SettingsRepository(db).getPreferences(),
    ])
      .then(([deadline, profiles, rules, preferences]) => {
        if (!deadline) throw new Error('not found');
        if (active) setData({ deadline, profiles, rules, preferences });
      })
      .catch(() => active && setError('This deadline could not be loaded.'))
      .finally(() => undefined);
    return () => { active = false; };
  }, [db, id, request]));

  const toggleCompleted = async () => {
    if (!data) return;
    try {
      const repository = new DeadlineRepository(db);
      await repository.setCompleted(data.deadline.id, !data.deadline.completedAt);
      if (!data.deadline.completedAt) completionFeedback();
      refresh();
      setRequest((value) => value + 1);
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('The completed state could not be changed.');
    }
  };

  const confirmDelete = () => {
    if (!data) return;
    Alert.alert('Move deadline to bin?', 'You can restore it later from the Bin tab.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to bin',
        style: 'destructive',
        onPress: () => {
          destructiveFeedback();
          void new DeadlineRepository(db).delete(data.deadline.id).then(() => {
            refresh();
            dismissScreen();
            void reconcileNotifications(db).catch(() => undefined);
          }).catch(() => setError('The deadline could not be deleted.'));
        },
      },
    ]);
  };

  return (
    <Screen>
      {!data && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => { setError(undefined); setRequest((value) => value + 1); }} />
      ) : data ? (
        <>
          <GroupSurface className="flex-row items-center gap-4 py-3">
            <View className="gap-1.5">
              <Text className="text-lg font-semibold text-foreground">
                {data.deadline.completedAt ? 'Completed' : getTimeRemaining(data.deadline.dueAt)}
              </Text>
              {data.deadline.completedAt ? (
                <Text className="text-sm text-muted-foreground">Removed from Attention</Text>
              ) : null}
            </View>
            <View className="ml-auto">
              <Button
                size="compact"
                variant={data.deadline.completedAt ? 'secondary' : 'primary'}
                onPress={() => void toggleCompleted()}
              >
                {data.deadline.completedAt ? 'Reopen' : 'Mark done'}
              </Button>
            </View>
          </GroupSurface>
          <SectionHeader>Edit deadline</SectionHeader>
          <DeadlineForm
            db={db}
            profiles={data.profiles}
            initial={data.deadline}
            initialOffsets={data.rules.map((rule) => rule.offsetDays)}
            timeFormat={data.preferences.timeFormat}
            onSaved={() => {
              refresh();
              dismissScreen();
            }}
          />
          <View className="mt-2 border-t border-border pt-4">
            <View className="self-start">
              <Button size="compact" variant="danger" onPress={confirmDelete}>Move to bin</Button>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
