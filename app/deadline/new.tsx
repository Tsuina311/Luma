import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { SettingsRepository, type Preferences } from '@/src/db/repositories/settingsRepository';
import type { UrgencyProfile } from '@/src/domain/deadlines/schemas';
import { DeadlineForm } from '@/src/features/deadlines/DeadlineForm';
import { ErrorState, LoadingState, Screen } from '@/src/components/ui';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { dismissScreen } from '@/src/utils/navigation';

export default function NewDeadlineScreen() {
  const db = useSQLiteContext();
  const { refresh } = useDataRefresh();
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

  return (
    <Screen>
      {!data && !error ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message="Urgency profiles could not be loaded."
          retry={() => {
            setError(false);
            setRequest((value) => value + 1);
          }}
        />
      ) : (
        <DeadlineForm
          db={db}
          profiles={data?.profiles ?? []}
          timeFormat={data?.preferences.timeFormat}
          onSaved={() => {
            refresh();
            dismissScreen();
          }}
        />
      )}
    </Screen>
  );
}
