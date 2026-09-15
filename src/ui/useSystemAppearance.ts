import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type SystemAppearance = 'light' | 'dark';

function getWebAppearance(): SystemAppearance {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useSystemAppearance(): SystemAppearance {
  const nativeAppearance = useColorScheme();
  const [webAppearance, setWebAppearance] = useState<SystemAppearance>(getWebAppearance);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setWebAppearance(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (Platform.OS === 'web') return webAppearance;
  return nativeAppearance === 'dark' ? 'dark' : 'light';
}
