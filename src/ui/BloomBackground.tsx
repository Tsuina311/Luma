import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useVisualMode } from '@/src/ui/VisualModeProvider';
import { useSystemAppearance } from '@/src/ui/useSystemAppearance';
import type { VisualMode } from '@/src/ui/theme';

const blooms: Record<VisualMode, number> = {
  green: require('@/assets/images/attention-bloom-green.png'),
  yellow: require('@/assets/images/attention-bloom-yellow.png'),
  red: require('@/assets/images/attention-bloom-red.png'),
};

const modes: VisualMode[] = ['green', 'yellow', 'red'];
const modeIndex: Record<VisualMode, number> = { green: 0, yellow: 1, red: 2 };

const canvasColors = {
  light: ['#F9F7EC', '#FFF8DE', '#FFF0E9'] as const,
  dark: ['#141C16', '#211C0E', '#211412'] as const,
};

const TRANSITION_MS = 520;
const timing = { duration: TRANSITION_MS, easing: Easing.out(Easing.cubic) };

export function BloomBackground() {
  const { visualMode } = useVisualMode();
  const appearance = useSystemAppearance();
  const { width, height } = useWindowDimensions();
  const modeProgress = useSharedValue(modeIndex[visualMode]);
  const greenOpacity = useSharedValue(visualMode === 'green' ? 1 : 0);
  const yellowOpacity = useSharedValue(visualMode === 'yellow' ? 1 : 0);
  const redOpacity = useSharedValue(visualMode === 'red' ? 1 : 0);

  useEffect(() => {
    modeProgress.value = withTiming(modeIndex[visualMode], timing);
    greenOpacity.value = withTiming(visualMode === 'green' ? 1 : 0, timing);
    yellowOpacity.value = withTiming(visualMode === 'yellow' ? 1 : 0, timing);
    redOpacity.value = withTiming(visualMode === 'red' ? 1 : 0, timing);
  }, [visualMode, greenOpacity, yellowOpacity, redOpacity, modeProgress]);

  const canvasStyle = useAnimatedStyle(() => {
    const colors = canvasColors[appearance];
    return {
      backgroundColor: interpolateColor(modeProgress.value, [0, 1, 2], [...colors]),
    };
  }, [appearance]);

  const opacities = {
    green: greenOpacity,
    yellow: yellowOpacity,
    red: redOpacity,
  };

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { width, height }, canvasStyle]}>
      {modes.map((mode) => (
        <BloomLayer
          key={mode}
          mode={mode}
          opacity={opacities[mode]}
          width={width}
          height={height}
        />
      ))}
    </Animated.View>
  );
}

function BloomLayer({
  mode,
  opacity,
  width,
  height,
}: {
  mode: VisualMode;
  opacity: SharedValue<number>;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={blooms[mode]}
        contentFit="cover"
        cachePolicy="memory-disk"
        style={{ width, height }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
});
