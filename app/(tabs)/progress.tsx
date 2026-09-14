import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { calculateHabitReliability, type HabitMetrics } from '@/src/domain/habits/logic';
import type { Habit } from '@/src/domain/habits/schemas';
import { Button, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { useTheme } from '@/src/ui/theme';

type HabitProgress = { habit: Habit; metrics: HabitMetrics };

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
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
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.text }]}>This week</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Reliability matters more than perfection.</Text>
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
          <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.heroValue, { color: theme.primary }]}>{reliability}%</Text>
            <Text style={[styles.heroLabel, { color: theme.text }]}>weekly reliability</Text>
            <Text style={[styles.heroMeta, { color: theme.textMuted }]}>
              {totals?.completed} of {totals?.expected} expected · {totals?.xp} XP total
            </Text>
          </View>
          <SectionTitle>By habit</SectionTitle>
          {items?.map(({ habit, metrics }) => (
            <View key={habit.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{habit.title}</Text>
                <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
                  {metrics.completed} / {metrics.expected} this week · {metrics.totalCompletions} total
                </Text>
              </View>
              <Text style={[styles.rowReliability, { color: theme.primary }]}>{metrics.reliability}%</Text>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4, marginBottom: 4 },
  title: { fontSize: 31, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  hero: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', gap: 5 },
  heroValue: { fontSize: 48, fontWeight: '700' },
  heroLabel: { fontSize: 18, fontWeight: '600' },
  heroMeta: { fontSize: 14, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 76, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  rowMeta: { fontSize: 13 },
  rowReliability: { fontSize: 21, fontWeight: '700' },
});
