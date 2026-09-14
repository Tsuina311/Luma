import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Card } from '@/components/ui/card';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { calculateHabitReliability } from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import type { WeekStart } from '@/src/utils/dates';
import { HabitForm } from '@/src/features/habits/HabitForm';
import { Button, ErrorState, LoadingState, Screen, SectionTitle } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { reconcileNotifications } from '@/src/services/notifications';

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
    Alert.alert('Delete habit?', 'Its completion history will also be deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void new HabitRepository(db).delete(data.habit.id).then(() => {
            refresh();
            router.back();
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
          <Card className="flex-row rounded-3xl border-border bg-card p-5 shadow-sm">
            <Metric label="This week" value={`${metrics.completed} / ${metrics.expected}`} />
            <Metric label="Reliability" value={`${metrics.reliability}%`} />
            <Metric label="Best streak" value={String(metrics.bestStreak)} />
          </Card>
          <Button variant="secondary" onPress={() => void toggleActive()}>
            {data.habit.active ? 'Pause habit' : 'Resume habit'}
          </Button>
          <SectionTitle>Edit habit</SectionTitle>
          <HabitForm
            db={db}
            initial={data.habit}
            timeFormat={data.timeFormat}
            onSaved={() => {
              refresh();
              router.back();
            }}
          />
          <Button variant="danger" onPress={confirmDelete}>Delete habit</Button>
        </>
      ) : null}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xl font-extrabold text-foreground">{value}</Text>
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
    </View>
  );
}
