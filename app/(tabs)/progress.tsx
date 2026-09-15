import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { calculateHabitReliability, type HabitMetrics } from '@/src/domain/habits/logic';
import type { Habit } from '@/src/domain/habits/schemas';
import {
  Button,
  EmptyState,
  ErrorState,
  GlassSurface,
  GroupSurface,
  GrowthStem,
  LoadingState,
  LumaMark,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/src/components/ui';
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
    <Screen compact>
      <ScreenHeader eyebrow="Progress" title="This week" subtitle="Reliability over perfection." />
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
          <GlassSurface className="gap-4 p-4">
            <View className="flex-row items-end justify-between">
              <View className="gap-0.5">
                <View className="flex-row items-center gap-2">
                  <LumaMark size="small" />
                  <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[#F7F1DF]/70">
                    Weekly reliability
                  </Text>
                </View>
                <Text className="text-[42px] font-semibold tracking-[-1.8px] text-[#F7F1DF]">{reliability}%</Text>
              </View>
              <Text className="pb-2 text-sm text-[#F7F1DF]/70">{totals?.completed} of {totals?.expected}</Text>
            </View>
            <ProgressBar value={reliability} />
            <Text className="text-xs text-[#F7F1DF]/70">
              {totals?.xp} XP earned
            </Text>
          </GlassSurface>
          <SectionHeader>By habit</SectionHeader>
          <GroupSurface>
            {items?.map(({ habit, metrics }) => {
              const tone = metrics.reliability >= 80
                ? 'green'
                : metrics.reliability >= 50
                  ? 'yellow'
                  : metrics.reliability > 0 ? 'orange' : 'red';
              return (
              <View key={habit.id} className="relative min-h-[70px] flex-row items-center gap-4 border-b border-white/25 py-3 pl-5 last:border-b-0 dark:border-white/10">
                <GrowthStem tone={tone} />
                <View className="flex-1 gap-1">
                  <Text className="text-[16px] font-semibold text-[#F7F1DF]">{habit.title}</Text>
                  <Text className="text-sm text-[#F7F1DF]/70">
                    {metrics.completed} of {metrics.expected} this week · {metrics.totalCompletions} total
                  </Text>
                </View>
                <Text className="text-lg font-semibold tabular-nums text-[#F7F1DF]">{metrics.reliability}%</Text>
              </View>
              );
            })}
          </GroupSurface>
        </>
      )}
    </Screen>
  );
}
