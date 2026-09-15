import { Divider as GSDivider } from "@/components/ui/divider";
import { Input, InputField } from "@/components/ui/input";
import { ScrollView } from "@/components/ui/scroll-view";
import { selectionFeedback } from "@/src/ui/feedback";
import { useTheme } from "@/src/ui/theme";
import { useSystemAppearance } from "@/src/ui/useSystemAppearance";
import { BlurView } from "expo-blur";
import {
  forwardRef,
  useEffect,
  type ComponentRef,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Screen({
  children,
  scroll = true,
  compact = false,
}: PropsWithChildren<{ scroll?: boolean; compact?: boolean }>) {
  const content = (
    <View
      className={`flex-1 px-5 pb-8 pt-4 web:mx-auto web:w-full web:max-w-3xl ${compact ? "gap-3" : "gap-5"}`}
    >
      {children}
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-transparent" edges={["bottom"]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4 pb-1">
      <View className="flex-1 gap-1">
        {eyebrow ? (
          <View className="flex-row items-center gap-2">
            <LumaMark size="small" />
            <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[#F7F1DF]/70">
              {eyebrow}
            </Text>
          </View>
        ) : null}
        <Text
          className="text-[29px] font-bold leading-9 tracking-[-0.7px] text-[#F7F1DF]"
          maxFontSizeMultiplier={1.35}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm leading-5 text-[#F7F1DF]/70">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function SectionHeader({ children }: PropsWithChildren) {
  return (
    <View className="mt-1 flex-row items-center gap-2">
      <View className="h-1.5 w-1.5 rounded-full bg-primary" />
      <Text className="text-[11px] font-semibold uppercase tracking-[1.4px] text-[#F7F1DF]/70">
        {children}
      </Text>
    </View>
  );
}

export const SectionTitle = SectionHeader;

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">{label}</Text>
      {props.multiline ? (
        <TextInput
          {...props}
          className={`min-h-24 rounded-[10px] border bg-card px-3.5 py-3 text-base text-foreground web:outline-none ${
            error ? "border-destructive" : "border-border"
          }`}
          placeholderTextColor={theme.textMuted}
          textAlignVertical="top"
        />
      ) : (
        <Input
          className={`min-h-12 rounded-[10px] bg-card px-0.5 ${error ? "border-destructive" : "border-border"}`}
        >
          <InputField
            {...props}
            className="px-3 text-base text-foreground"
            placeholderTextColor={theme.textMuted}
          />
        </Input>
      )}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "default",
  onPress,
  disabled,
  accessibilityLabel,
  haptic = false,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "tended" | "danger" | "ghost";
  size?: "compact" | "default";
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  haptic?: boolean;
}) {
  const variantClass = {
    primary: "border-primary bg-primary",
    secondary: "border-border bg-card",
    tended: "border-primary/40 bg-accent",
    danger: "border-destructive/30 bg-destructive/10",
    ghost: "border-transparent bg-transparent",
  }[variant];
  const textClass =
    variant === "primary"
      ? "text-primary-foreground"
      : variant === "tended"
        ? "text-accent-foreground"
        : variant === "danger"
          ? "text-destructive"
          : variant === "ghost"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <TactilePressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (haptic) selectionFeedback();
        onPress?.();
      }}
      className={`items-center justify-center rounded-[11px] border ${
        size === "compact" ? "min-h-10 px-3.5" : "min-h-12 px-5"
      } ${variantClass}`}
    >
      <Text
        className={`${size === "compact" ? "text-sm" : "text-[15px]"} font-semibold ${textClass}`}
      >
        {children}
      </Text>
    </TactilePressable>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View className="my-8 min-h-48 items-center justify-center gap-2 px-6">
      <View className="mb-2 h-12 w-12 items-center justify-center rounded-[18px] bg-white/10">
        <LumaMark />
      </View>
      <Text className="text-center text-xl font-semibold tracking-tight text-[#F7F1DF]">
        {title}
      </Text>
      <Text className="mb-3 max-w-sm text-center text-sm leading-5 text-[#F7F1DF]/75">
        {message}
      </Text>
      {action}
    </View>
  );
}

export function LoadingState() {
  const theme = useTheme();
  return (
    <View className="min-h-64 flex-1 items-center justify-center">
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <EmptyState
      title="Something went wrong"
      message={message}
      action={<Button onPress={retry}>Try again</Button>}
    />
  );
}

export function Divider() {
  return <GSDivider className="bg-border" />;
}

const GLASS_BLUR_PX = 2.5;
const GLASS_BLUR_INTENSITY = 11;
const GLASS_FACE_ALPHA = 0.8;
const GLASS_BORDER_ALPHA = 0.55;

function colorWithAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgbChannels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string): string {
  const { r, g, b } = hexToRgbChannels(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgbChannels(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : normalized;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function themeInsetGlow(hex: string): string {
  const color = hexToRgb(hex);
  return [
    `${color} 0px 20px 39px inset`,
    `${color} 0px -6px 20px inset`,
    `${color} 6px 0px 20px inset`,
    `${color} -6px 0px 20px inset`,
  ].join(', ');
}

const glassStyles = StyleSheet.create({
  pane: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${GLASS_BLUR_PX}px)`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR_PX}px)`,
        } as object)
      : {}),
  },
});

export const GlassSurface = forwardRef<
  ComponentRef<typeof View>,
  PropsWithChildren<ViewProps & { className?: string }>
>(function GlassSurface({ children, className = '', style, ...props }, ref) {
  const theme = useTheme();
  const appearance = useSystemAppearance();
  const dark = appearance === 'dark';
  const tint = dark ? 'dark' : 'light';
  const paneStyle = [
    glassStyles.pane,
    {
      backgroundColor: colorWithAlpha(theme.background, GLASS_FACE_ALPHA),
      borderColor: colorWithAlpha(theme.border, GLASS_BORDER_ALPHA),
    },
    Platform.OS === 'web'
      ? ({ boxShadow: themeInsetGlow(theme.background) } as object)
      : {
          shadowColor: theme.background,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 20,
          elevation: 0,
        },
    style,
  ];

  if (Platform.OS === 'web') {
    return (
      <View ref={ref} className={className} style={paneStyle} {...props}>
        {children}
      </View>
    );
  }

  return (
    <BlurView
      ref={ref as never}
      intensity={GLASS_BLUR_INTENSITY}
      tint={tint}
      className={className}
      style={paneStyle}
      {...props}
    >
      {children}
    </BlurView>
  );
});

export function GroupSurface({
  children,
  className = "",
}: PropsWithChildren<{ className?: string }>) {
  return (
    <GlassSurface className={`px-4 ${className}`}>{children}</GlassSurface>
  );
}

export function LumaMark({ size = "default" }: { size?: "small" | "default" }) {
  const small = size === "small";
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={small ? "relative h-3.5 w-4" : "relative h-6 w-7"}
    >
      <View
        className={`absolute bottom-0 left-1/2 rounded-full bg-primary ${small ? "h-2.5 w-px" : "h-4 w-0.5"}`}
      />
      <View
        className={`absolute rounded-[100%] bg-primary ${small ? "left-1 top-0 h-2 w-2.5" : "left-0.5 top-0 h-3.5 w-4"}`}
        style={{ transform: [{ rotate: "-28deg" }] }}
      />
      <View
        className={`absolute rounded-[100%] bg-urgency-green ${small ? "right-0 top-0.5 h-1.5 w-2" : "right-0 top-1 h-3 w-3.5"}`}
        style={{ transform: [{ rotate: "30deg" }] }}
      />
    </View>
  );
}

export function GrowthStem({
  tone,
}: {
  tone: "green" | "yellow" | "orange" | "red" | "neutral";
}) {
  const color = {
    green: "bg-urgency-green",
    yellow: "bg-urgency-yellow",
    orange: "bg-urgency-orange",
    red: "bg-urgency-red",
    neutral: "bg-border",
  }[tone];
  return (
    <View className="absolute bottom-2.5 left-0 top-2.5 w-2.5">
      <View
        className={`absolute bottom-0 left-0 top-0 w-1 rounded-full ${color}`}
      />
      <View
        className={`absolute left-0.5 top-1.5 h-2.5 w-3 rounded-[100%] ${color}`}
        style={{ transform: [{ rotate: "-30deg" }] }}
      />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className="flex-row self-start rounded-[11px] border border-border bg-secondary/70 p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TactilePressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                selectionFeedback();
                onChange(option.value);
              }
            }}
            className="relative min-h-10 min-w-24 items-center justify-center overflow-hidden rounded-[9px] px-3"
          >
            {selected ? (
              <Animated.View
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
                className="absolute inset-0 rounded-[9px] border border-primary/25 bg-accent"
              />
            ) : null}
            <Text
              className={`z-10 text-sm ${selected ? "font-semibold text-accent-foreground" : "font-medium text-muted-foreground"}`}
            >
              {option.label}
            </Text>
          </TactilePressable>
        );
      })}
    </View>
  );
}

export function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text className="flex-1 text-[15px] font-medium text-[#F7F1DF]">
        {label}
      </Text>
      {value ? (
        <Text className="text-sm text-muted-foreground">{value}</Text>
      ) : null}
      {onPress ? (
        <Text className="ml-1 text-xl text-muted-foreground">›</Text>
      ) : null}
    </>
  );
  return onPress ? (
    <TactilePressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, ${value}` : ""}`}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 py-1"
    >
      {content}
    </TactilePressable>
  ) : (
    <View className="min-h-12 flex-row items-center gap-3 py-1">{content}</View>
  );
}

export function ProgressBar({
  value,
  urgency,
}: {
  value: number;
  urgency?: "green" | "yellow" | "orange" | "red";
}) {
  const progress = useSharedValue(Math.max(0, Math.min(100, value)));
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));
  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, value)), {
      duration: 210,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);
  const color = urgency
    ? {
        green: "bg-urgency-green",
        yellow: "bg-urgency-yellow",
        orange: "bg-urgency-orange",
        red: "bg-urgency-red",
      }[urgency]
    : "bg-primary";
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      className="h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <Animated.View
        className={`h-full rounded-full ${color}`}
        style={animatedStyle}
      />
    </View>
  );
}

type TactilePressableProps = PressableProps & {
  children: ReactNode;
  className?: string;
};

export function TactilePressable({
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: TactilePressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: scale.value < 1 ? 0.86 : 1,
    transform: [{ scale: scale.value }],
  }));
  const timing = { duration: 140, easing: Easing.out(Easing.quad) };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        scale.set(withTiming(0.985, timing));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, timing));
        onPressOut?.(event);
      }}
      className={`${disabled ? "opacity-40" : ""} ${props.className ?? ""}`}
      style={animatedStyle}
    >
      {children}
    </AnimatedPressable>
  );
}
