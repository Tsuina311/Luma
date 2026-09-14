import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { getHabitStatusForDate } from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import type { WeekStart } from '@/src/utils/dates';
import { toLocalDateKey } from '@/src/utils/dates';
import { Button, EmptyState, ErrorState, LoadingState, Screen } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { reconcileNotifications } from '@/src/services/notifications';
import { useTheme } from '@/src/ui/theme';

type HabitsData = { habits: Habit[]; logs: HabitLog[]; weekStartsOn: WeekStart };

export default function HabitsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
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
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Habits</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Small actions, reliably repeated.</Text>
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
        <View>
          {data?.habits.map((habit) => {
            const logs = data.logs.filter((log) => log.habitId === habit.id);
            const status = getHabitStatusForDate(habit, logs, new Date(), data.weekStartsOn);
            const step = Math.max(1, Math.round(habit.targetValue / 10));
            return (
              <View key={habit.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <Pressable
                  style={styles.rowCopy}
                  accessibilityRole="button"
                  onPress={() => router.push(`/habit/${habit.id}` as never)}
                >
                  <Text style={[styles.habitTitle, { color: theme.text }]}>{habit.title}</Text>
                  <Text style={[styles.habitSubtitle, { color: theme.textMuted }]}>{status.subtitle}</Text>
                </Pressable>
                {habit.targetType === 'boolean' ? (
                  <Button
                    variant={status.completed ? 'secondary' : 'primary'}
                    onPress={() => void setProgress(habit, status.completed ? 0 : 1)}
                  >
                    {status.completed ? 'Undo' : 'Done'}
                  </Button>
                ) : (
                  <View style={styles.counter}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Subtract ${step}`}
                      onPress={() => void setProgress(habit, status.current - step)}
                      style={[styles.counterButton, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.counterButtonText, { color: theme.text }]}>−</Text>
                    </Pressable>
                    <Text style={[styles.counterValue, { color: theme.text }]}>{status.current}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${step}`}
                      onPress={() => void setProgress(habit, Math.min(habit.targetValue, status.current + step))}
                      style={[styles.counterButton, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.counterButtonText, { color: theme.text }]}>+</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 },
  headingCopy: { flex: 1, gap: 3 },
  title: { fontSize: 31, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  row: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 13 },
  rowCopy: { flex: 1, gap: 5 },
  habitTitle: { fontSize: 18, fontWeight: '600' },
  habitSubtitle: { fontSize: 14 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  counterButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  counterButtonText: { fontSize: 24, lineHeight: 27 },
  counterValue: { minWidth: 28, fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
