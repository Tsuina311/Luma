import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { SettingsRepository, type Preferences } from '@/src/db/repositories/settingsRepository';
import { ErrorState, LoadingState, Screen } from '@/src/components/ui';
import { HabitForm } from '@/src/features/habits/HabitForm';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { dismissScreen } from '@/src/utils/navigation';

export default function NewHabitScreen() {
  const db = useSQLiteContext();
  const { refresh } = useDataRefresh();
  const [preferences, setPreferences] = useState<Preferences>();
  const [error, setError] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    new SettingsRepository(db).getPreferences().then(setPreferences).catch(() => setError(true));
  }, [db, request]);

  return (
    <Screen>
      {!preferences && !error ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message="Preferences could not be loaded."
          retry={() => {
            setError(false);
            setRequest((value) => value + 1);
          }}
        />
      ) : (
        <HabitForm
          db={db}
          timeFormat={preferences?.timeFormat}
          onSaved={() => {
            refresh();
            dismissScreen();
          }}
        />
      )}
    </Screen>
  );
}
