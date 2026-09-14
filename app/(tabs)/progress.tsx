import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Card } from '@/components/ui/card';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { calculateHabitReliability, type HabitMetrics } from '@/src/domain/habits/logic';
import type { Habit } from '@/src/domain/habits/schemas';
import { Button, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';

type HabitProgress = { habit: Habit; metrics: HabitMetrics };

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const { revision } = useDataRefresh();
  const [items, setItems] = useState<HabitProgress[]>();
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);

  useFocusEffect(useCallback(() => {
    void revision;
    void request;
    let active = true;
    const repository = new HabitRepository(db);
    Promise.all([repository.listActive(), repository.listLogs(), new SettingsRepository(db).getPreferences()])
      .then(([habits, logs, preferences]) => {
        if (!active) return;
        setItems(habits.map((habit) => ({
          habit,
          metrics: calculateHabitReliability(
            habit,
            logs.filter((log) => log.habitId === habit.id),
            new Date(),
            preferences.weekStartsOn,
          ),
        })));
        setError(undefined);
      })
      .catch(() => active && setError('Progress could not be calculated.'));
    return () => { active = false; };
  }, [db, revision, request]));

  const totals = items?.reduce(
    (result, item) => ({
      expected: result.expected + item.metrics.expected,
      completed: result.completed + item.metrics.completed,
      xp: result.xp + item.metrics.xp,
    }),
    { expected: 0, completed: 0, xp: 0 },
  );
  const reliability = totals?.expected ? Math.round((totals.completed / totals.expected) * 100) : 100;

  return (
    <Screen>
      <View className="gap-1 py-1">
        <Text className="text-xs font-extrabold uppercase tracking-[1.8px] text-primary">Your rhythm</Text>
        <Text className="text-[32px] font-extrabold tracking-[-1px] text-foreground">This week</Text>
        <Text className="text-sm text-muted-foreground">Reliability matters more than perfection.</Text>
      </View>
      {!items && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => { setError(undefined); setRequest((value) => value + 1); }} />
      ) : items?.length === 0 ? (
        <EmptyState
          title="Progress starts with one habit"
          message="Create a habit, then each completion will build a useful history."
          action={<Button onPress={() => router.push('/habit/new')}>Create a habit</Button>}
        />
      ) : (
        <>
          <Card className="overflow-hidden rounded-[28px] border-0 bg-primary p-6 shadow-lg shadow-primary/30">
            <View className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <View className="absolute -bottom-12 right-16 h-28 w-28 rounded-full bg-white/5" />
            <Text className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/70">
              Weekly reliability
            </Text>
            <Text className="mt-2 text-[58px] font-black tracking-[-3px] text-primary-foreground">{reliability}%</Text>
            <View className="mt-5 h-2 overflow-hidden rounded-full bg-black/10">
              <View className="h-full rounded-full bg-primary-foreground" style={{ width: `${reliability}%` }} />
            </View>
            <Text className="mt-3 text-sm font-medium text-primary-foreground/80">
              {totals?.completed} of {totals?.expected} expected · {totals?.xp} XP earned
            </Text>
          </Card>
          <SectionTitle>By habit</SectionTitle>
          <View className="gap-3">
            {items?.map(({ habit, metrics }) => (
              <Card key={habit.id} className="flex-row items-center gap-4 rounded-3xl border-border bg-card p-4 shadow-sm">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                  <Text className="text-base font-black text-primary">{metrics.reliability}%</Text>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-[17px] font-bold text-foreground">{habit.title}</Text>
                  <Text className="text-sm text-muted-foreground">
                  {metrics.completed} / {metrics.expected} this week · {metrics.totalCompletions} total
                  </Text>
                </View>
                <Text className="text-2xl text-muted-foreground">›</Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
