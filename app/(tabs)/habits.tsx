import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Card } from '@/components/ui/card';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { getHabitStatusForDate } from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import type { WeekStart } from '@/src/utils/dates';
import { toLocalDateKey } from '@/src/utils/dates';
import { Button, EmptyState, ErrorState, LoadingState, Screen } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { reconcileNotifications } from '@/src/services/notifications';

type HabitsData = { habits: Habit[]; logs: HabitLog[]; weekStartsOn: WeekStart };

export default function HabitsScreen() {
  const db = useSQLiteContext();
  const { revision, refresh } = useDataRefresh();
  const [data, setData] = useState<HabitsData>();
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);

  const load = useCallback(() => {
    let active = true;
    const habits = new HabitRepository(db);
    Promise.all([habits.listActive(), habits.listLogs(), new SettingsRepository(db).getPreferences()])
      .then(([habitItems, logs, preferences]) => {
        if (active) {
          setData({ habits: habitItems, logs, weekStartsOn: preferences.weekStartsOn });
          setError(undefined);
        }
      })
      .catch(() => active && setError('Your habits could not be loaded.'));
    return () => { active = false; };
  }, [db]);

  useFocusEffect(useCallback(() => {
    void revision;
    void request;
    return load();
  }, [load, revision, request]));

  const setProgress = async (habit: Habit, amount: number) => {
    try {
      await new HabitRepository(db).setProgress(habit, toLocalDateKey(new Date()), amount);
      refresh();
      load();
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('Progress could not be saved. Please try again.');
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between gap-4 py-1">
        <View className="flex-1 gap-1">
          <Text className="text-xs font-extrabold uppercase tracking-[1.8px] text-primary">Build momentum</Text>
          <Text className="text-[32px] font-extrabold tracking-[-1px] text-foreground">Habits</Text>
          <Text className="text-sm text-muted-foreground">Small actions, reliably repeated.</Text>
        </View>
        <Button onPress={() => router.push('/habit/new')}>+ Habit</Button>
      </View>
      {!data && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => { setError(undefined); setRequest((value) => value + 1); }} />
      ) : data?.habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          message="Add one recurring action you want to make easier."
          action={<Button onPress={() => router.push('/habit/new')}>Create a habit</Button>}
        />
      ) : (
        <View className="gap-3">
          {data?.habits.map((habit) => {
            const logs = data.logs.filter((log) => log.habitId === habit.id);
            const status = getHabitStatusForDate(habit, logs, new Date(), data.weekStartsOn);
            const step = Math.max(1, Math.round(habit.targetValue / 10));
            return (
              <Card
                key={habit.id}
                className="min-h-28 flex-row items-center gap-4 rounded-3xl border-border bg-card p-4 shadow-sm"
              >
                <Pressable
                  className="flex-1 gap-2 active:opacity-60"
                  accessibilityRole="button"
                  onPress={() => router.push(`/habit/${habit.id}` as never)}
                >
                  <View className="flex-row items-center gap-2">
                    <View className={`h-2.5 w-2.5 rounded-full ${status.completed ? 'bg-urgency-green' : 'bg-primary'}`} />
                    <Text className="text-[18px] font-bold tracking-tight text-foreground">{habit.title}</Text>
                  </View>
                  <Text className="text-sm font-medium text-muted-foreground">{status.subtitle}</Text>
                  {habit.targetType === 'count' ? (
                    <View className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <View
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (status.current / status.target) * 100)}%` }}
                      />
                    </View>
                  ) : null}
                </Pressable>
                {habit.targetType === 'boolean' ? (
                  <Button
                    variant={status.completed ? 'secondary' : 'primary'}
                    onPress={() => void setProgress(habit, status.completed ? 0 : 1)}
                  >
                    {status.completed ? 'Undo' : 'Done'}
                  </Button>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Subtract ${step}`}
                      onPress={() => void setProgress(habit, status.current - step)}
                      className="h-10 w-10 items-center justify-center rounded-full border border-border bg-background active:bg-muted"
                    >
                      <Text className="text-xl text-foreground">−</Text>
                    </Pressable>
                    <Text className="min-w-7 text-center text-base font-bold text-foreground">{status.current}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${step}`}
                      onPress={() => void setProgress(habit, Math.min(habit.targetValue, status.current + step))}
                      className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-70"
                    >
                      <Text className="text-xl font-semibold text-primary-foreground">+</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
