import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Uniwind } from 'uniwind';
import { SettingsRepository, type VisualModePreference } from '@/src/db/repositories/settingsRepository';
import { visualModeFromUrgencies } from '@/src/domain/attention/visualMode';
import { useDataRefresh } from '@/src/hooks/useDataRefresh';
import { applyQueuedAppIcon, syncAppIcon } from '@/src/services/appIcon';
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

const AUTO_MODE_POLL_MS = 15_000;

async function resolveAutoVisualMode(db: Parameters<typeof loadAttentionOverview>[0]): Promise<VisualMode> {
  const { items } = await loadAttentionOverview(db);
  return visualModeFromUrgencies(items.map((item) => item.urgency));
}

export function VisualModeProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const colorScheme = useSystemAppearance();
  const { revision } = useDataRefresh();
  const [preference, setPreference] = useState<VisualModePreference | null>(null);
  const [autoMode, setAutoMode] = useState<VisualMode>('green');
  const preferenceRef = useRef<VisualModePreference | null>(null);
  const visualModeRef = useRef<VisualMode>('green');

  const refreshAutoMode = useCallback(async () => {
    try {
      const next = await resolveAutoVisualMode(db);
      setAutoMode((current) => (current === next ? current : next));
      return next;
    } catch {
      return visualModeRef.current;
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
    preferenceRef.current = preference;
  }, [preference]);

  useEffect(() => {
    if (preference !== 'auto') return;
    void refreshAutoMode();
  }, [preference, refreshAutoMode, revision]);

  useEffect(() => {
    if (preference !== 'auto') return;
    const interval = setInterval(() => {
      void refreshAutoMode();
    }, AUTO_MODE_POLL_MS);
    return () => clearInterval(interval);
  }, [preference, refreshAutoMode]);

  const resolvedPreference = preference ?? 'auto';
  const visualMode: VisualMode = resolvedPreference === 'auto' ? autoMode : resolvedPreference;
  visualModeRef.current = visualMode;

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
    // Queue (and on iOS apply). Never force an Android alias flip while foregrounded.
    void syncAppIcon(visualMode);
  }, [visualMode]);

  useEffect(() => {
    const onAppState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Update in-app theme/urgency only — do not touch Android launcher components here.
        if (preferenceRef.current === 'auto' || preferenceRef.current === null) {
          void refreshAutoMode().then((mode) => {
            const pref = preferenceRef.current ?? 'auto';
            void syncAppIcon(pref === 'auto' ? mode : pref);
          });
        }
        return;
      }

      if (state === 'background') {
        void (async () => {
          const pref = preferenceRef.current ?? 'auto';
          let mode: VisualMode = visualModeRef.current;
          if (pref === 'auto') {
            try {
              mode = await resolveAutoVisualMode(db);
              setAutoMode((current) => (current === mode ? current : mode));
            } catch {
              mode = visualModeRef.current;
            }
          } else {
            mode = pref;
          }
          await syncAppIcon(mode);
          if (Platform.OS === 'android') await applyQueuedAppIcon();
        })();
      }
    });
    return () => onAppState.remove();
  }, [db, refreshAutoMode]);

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
