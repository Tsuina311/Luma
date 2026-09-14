import { useColorScheme } from 'react-native';

const shared = {
  red: '#C74A42',
  orange: '#C97832',
  yellow: '#9A7A24',
  green: '#427D64',
  radius: 14,
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
};

const light = {
  ...shared,
  background: '#F7F6F2',
  surface: '#FFFFFF',
  text: '#242521',
  textMuted: '#686A63',
  border: '#E2E0D8',
  primary: '#315F56',
  primaryText: '#FFFFFF',
  dangerSurface: '#F8E7E4',
};

const dark = {
  ...shared,
  background: '#171916',
  surface: '#222520',
  text: '#F3F1EA',
  textMuted: '#A8AAA2',
  border: '#383C35',
  primary: '#8FC7B6',
  primaryText: '#13201C',
  dangerSurface: '#422824',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function urgencyColor(theme: Theme, urgency: 'green' | 'yellow' | 'orange' | 'red'): string {
  return theme[urgency];
}
