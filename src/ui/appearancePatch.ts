import { Appearance } from 'react-native';

/**
 * Uniwind calls Appearance.setColorScheme on theme changes. On some Android
 * runtimes that native call throws (or is missing), which surfaces as
 * "undefined is not a function" and kills launch via Expo Router's boundary.
 *
 * This module must load before Uniwind (see index.js). We intentionally never
 * call through to native setColorScheme.
 */
const noop = (_scheme?: string | null) => undefined;

const appearance = Appearance as typeof Appearance & {
  setColorScheme?: (scheme: string | null | undefined) => void;
};

try {
  appearance.setColorScheme = noop;
} catch {
  // Assignment can fail if the property is non-writable.
}

try {
  Object.defineProperty(Appearance, 'setColorScheme', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: noop,
  });
} catch {
  // Last resort already attempted via assignment above.
}
