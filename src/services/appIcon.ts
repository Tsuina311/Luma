import { Platform } from 'react-native';
import type { VisualMode } from '@/src/ui/theme';

/** Alternate icons registered in app.json; green is the default bundle icon. */
const ALTERNATE_ICONS = new Set<VisualMode>(['yellow', 'red']);

/**
 * Keep the home-screen icon aligned with the resolved visual mode
 * (same urgency ladder as theme: overdue → red, upcoming → yellow, else green).
 * No-op on web / Expo Go / unsupported builds.
 */
export async function syncAppIcon(visualMode: VisualMode): Promise<void> {
  if (Platform.OS === 'web') return;

  const target = ALTERNATE_ICONS.has(visualMode) ? visualMode : null;

  try {
    // Dynamic import so a missing native module cannot crash app startup.
    const { getAppIcon, setAppIcon } = await import('expo-runtime-app-icon');
    if (typeof getAppIcon !== 'function' || typeof setAppIcon !== 'function') return;
    if (getAppIcon() === target) return;
    await setAppIcon(target);
  } catch {
    // Expo Go and builds without the native module cannot change icons.
  }
}
