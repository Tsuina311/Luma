import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { getHabitStatusForDate } from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import type { WeekStart } from '@/src/utils/dates';
import { toLocalDateKey } from '@/src/utils/dates';
import {
  Button,
  EmptyState,
  ErrorState,
  GroupSurface,
  GrowthStem,
  LoadingState,
  Screen,
  ScreenHeader,
  TactilePressable,
} from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { reconcileNotifications } from '@/src/services/notifications';
import { completionFeedback, progressFeedback } from '@/src/ui/feedback';

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
      if (amount >= habit.targetValue) completionFeedback();
      else progressFeedback();
      refresh();
      load();
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('Progress could not be saved. Please try again.');
    }
  };

  return (
    <Screen compact>
      <ScreenHeader
        eyebrow="Your rhythm"
        title="Habits"
        subtitle="Small actions, repeated."
        action={<Button size="compact" onPress={() => router.push('/habit/new')}>Add habit</Button>}
      />
      {!data && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => { setError(undefined); setRequest((value) => value + 1); }} />
      ) : data?.habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          message="Add one recurring action you want to make easier."
        />
      ) : (
        <GroupSurface>
          {data?.habits.map((habit) => {
            const logs = data.logs.filter((log) => log.habitId === habit.id);
            const status = getHabitStatusForDate(habit, logs, new Date(), data.weekStartsOn);
            const step = Math.max(1, Math.round(habit.targetValue / 10));
            return (
              <View
                key={habit.id}
                className="relative min-h-[82px] flex-row items-center gap-3 overflow-hidden border-b border-white/25 py-3 pl-5 last:border-b-0 dark:border-white/10"
              >
                <GrowthStem
                  tone={status.completed ? 'green' : status.current > 0 ? 'yellow' : 'neutral'}
                />
                <TactilePressable
                  className="flex-1"
                  accessibilityRole="button"
                  accessibilityLabel={`${habit.title}. ${status.subtitle}`}
                  onPress={() => router.push(`/habit/${habit.id}` as never)}
                >
                  <Animated.View
                    key={`${habit.id}-${status.completed}`}
                    entering={FadeIn.duration(180)}
                    exiting={FadeOut.duration(120)}
                    className="gap-1.5 pr-1"
                  >
                    <Text className={`text-[16px] font-semibold text-[#F7F1DF] ${status.completed ? 'opacity-60' : ''}`}>
                      {habit.title}
                    </Text>
                    <Text className="text-sm text-[#F7F1DF]/70">
                      {habit.targetType === 'count'
                        ? status.completed
                          ? 'Tended today'
                          : `Today · goal ${status.target}${habit.unit ? ` ${habit.unit}` : ''}`
                        : status.subtitle}
                    </Text>
                  </Animated.View>
                </TactilePressable>
                {habit.targetType === 'boolean' ? (
                  <Button
                    size="compact"
                    variant={status.completed ? 'tended' : 'primary'}
                    onPress={() => void setProgress(habit, status.completed ? 0 : 1)}
                  >
                    {status.completed ? 'Undo' : 'Done'}
                  </Button>
                ) : (
                  <View className="flex-row items-center gap-1">
                    <TactilePressable
                      accessibilityRole="button"
                      accessibilityLabel={`Subtract ${step}`}
                      onPress={() => void setProgress(habit, status.current - step)}
                      className="h-11 w-11 items-center justify-center rounded-[9px] border border-border bg-card"
                    >
                      <Text className="text-lg text-[#F7F1DF]">−</Text>
                    </TactilePressable>
                    <Text className="min-w-8 text-center text-[15px] font-semibold text-[#F7F1DF]">{status.current}</Text>
                    <TactilePressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${step}`}
                      onPress={() => void setProgress(habit, Math.min(habit.targetValue, status.current + step))}
                      className="h-11 w-11 items-center justify-center rounded-[9px] border border-primary bg-primary"
                    >
                      <Text className="text-lg font-semibold text-primary-foreground">+</Text>
                    </TactilePressable>
                  </View>
                )}
              </View>
            );
          })}
        </GroupSurface>
      )}
    </Screen>
  );
}
