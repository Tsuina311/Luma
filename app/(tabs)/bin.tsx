import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { format } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import type { Deadline } from '@/src/domain/deadlines/schemas';
import type { Habit } from '@/src/domain/habits/schemas';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import {
  Button,
  EmptyState,
  ErrorState,
  GroupSurface,
  LoadingState,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/src/components/ui';
import { reconcileNotifications } from '@/src/services/notifications';
import { parseLocalDate, toLocalDateKey } from '@/src/utils/dates';

type CompletedHabit = { habit: Habit; date: string; previousAmount: number };
type BinData = {
  deadlines: Deadline[];
  deletedHabits: Habit[];
  completedHabits: CompletedHabit[];
};

export default function BinScreen() {
  const db = useSQLiteContext();
  const { revision, refresh } = useDataRefresh();
  const [data, setData] = useState<BinData>();
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);

  const load = useCallback(() => {
    let active = true;
    const deadlines = new DeadlineRepository(db);
    const habits = new HabitRepository(db);
    Promise.all([
      deadlines.listBin(),
      habits.listArchived(),
      habits.listAll(),
      habits.listLogs(),
    ])
      .then(([deadlineItems, deletedHabits, activeHabits, logs]) => {
        if (!active) return;
        const habitById = new Map(activeHabits.map((habit) => [habit.id, habit]));
        const completedHabits = logs
          .filter((log) => log.completed && habitById.has(log.habitId))
          .reverse()
          .slice(0, 25)
          .map((log) => ({
            habit: habitById.get(log.habitId)!,
            date: log.date,
            previousAmount: log.previousAmount ?? 0,
          }));
        setData({ deadlines: deadlineItems, deletedHabits, completedHabits });
        setError(undefined);
      })
      .catch(() => active && setError('The bin could not be loaded.'));
    return () => {
      active = false;
    };
  }, [db]);

  useFocusEffect(useCallback(() => {
    void revision;
    void request;
    return load();
  }, [load, request, revision]));

  const restoreDeadline = async (deadline: Deadline) => {
    try {
      await new DeadlineRepository(db).restore(deadline.id);
      refresh();
      load();
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('The deadline could not be restored.');
    }
  };

  const restoreDeletedHabit = async (habit: Habit) => {
    try {
      await new HabitRepository(db).restore(habit.id);
      refresh();
      load();
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('The habit could not be restored.');
    }
  };

  const restoreCompletedHabit = async ({ habit, date, previousAmount }: CompletedHabit) => {
    try {
      await new HabitRepository(db).setProgress(habit, date, previousAmount);
      refresh();
      load();
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('The habit completion could not be restored.');
    }
  };

  const count = data
    ? data.deadlines.length + data.deletedHabits.length + data.completedHabits.length
    : 0;

  return (
    <Screen compact>
      <ScreenHeader
        eyebrow="History"
        title="Bin"
        subtitle={count ? `${count} ${count === 1 ? 'item' : 'items'} available to restore` : undefined}
      />
      {!data && !error ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => {
          setError(undefined);
          setRequest((value) => value + 1);
        }} />
      ) : count === 0 ? (
        <EmptyState title="Nothing here" message="Completed and deleted items will appear here." />
      ) : data ? (
        <>
          {data.deadlines.length ? (
            <>
              <SectionHeader>Deadlines</SectionHeader>
              <GroupSurface>
                {data.deadlines.map((deadline) => (
                  <BinRow
                    key={deadline.id}
                    title={deadline.title}
                    status={deadline.archiveReason === 'deleted' ? 'Deleted' : 'Completed'}
                    onRestore={() => void restoreDeadline(deadline)}
                  />
                ))}
              </GroupSurface>
            </>
          ) : null}
          {data.completedHabits.length ? (
            <>
              <SectionHeader>Completed habits</SectionHeader>
              <GroupSurface>
                {data.completedHabits.map((entry) => (
                  <BinRow
                    key={`completed:${entry.habit.id}:${entry.date}`}
                    title={entry.habit.title}
                    status={entry.date === toLocalDateKey(new Date())
                      ? 'Completed today'
                      : `Completed ${format(parseLocalDate(entry.date), 'd MMM')}`}
                    onRestore={() => void restoreCompletedHabit(entry)}
                  />
                ))}
              </GroupSurface>
            </>
          ) : null}
          {data.deletedHabits.length ? (
            <>
              <SectionHeader>Deleted habits</SectionHeader>
              <GroupSurface>
                {data.deletedHabits.map((habit) => (
                  <BinRow
                    key={habit.id}
                    title={habit.title}
                    status="Deleted"
                    onRestore={() => void restoreDeletedHabit(habit)}
                  />
                ))}
              </GroupSurface>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function BinRow({
  title,
  status,
  onRestore,
}: {
  title: string;
  status: string;
  onRestore: () => void;
}) {
  return (
    <View className="min-h-[68px] flex-row items-center gap-3 border-b border-white/25 py-3 last:border-b-0 dark:border-white/10">
      <View className="flex-1 gap-1">
        <Text className="text-[15px] font-medium text-[#F7F1DF]">{title}</Text>
        <Text className="text-xs text-[#F7F1DF]/70">{status}</Text>
      </View>
      <Button size="compact" variant="secondary" onPress={onRestore}>Restore</Button>
    </View>
  );
}
