import { useColorScheme } from 'react-native';

const shared = {
  red: '#E45868',
  orange: '#E58B3D',
  yellow: '#C8A43D',
  green: '#48A47A',
  radius: 18,
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
};

const light = {
  ...shared,
  background: '#F8F7FC',
  surface: '#FFFFFF',
  text: '#1F1B30',
  textMuted: '#6D687F',
  border: '#E5E2EE',
  primary: '#6553F2',
  primaryText: '#FFFFFF',
  dangerSurface: '#FDEDEF',
};

const dark = {
  ...shared,
  background: '#0E0D15',
  surface: '#191724',
  text: '#F6F3FF',
  textMuted: '#A59FB5',
  border: '#343044',
  primary: '#9E8FFF',
  primaryText: '#15112B',
  dangerSurface: '#3D222A',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function urgencyColor(theme: Theme, urgency: 'green' | 'yellow' | 'orange' | 'red'): string {
  return theme[urgency];
}
