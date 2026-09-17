import { AppState, Platform } from 'react-native';
import type { VisualMode } from '@/src/ui/theme';

/** Alternate icons registered in app.json; green is the default bundle icon. */
const ALTERNATE_ICONS = new Set<VisualMode>(['yellow', 'red']);

let pendingTarget: string | null | undefined;
let applying: Promise<void> | null = null;

function targetForMode(visualMode: VisualMode): string | null {
  return ALTERNATE_ICONS.has(visualMode) ? visualMode : null;
}

async function applyPendingIcon(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (pendingTarget === undefined) return;

  // Android: toggling activity-aliases while foreground often kills the process
  // (DONT_KILL_APP is unreliable). Only flip the launcher icon in background.
  if (Platform.OS === 'android' && AppState.currentState !== 'background') {
    return;
  }

  const target = pendingTarget;
  if (applying) {
    await applying;
    if (pendingTarget !== target) await applyPendingIcon();
    return;
  }

  applying = (async () => {
    try {
      const { getAppIcon, setAppIcon } = await import('expo-runtime-app-icon');
      if (typeof getAppIcon !== 'function' || typeof setAppIcon !== 'function') return;
      if (getAppIcon() === target) return;
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

/** Remember the desired icon; apply now on iOS, or when Android next reaches background. */
export async function syncAppIcon(visualMode: VisualMode): Promise<void> {
  pendingTarget = targetForMode(visualMode);
  if (Platform.OS === 'ios') {
    await applyPendingIcon();
    return;
  }
  // Android: queue only unless already backgrounded.
  await applyPendingIcon();
}

/** Apply the queued icon — safe to call from an AppState `background` handler. */
export async function applyQueuedAppIcon(): Promise<void> {
  await applyPendingIcon();
}
