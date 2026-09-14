import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Card } from '@/components/ui/card';
import type { AttentionItem } from '@/src/domain/shared';
import type { Deadline } from '@/src/domain/deadlines/schemas';
import { loadAttentionOverview } from '@/src/services/attentionService';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { AttentionRow } from '@/src/components/AttentionRow';
import { Button, EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from '@/src/components/ui';

export default function AttentionScreen() {
  const db = useSQLiteContext();
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
      <View className="flex-row items-center justify-between gap-4 py-1">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-primary" />
            <Text className="text-xs font-extrabold uppercase tracking-[1.8px] text-primary">Your focus</Text>
          </View>
          <Text className="text-[32px] font-extrabold leading-10 tracking-[-1px] text-foreground">
            Needs attention
          </Text>
          <Text className="text-sm text-muted-foreground">
            {items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'} asking for your focus` : 'A calm view of what matters now'}
          </Text>
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
        <View className="gap-3">
          {items.map((item) => <AttentionRow key={item.id} item={item} onPress={() => openItem(item)} />)}
        </View>
      )}
      {!loading && !error && completedDeadlines.length > 0 ? (
        <>
          <SectionTitle>Recently completed</SectionTitle>
          <Card className="overflow-hidden rounded-3xl border-border bg-card p-0 shadow-sm">
            {completedDeadlines.map((deadline, index) => (
              <Pressable
                key={deadline.id}
                accessibilityRole="button"
                accessibilityLabel={`${deadline.title}. Completed`}
                onPress={() => router.push(`/deadline/${deadline.id}` as never)}
                className={`min-h-14 flex-row items-center gap-3 px-4 active:bg-muted ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-urgency-green/10">
                  <Text className="text-base font-extrabold text-urgency-green">✓</Text>
                </View>
                <Text className="flex-1 text-base text-muted-foreground line-through">{deadline.title}</Text>
                <Text className="text-2xl text-muted-foreground">›</Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
