import { AttentionRow } from '@/src/components/AttentionRow';
import {
  ErrorState,
  GroupSurface,
  LoadingState,
  Screen,
} from '@/src/components/ui';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import type { AttentionItem } from '@/src/domain/shared';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { loadAttentionOverview } from '@/src/services/attentionService';
import { reconcileNotifications } from '@/src/services/notifications';
import { completionFeedback, selectionFeedback } from '@/src/ui/feedback';
import { toLocalDateKey } from '@/src/utils/dates';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AddDeadlineButton() {
  const scale = useSharedValue(1);
  const busy = useRef(false);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const release = useCallback(() => {
    busy.current = false;
  }, []);

  const onPress = () => {
    if (busy.current) return;
    busy.current = true;
    selectionFeedback();
    router.push('/deadline/new');
    const timing = { duration: 400, easing: Easing.inOut(Easing.quad) };
    scale.value = withSequence(
      withTiming(0.82, timing),
      withTiming(1, timing, (finished) => {
        if (finished) runOnJS(release)();
      }),
    );
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Add deadline"
      onPress={onPress}
      className="h-[50px] w-[50px] items-center justify-center"
      style={style}
    >
      <Image
        source={require('@/assets/images/shovel.png')}
        style={{ width: 50, height: 50 }}
        contentFit="contain"
      />
    </AnimatedPressable>
  );
}

export default function AttentionScreen() {
  const db = useSQLiteContext();
  const { revision, refresh } = useDataRefresh();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const itemsRef = useRef(items);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);

  itemsRef.current = items;

  useFocusEffect(
    useCallback(() => {
      void revision;
      void request;
      let active = true;
      setLoading((current) => (itemsRef.current.length === 0 ? true : current));
      loadAttentionOverview(db)
        .then((overview) => {
          if (!active) return;
          setItems(overview.items);
          setError(undefined);
        })
        .catch(() => active && setError('Your attention list could not be loaded.'))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [db, revision, request]),
  );

  const openItem = (item: AttentionItem) => {
    router.push(`/${item.sourceType}/${item.sourceId}` as never);
  };

  const completeItem = async (item: AttentionItem) => {
    try {
      if (item.sourceType === 'deadline') {
        await new DeadlineRepository(db).setCompleted(item.sourceId, true);
      } else {
        const repository = new HabitRepository(db);
        const habit = await repository.getById(item.sourceId);
        if (!habit) throw new Error('Habit not found');
        await repository.setProgress(habit, toLocalDateKey(new Date()), habit.targetValue);
      }
      completionFeedback();
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      refresh();
      void reconcileNotifications(db).catch(() => undefined);
    } catch {
      setError('The item could not be completed.');
    }
  };

  return (
    <Screen compact>
      <View className="flex-row items-center justify-end">
        <AddDeadlineButton />
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={() => setRequest((value) => value + 1)} />
      ) : items.length === 0 ? (
        <View className="mt-10 gap-1 px-1">
          <Text className="text-[26px] font-semibold tracking-tight text-[#F7F1DF]">
            You’re clear
          </Text>
          <Text className="max-w-xs text-sm leading-5 text-[#F7F1DF]/80">
            Nothing needs your attention right now.
          </Text>
        </View>
      ) : (
        <GroupSurface>
          {items.map((item) => (
            <Animated.View
              key={item.id}
              layout={LinearTransition.duration(220)}
              exiting={FadeOut.duration(220)}
              className="border-b border-white/25 last:border-b-0 dark:border-white/10"
            >
              <AttentionRow
                item={item}
                onPress={() => openItem(item)}
                onComplete={() => void completeItem(item)}
              />
            </Animated.View>
          ))}
        </GroupSurface>
      )}
    </Screen>
  );
}
