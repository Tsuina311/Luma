import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { Button, ErrorState, LoadingState, Screen, SectionTitle } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { reconcileNotifications } from '@/src/services/notifications';
import { useTheme } from '@/src/ui/theme';

type ViewData = {
  deadline: Deadline;
  profiles: UrgencyProfile[];
  rules: DeadlineNotificationRule[];
  preferences: Preferences;
};

export default function DeadlineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
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
      refresh();
      setRequest((value) => value + 1);
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('The completed state could not be changed.');
    }
  };

  const confirmDelete = () => {
    if (!data) return;
    Alert.alert('Delete deadline?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void new DeadlineRepository(db).delete(data.deadline.id).then(() => {
            refresh();
            router.back();
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
          <View style={[styles.status, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.statusCopy}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                {data.deadline.completedAt ? 'Completed' : getTimeRemaining(data.deadline.dueAt)}
              </Text>
              <Text style={[styles.statusSubtitle, { color: theme.textMuted }]}>
                {data.deadline.completedAt ? 'This item is out of your attention feed.' : 'Keep it visible until it is done or consciously rescheduled.'}
              </Text>
            </View>
            <Button variant={data.deadline.completedAt ? 'secondary' : 'primary'} onPress={() => void toggleCompleted()}>
              {data.deadline.completedAt ? 'Reopen' : 'Mark done'}
            </Button>
          </View>
          <SectionTitle>Edit deadline</SectionTitle>
          <DeadlineForm
            db={db}
            profiles={data.profiles}
            initial={data.deadline}
            initialOffsets={data.rules.map((rule) => rule.offsetDays)}
            timeFormat={data.preferences.timeFormat}
            onSaved={() => {
              refresh();
              router.back();
            }}
          />
          <Button variant="danger" onPress={confirmDelete}>Delete deadline</Button>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 14 },
  statusCopy: { gap: 5 },
  statusTitle: { fontSize: 20, fontWeight: '700' },
  statusSubtitle: { fontSize: 14, lineHeight: 20 },
});
