import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Uniwind } from 'uniwind';
import { SettingsRepository, type VisualModePreference } from '@/src/db/repositories/settingsRepository';
import { visualModeFromUrgencies } from '@/src/domain/attention/visualMode';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { syncAppIcon } from '@/src/services/appIcon';
import { loadAttentionOverview } from '@/src/services/attentionService';
import type { VisualMode } from '@/src/ui/theme';
import { useSystemAppearance } from '@/src/ui/useSystemAppearance';

type VisualModeContextValue = {
  visualMode: VisualMode;
  preference: VisualModePreference;
  setVisualModePreference: (mode: VisualModePreference) => void;
};

const VisualModeContext = createContext<VisualModeContextValue>({
  visualMode: 'green',
  preference: 'auto',
  setVisualModePreference: () => undefined,
});

export function VisualModeProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const colorScheme = useSystemAppearance();
  const { revision } = useDataRefresh();
  const [preference, setPreference] = useState<VisualModePreference | null>(null);
  const [autoMode, setAutoMode] = useState<VisualMode>('green');

  const refreshAutoMode = useCallback(async () => {
    try {
      const { items } = await loadAttentionOverview(db);
      const next = visualModeFromUrgencies(items.map((item) => item.urgency));
      setAutoMode((current) => (current === next ? current : next));
    } catch {
      // Keep the last known auto mode if attention cannot be loaded.
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    void new SettingsRepository(db).getPreferences().then((preferences) => {
      if (active) setPreference(preferences.visualMode);
    });
    return () => {
      active = false;
    };
  }, [db]);

  useEffect(() => {
    if (preference !== 'auto') return;
    void refreshAutoMode();
  }, [preference, refreshAutoMode, revision]);

  useEffect(() => {
    if (preference !== 'auto') return;
    const onAppState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAutoMode();
    });
    const interval = setInterval(() => {
      void refreshAutoMode();
    }, 60_000);
    return () => {
      onAppState.remove();
      clearInterval(interval);
    };
  }, [preference, refreshAutoMode]);

  const resolvedPreference = preference ?? 'auto';
  const visualMode: VisualMode = resolvedPreference === 'auto' ? autoMode : resolvedPreference;

  useEffect(() => {
    // Defer past first paint so a theme failure cannot block initial mount.
    const id = requestAnimationFrame(() => {
      try {
        Uniwind.setTheme(`${visualMode}-${colorScheme}`);
      } catch (error) {
        console.warn('Uniwind.setTheme failed', error);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [colorScheme, visualMode]);

  useEffect(() => {
    void syncAppIcon(visualMode);
  }, [visualMode]);

  const setVisualModePreference = useCallback((mode: VisualModePreference) => {
    setPreference(mode);
  }, []);

  const value = useMemo(
    () => ({
      visualMode,
      preference: resolvedPreference,
      setVisualModePreference,
    }),
    [visualMode, resolvedPreference, setVisualModePreference],
  );
  return <VisualModeContext.Provider value={value}>{children}</VisualModeContext.Provider>;
}

export function useVisualMode() {
  return useContext(VisualModeContext);
}
