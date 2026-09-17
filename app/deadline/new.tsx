import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { SettingsRepository, type Preferences } from '@/src/db/repositories/settingsRepository';
import type { UrgencyProfile } from '@/src/domain/deadlines/schemas';
import { DeadlineForm } from '@/src/features/deadlines/DeadlineForm';
import { HabitForm } from '@/src/features/habits/HabitForm';
import { ErrorState, LoadingState, Screen } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { selectionFeedback } from '@/src/ui/feedback';
import { dismissScreen } from '@/src/utils/navigation';

type CreateKind = 'deadline' | 'habit';

export default function NewItemScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { refresh } = useDataRefresh();
  const [kind, setKind] = useState<CreateKind>('deadline');
  const [data, setData] = useState<{ profiles: UrgencyProfile[]; preferences: Preferences }>();
  const [error, setError] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    Promise.all([
      new DeadlineRepository(db).listProfiles(),
      new SettingsRepository(db).getPreferences(),
    ])
      .then(([profiles, preferences]) => setData({ profiles, preferences }))
      .catch(() => setError(true));
  }, [db, request]);

  useEffect(() => {
    navigation.setOptions({
      title: kind === 'deadline' ? 'New deadline' : 'New habit',
    });
  }, [kind, navigation]);

  const onSaved = () => {
    refresh();
    dismissScreen();
  };

  return (
    <Screen>
      {!data && !error ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message="This form could not be loaded."
          retry={() => {
            setError(false);
            setRequest((value) => value + 1);
          }}
        />
      ) : (
        <View className="z-20 gap-5" style={{ zIndex: 20 }}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="What to create"
            className="flex-row gap-2"
          >
            {([
              { value: 'deadline' as const, label: 'Deadline' },
              { value: 'habit' as const, label: 'Habit' },
            ]).map((option) => {
              const selected = kind === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  hitSlop={8}
                  onPress={() => {
                    if (selected) return;
                    selectionFeedback();
                    setKind(option.value);
                  }}
                  className={`min-h-12 flex-1 items-center justify-center rounded-[11px] border px-3 ${
                    selected
                      ? 'border-primary/40 bg-accent'
                      : 'border-border bg-secondary/70'
                  }`}
                >
                  <Text
                    className={`text-[15px] ${
                      selected ? 'font-semibold text-accent-foreground' : 'font-medium text-muted-foreground'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {kind === 'deadline' ? (
            <DeadlineForm
              db={db}
              profiles={data?.profiles ?? []}
              timeFormat={data?.preferences.timeFormat}
              onSaved={onSaved}
            />
          ) : (
            <HabitForm
              db={db}
              timeFormat={data?.preferences.timeFormat}
              onSaved={onSaved}
            />
          )}
        </View>
      )}
    </Screen>
  );
}
