import { useVisualMode } from '@/src/ui/VisualModeProvider';
import { useSystemAppearance } from '@/src/ui/useSystemAppearance';

export type VisualMode = 'green' | 'yellow' | 'red';

const shared = {
  radius: 14,
  radii: { control: 10, button: 11, surface: 16, sheet: 22 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 32 },
  motion: { press: 150, state: 220 },
};

const greenLight = {
  ...shared,
  red: "#DD4F3D",
  orange: "#ED8D29",
  yellow: "#DBB428",
  green: "#1AC262",
  background: "#F9F7EC",
  surface: "#FFFDF7",
  text: "#293129",
  textMuted: "#6C766A",
  border: "#DDDBC7",
  primary: "#14B155",
  // Small text needs more weight than the bright brand green can carry on a light surface.
  primaryStrong: "#128A42",
  primaryText: "#062613",
  // Pale enough for primaryText to stay legible mid-blink.
  primaryFlash: "#8EDDBE",
  // Complete-button shimmer stays in a tight seasonal band around the mode accent.
  shimmer: ['#E8D56A', '#14B155', '#1AC262', '#8EDDBE'] as [string, string, string, string],
  shimmerGlow: ['rgba(232, 213, 106, 0.45)', 'rgba(26, 194, 98, 0.4)'] as [string, string],
  dangerSurface: "#F7E7E2",
  sunlight: "#FDF0BA",
};

const greenDark = {
  ...shared,
  red: "#F47A68",
  orange: "#F4A048",
  yellow: "#E7CA52",
  green: "#5AEB87",
  background: "#141C16",
  surface: "#1E2820",
  text: "#EFF1E9",
  textMuted: "#A0AEA0",
  border: "#374639",
  primary: "#44EB87",
  primaryStrong: "#6BEF9D",
  primaryText: "#052210",
  primaryFlash: "#A9F5CD",
  shimmer: ["#E7CA52", "#44EB87", "#5AEB87", "#A9F5CD"] as [string, string, string, string],
  shimmerGlow: ["rgba(231, 202, 82, 0.4)", "rgba(90, 235, 135, 0.35)"] as [string, string],
  dangerSurface: "#3B2926",
  sunlight: "#60542C",
};

const yellowLight: typeof greenLight = {
  ...greenLight,
  background: '#FFF8DE',
  surface: '#FFFEF4',
  text: '#332E1E',
  textMuted: '#766F58',
  border: '#E6D9A3',
  primary: '#F0B91B',
  primaryStrong: '#9A7000',
  primaryText: '#302200',
  primaryFlash: '#FBE9A8',
  shimmer: ['#FFE58A', '#F0B91B', '#ED8D29', '#FBE9A8'] as [string, string, string, string],
  shimmerGlow: ['rgba(255, 229, 138, 0.5)', 'rgba(237, 141, 41, 0.4)'] as [string, string],
  sunlight: '#FFE58A',
};

const yellowDark: typeof greenLight = {
  ...greenDark,
  background: '#211C0E',
  surface: '#2B2514',
  text: '#F5F0DC',
  textMuted: '#B7AD88',
  border: '#554A28',
  primary: '#F4C735',
  primaryStrong: '#F7D866',
  primaryText: '#302500',
  primaryFlash: '#FBEBB4',
  shimmer: ['#F7D866', '#F4C735', '#F4A048', '#FBEBB4'] as [string, string, string, string],
  shimmerGlow: ['rgba(247, 216, 102, 0.4)', 'rgba(244, 160, 72, 0.35)'] as [string, string],
  sunlight: '#6B581E',
};

const redLight: typeof greenLight = {
  ...greenLight,
  background: '#FFF0E9',
  surface: '#FFF9F5',
  text: '#392925',
  textMuted: '#7B665F',
  border: '#E9C9BC',
  primary: '#F06449',
  primaryStrong: '#B63F2E',
  primaryText: '#36110A',
  primaryFlash: '#F9C7B8',
  shimmer: ['#FFD6A3', '#F06449', '#DD4F3D', '#F9C7B8'] as [string, string, string, string],
  shimmerGlow: ['rgba(255, 214, 163, 0.5)', 'rgba(240, 100, 73, 0.4)'] as [string, string],
  sunlight: '#FFD6A3',
};

const redDark: typeof greenLight = {
  ...greenDark,
  background: '#211412',
  surface: '#2C1C19',
  text: '#F7EBE7',
  textMuted: '#BEA39C',
  border: '#5A3932',
  primary: '#F47A61',
  primaryStrong: '#FA9B87',
  primaryText: '#35100A',
  primaryFlash: '#FBD4C8',
  shimmer: ['#F4A048', '#F47A61', '#F47A68', '#FBD4C8'] as [string, string, string, string],
  shimmerGlow: ['rgba(244, 160, 72, 0.4)', 'rgba(244, 122, 97, 0.35)'] as [string, string],
  sunlight: '#6A3E27',
};

const palettes = {
  green: { light: greenLight, dark: greenDark },
  yellow: { light: yellowLight, dark: yellowDark },
  red: { light: redLight, dark: redDark },
};

export type Theme = typeof greenLight;

export function useTheme(): Theme {
  const { visualMode } = useVisualMode();
  const colorScheme = useSystemAppearance();
  return palettes[visualMode][colorScheme];
}

export function urgencyColor(
  theme: Theme,
  urgency: "green" | "yellow" | "orange" | "red",
): string {
  return theme[urgency];
}
