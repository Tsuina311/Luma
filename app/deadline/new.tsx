import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { SettingsRepository, type Preferences } from '@/src/db/repositories/settingsRepository';
import type { UrgencyProfile } from '@/src/domain/deadlines/schemas';
import { DeadlineForm } from '@/src/features/deadlines/DeadlineForm';
import { HabitForm } from '@/src/features/habits/HabitForm';
import { ErrorState, LoadingState, Screen, SegmentedControl } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
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
        <View className="gap-5">
          <SegmentedControl
            accessibilityLabel="What to create"
            value={kind}
            options={[
              { value: 'deadline', label: 'Deadline' },
              { value: 'habit', label: 'Habit' },
            ]}
            onChange={setKind}
          />
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
