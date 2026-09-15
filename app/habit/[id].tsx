import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { calculateHabitReliability } from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import type { WeekStart } from '@/src/utils/dates';
import { HabitForm } from '@/src/features/habits/HabitForm';
import { Button, ErrorState, GroupSurface, LoadingState, Screen, SectionHeader } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { reconcileNotifications } from '@/src/services/notifications';
import { destructiveFeedback } from '@/src/ui/feedback';
import { dismissScreen } from '@/src/utils/navigation';

type ViewData = {
  habit: Habit;
  logs: HabitLog[];
  weekStartsOn: WeekStart;
  timeFormat: '12h' | '24h';
};

export default function HabitDetailScreen() {
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
    const repository = new HabitRepository(db);
    Promise.all([repository.getById(id), repository.listLogs(id), new SettingsRepository(db).getPreferences()])
      .then(([habit, logs, preferences]) => {
        if (!habit) throw new Error('not found');
        if (active) setData({
          habit,
          logs,
          weekStartsOn: preferences.weekStartsOn,
          timeFormat: preferences.timeFormat,
        });
      })
      .catch(() => active && setError('This habit could not be loaded.'));
    return () => { active = false; };
  }, [db, id, request]));

  const toggleActive = async () => {
    if (!data) return;
    try {
      await new HabitRepository(db).setActive(data.habit.id, !data.habit.active);
      refresh();
      setRequest((value) => value + 1);
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('The habit status could not be changed.');
    }
  };

  const confirmDelete = () => {
    if (!data) return;
    Alert.alert('Move habit to bin?', 'Its completion history stays available if you restore it later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to bin',
        style: 'destructive',
        onPress: () => {
          destructiveFeedback();
          void new HabitRepository(db).delete(data.habit.id).then(() => {
            refresh();
            dismissScreen();
            void reconcileNotifications(db).catch(() => undefined);
          }).catch(() => setError('The habit could not be deleted.'));
        },
      },
    ]);
  };

  const metrics = data
    ? calculateHabitReliability(data.habit, data.logs, new Date(), data.weekStartsOn)
    : undefined;

  return (
    <Screen>
      {!data && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => { setError(undefined); setRequest((value) => value + 1); }} />
      ) : data && metrics ? (
        <>
          <GroupSurface className="flex-row py-4">
            <Metric label="This week" value={`${metrics.completed} / ${metrics.expected}`} />
            <Metric label="Reliability" value={`${metrics.reliability}%`} />
            <Metric label="Best streak" value={String(metrics.bestStreak)} />
          </GroupSurface>
          <View className="self-start">
            <Button size="compact" variant="secondary" onPress={() => void toggleActive()}>
              {data.habit.active ? 'Pause habit' : 'Resume habit'}
            </Button>
          </View>
          <SectionHeader>Edit habit</SectionHeader>
          <HabitForm
            db={db}
            initial={data.habit}
            timeFormat={data.timeFormat}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-lg font-semibold text-foreground">{value}</Text>
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
    </View>
  );
}
