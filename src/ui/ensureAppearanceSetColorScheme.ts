import { Appearance } from 'react-native';

/**
 * Uniwind calls Appearance.setColorScheme when switching themes. On some Android
 * builds NativeAppearance.setColorScheme is missing and throws
 * "undefined is not a function", which takes down the whole app at launch.
 */
export function ensureAppearanceSetColorScheme() {
  const appearance = Appearance as typeof Appearance & {
    setColorScheme?: (scheme: string | null | undefined) => void;
  };

  if (typeof appearance.setColorScheme !== 'function') {
    appearance.setColorScheme = () => undefined;
    return;
  }

  const original = appearance.setColorScheme.bind(Appearance);
  appearance.setColorScheme = (scheme) => {
    try {
      original(scheme as never);
    } catch {
      // Theme CSS can still apply without forcing the OS color scheme.
    }
  };
}
