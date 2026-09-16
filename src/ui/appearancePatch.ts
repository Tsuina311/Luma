import { Appearance } from 'react-native';

/**
 * Uniwind calls Appearance.setColorScheme on theme changes. On some Android
 * runtimes that native call throws (or is missing), which surfaces as
 * "undefined is not a function" and kills launch via Expo Router's boundary.
 *
 * Import this module before `uniwind` so the patch is in place first.
 * We intentionally never call through to native setColorScheme.
 */
const appearance = Appearance as typeof Appearance & {
  setColorScheme?: (scheme: string | null | undefined) => void;
};

appearance.setColorScheme = () => undefined;
