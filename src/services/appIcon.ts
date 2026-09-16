import { Platform } from 'react-native';
import type { VisualMode } from '@/src/ui/theme';

/** Alternate icons registered in app.json; green is the default bundle icon. */
const ALTERNATE_ICONS = new Set<VisualMode>(['yellow', 'red']);

let pendingTarget: string | null | undefined;
let applying: Promise<void> | null = null;

function targetForMode(visualMode: VisualMode): string | null {
  return ALTERNATE_ICONS.has(visualMode) ? visualMode : null;
}

async function applyPendingIcon(force = false): Promise<void> {
  if (Platform.OS === 'web') return;
  if (pendingTarget === undefined) return;

  const target = pendingTarget;
  if (applying) {
    await applying;
    // Another caller may have updated the pending target while we waited.
    if (pendingTarget !== target && !force) {
      await applyPendingIcon(force);
    }
    return;
  }

  applying = (async () => {
    try {
      const { getAppIcon, setAppIcon } = await import('expo-runtime-app-icon');
      if (typeof getAppIcon !== 'function' || typeof setAppIcon !== 'function') return;
      // Android launchers often ignore an in-foreground PackageManager flip until
      // the app backgrounds; force re-apply on background even if already matching.
      if (!force && getAppIcon() === target) return;
      await setAppIcon(target);
    } catch {
      // Expo Go and builds without the native module cannot change icons.
    }
  })();

  try {
    await applying;
  } finally {
    applying = null;
  }
}

/**
 * Keep the home-screen icon aligned with the resolved visual mode
 * (same urgency ladder as theme: overdue → red, upcoming → yellow, else green).
 * No-op on web / Expo Go / unsupported builds.
 */
export async function syncAppIcon(visualMode: VisualMode): Promise<void> {
  pendingTarget = targetForMode(visualMode);
  await applyPendingIcon(false);
}

/** Re-apply the last desired icon — call when leaving the foreground so Android launchers refresh. */
export async function flushAppIcon(): Promise<void> {
  await applyPendingIcon(true);
}
