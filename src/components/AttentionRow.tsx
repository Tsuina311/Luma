import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { AttentionItem } from '@/src/domain/shared';
import { GrowthStem, TactilePressable } from '@/src/components/ui';
import { useTheme } from '@/src/ui/theme';

const urgencyLabel = {
  red: 'Overdue',
  orange: 'Needs care',
  yellow: 'Approaching',
  green: 'Comfortable',
};

const urgencyClasses = {
  red: 'text-urgency-red-ink',
  orange: 'text-urgency-orange-ink',
  yellow: 'text-urgency-yellow-ink',
  green: 'text-urgency-green-ink',
};

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function AttentionRow({
  item,
  onPress,
  onComplete,
}: {
  item: AttentionItem;
  onPress: () => void;
  onComplete: () => void;
}) {
  const textColor = urgencyClasses[item.urgency];
  return (
    <View className="relative min-h-[76px] flex-row items-center gap-3 overflow-hidden pl-5 pr-1">
      <GrowthStem tone={item.urgency} />
      <TactilePressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${urgencyLabel[item.urgency]}. ${item.subtitle}`}
        className="flex-1 justify-center gap-1.5 py-3"
      >
        <Text className={`text-[16px] font-semibold leading-5 ${textColor}`} numberOfLines={2}>
          {item.title}
        </Text>
        <Text className={`text-sm ${textColor} opacity-80`}>{item.subtitle}</Text>
      </TactilePressable>
      <CompleteButton onPress={onComplete} />
    </View>
  );
}

function CompleteButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const shimmer = useSharedValue(0);
  const blink = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shimmer]);

  const glowStyle = useAnimatedStyle(() => {
    const soft = interpolate(shimmer.value, [0, 1], [10, 6]);
    const opacity = interpolate(shimmer.value, [0, 1], [0.5, 0.28]);
    if (Platform.OS === 'web') {
      return {
        boxShadow: `-2px -2px ${soft}px ${theme.shimmerGlow[0]}, 2px 2px ${soft}px ${theme.shimmerGlow[1]}`,
      };
    }
    return {
      shadowColor: theme.shimmer[0],
      shadowOffset: { width: -2, height: -2 },
      shadowOpacity: opacity,
      shadowRadius: soft,
      elevation: interpolate(shimmer.value, [0, 1], [6, 3]),
    };
  });

  const gradientStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(shimmer.value, [0, 1], [-18, 0]),
    }],
    opacity: interpolate(blink.value, [0, 1], [1, 0.35]),
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: blink.value,
  }));

  return (
    <Animated.View className="h-12 w-14 rounded-[11px]" style={glowStyle}>
      <View className="h-full w-full overflow-hidden rounded-[11px]">
        <AnimatedLinearGradient
          colors={[...theme.shimmer]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          locations={[0, 0.3, 0.7, 1]}
          style={[{ position: 'absolute', top: 0, bottom: 0, left: -18, width: 92 }, gradientStyle]}
        />
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 rounded-[11px]"
          style={[{ backgroundColor: theme.primaryFlash }, flashStyle]}
        />
        <TactilePressable
          accessibilityRole="button"
          accessibilityLabel="Complete item"
          onPress={() => {
            blink.value = withSequence(
              withTiming(1, { duration: 130 }),
              withTiming(0, { duration: 180 }, (finished) => {
                if (finished) runOnJS(onPress)();
              }),
            );
          }}
          className="h-full w-full items-center justify-center"
        >
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            tintColor={theme.primaryText}
            size={25}
            weight="bold"
          />
        </TactilePressable>
      </View>
    </Animated.View>
  );
}
