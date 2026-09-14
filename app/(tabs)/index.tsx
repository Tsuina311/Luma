import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { AttentionItem } from '@/src/domain/shared';
import type { Deadline } from '@/src/domain/deadlines/schemas';
import { loadAttentionOverview } from '@/src/services/attentionService';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { AttentionRow } from '@/src/components/AttentionRow';
import { Button, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from '@/src/components/ui';
import { useTheme } from '@/src/ui/theme';

export default function AttentionScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { revision } = useDataRefresh();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [completedDeadlines, setCompletedDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);

  useFocusEffect(useCallback(() => {
    void revision;
    void request;
    let active = true;
    setLoading(true);
    loadAttentionOverview(db)
      .then((overview) => {
        if (active) {
          setItems(overview.items);
          setCompletedDeadlines(overview.completedDeadlines);
          setError(undefined);
        }
      })
      .catch(() => active && setError('Your attention list could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [db, revision, request]));

  const openItem = (item: AttentionItem) => {
    router.push(`/${item.sourceType}/${item.sourceId}` as never);
  };

  return (
    <Screen>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>YOUR FOCUS</Text>
          <Text style={[styles.title, { color: theme.text }]}>Needs attention</Text>
        </View>
        <Button onPress={() => router.push('/deadline/new')}>+ Deadline</Button>
      </View>
      <SectionTitle>Now</SectionTitle>
      {loading ? <LoadingState /> : error ? (
        <ErrorState message={error} retry={() => setRequest((value) => value + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          title="You’re clear"
          message="Nothing needs your attention right now."
          action={<Button onPress={() => router.push('/deadline/new')}>Add a deadline</Button>}
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => <AttentionRow key={item.id} item={item} onPress={() => openItem(item)} />)}
        </View>
      )}
      {!loading && !error && completedDeadlines.length > 0 ? (
        <>
          <SectionTitle>Recently completed</SectionTitle>
          {completedDeadlines.map((deadline) => (
            <Pressable
              key={deadline.id}
              accessibilityRole="button"
              accessibilityLabel={`${deadline.title}. Completed`}
              onPress={() => router.push(`/deadline/${deadline.id}` as never)}
              style={[styles.completedRow, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.completedMark, { color: theme.green }]}>✓</Text>
              <Text style={[styles.completedTitle, { color: theme.textMuted }]}>{deadline.title}</Text>
              <Text style={[styles.completedChevron, { color: theme.textMuted }]}>›</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 31, lineHeight: 37, fontWeight: '700' },
  list: { flex: 1 },
  completedRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  completedMark: { fontSize: 18, fontWeight: '800' },
  completedTitle: { flex: 1, fontSize: 16, textDecorationLine: 'line-through' },
  completedChevron: { fontSize: 24 },
});
