import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, GlassSurface, TactilePressable } from '@/src/components/ui';
import { selectionFeedback } from '@/src/ui/feedback';
import { useTheme } from '@/src/ui/theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const MINUTE_STEP = 5;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  value: Date;
  timeFormat?: '12h' | '24h';
  onChange: (next: Date) => void;
};

export function DueAtPicker({ value, timeFormat = '24h', onChange }: Props) {
  const theme = useTheme();
  const [sheet, setSheet] = useState<'date' | 'time' | null>(null);

  return (
    <>
      <GlassSurface className="overflow-hidden">
        <PickerRow
          label="Date"
          value={format(value, 'EEE, d MMM yyyy')}
          onPress={() => {
            selectionFeedback();
            setSheet('date');
          }}
        />
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />
        <PickerRow
          label="Time"
          value={format(value, timeFormat === '12h' ? 'h:mm a' : 'HH:mm')}
          emphasize
          onPress={() => {
            selectionFeedback();
            setSheet('time');
          }}
        />
      </GlassSurface>

      <DateSheet
        visible={sheet === 'date'}
        value={value}
        onClose={() => setSheet(null)}
        onConfirm={(next) => {
          onChange(mergeDate(value, next));
          setSheet(null);
        }}
      />

      <TimeSheet
        visible={sheet === 'time'}
        value={value}
        timeFormat={timeFormat}
        onClose={() => setSheet(null)}
        onConfirm={(next) => {
          onChange(mergeTime(value, next.hours, next.minutes));
          setSheet(null);
        }}
      />
    </>
  );
}

function PickerRow({
  label,
  value,
  emphasize = false,
  onPress,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TactilePressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      className="min-h-[64px] flex-row items-center justify-between px-4 py-3"
    >
      <Text style={{ color: theme.textMuted }} className="text-[13px] font-semibold uppercase tracking-[1.2px]">
        {label}
      </Text>
      <Text
        style={{ color: theme.text }}
        className={emphasize ? 'text-[28px] font-bold tracking-tight' : 'text-[17px] font-semibold'}
      >
        {value}
      </Text>
    </TactilePressable>
  );
}

function DateSheet({
  visible,
  value,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (next: Date) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(value.getFullYear());
  const [month, setMonth] = useState(value.getMonth() + 1);
  const [day, setDay] = useState(value.getDate());

  useEffect(() => {
    if (!visible) return;
    setYear(value.getFullYear());
    setMonth(value.getMonth() + 1);
    setDay(value.getDate());
  }, [visible, value]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return range(current - 1, current + 6);
  }, []);
  const months = useMemo(() => range(1, 12), []);
  const daysInMonth = daysInMonthCount(year, month);
  const days = useMemo(() => range(1, daysInMonth), [daysInMonth]);

  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [day, daysInMonth]);

  const draft = useMemo(() => {
    const next = new Date(value);
    next.setFullYear(year, month - 1, Math.min(day, daysInMonth));
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    return next;
  }, [value, year, month, day, daysInMonth]);

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={{ color: theme.text }} className="mb-1 text-center text-[17px] font-semibold">
        Due date
      </Text>
      <Text style={{ color: theme.primaryStrong }} className="mb-4 text-center text-[22px] font-bold tracking-tight">
        {format(draft, 'EEEE, d MMM yyyy')}
      </Text>

      <View className="mb-4 flex-row items-center justify-center gap-2">
        <WheelColumn
          width={56}
          values={days}
          value={Math.min(day, daysInMonth)}
          formatLabel={(n) => String(n)}
          onChange={(next) => {
            selectionFeedback();
            setDay(next);
          }}
        />
        <WheelColumn
          width={96}
          values={months}
          value={month}
          formatLabel={(n) => MONTH_LABELS[n - 1]!}
          onChange={(next) => {
            selectionFeedback();
            setMonth(next);
          }}
        />
        <WheelColumn
          width={72}
          values={years}
          value={year}
          formatLabel={(n) => String(n)}
          onChange={(next) => {
            selectionFeedback();
            setYear(next);
          }}
        />
      </View>

      <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <Button haptic onPress={() => onConfirm(draft)}>
          Set date
        </Button>
      </View>
    </SheetModal>
  );
}

function TimeSheet({
  visible,
  value,
  timeFormat,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: Date;
  timeFormat: '12h' | '24h';
  onClose: () => void;
  onConfirm: (next: { hours: number; minutes: number }) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const initial = useMemo(() => splitTime(value, timeFormat), [value, timeFormat]);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  useEffect(() => {
    if (!visible) return;
    const next = splitTime(value, timeFormat);
    setHour(next.hour);
    setMinute(next.minute);
    setPeriod(next.period);
  }, [visible, value, timeFormat]);

  const hours = useMemo(
    () => (timeFormat === '12h' ? range(1, 12) : range(0, 23)),
    [timeFormat],
  );
  const minutes = useMemo(() => range(0, 59).filter((n) => n % MINUTE_STEP === 0), []);

  const preview = format(
    mergeTime(value, toHours24(hour, period, timeFormat), minute),
    timeFormat === '12h' ? 'h:mm a' : 'HH:mm',
  );

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={{ color: theme.text }} className="mb-1 text-center text-[17px] font-semibold">
        Due time
      </Text>
      <Text style={{ color: theme.primaryStrong }} className="mb-4 text-center text-[34px] font-bold tracking-tight">
        {preview}
      </Text>

      <View className="mb-4 flex-row items-center justify-center gap-2">
        <WheelColumn
          values={hours}
          value={hour}
          formatLabel={(n) => String(n).padStart(timeFormat === '24h' ? 2 : 1, '0')}
          onChange={(next) => {
            selectionFeedback();
            setHour(next);
          }}
        />
        <Text style={{ color: theme.text }} className="pb-1 text-[28px] font-bold">
          :
        </Text>
        <WheelColumn
          values={minutes}
          value={minute}
          formatLabel={(n) => String(n).padStart(2, '0')}
          onChange={(next) => {
            selectionFeedback();
            setMinute(next);
          }}
        />
        {timeFormat === '12h' ? (
          <WheelColumn
            values={[0, 1]}
            value={period === 'AM' ? 0 : 1}
            formatLabel={(n) => (n === 0 ? 'AM' : 'PM')}
            onChange={(next) => {
              selectionFeedback();
              setPeriod(next === 0 ? 'AM' : 'PM');
            }}
          />
        ) : null}
      </View>

      <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <Button
          haptic
          onPress={() => {
            onConfirm({ hours: toHours24(hour, period, timeFormat), minutes: minute });
          }}
        >
          Set time
        </Button>
      </View>
    </SheetModal>
  );
}

function SheetModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.sheetWrap}>
          <GlassSurface className="px-4 pt-4">{children}</GlassSurface>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function WheelColumn({
  values,
  value,
  formatLabel,
  onChange,
  width = 72,
}: {
  values: number[];
  value: number;
  formatLabel: (value: number) => string;
  onChange: (value: number) => void;
  width?: number;
}) {
  const theme = useTheme();
  const index = Math.max(0, values.indexOf(value));
  const maxIndex = Math.max(0, values.length - 1);
  const padding = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
  const translateY = useSharedValue(-index * ITEM_HEIGHT);
  const dragStartY = useSharedValue(-index * ITEM_HEIGHT);

  useEffect(() => {
    translateY.value = -index * ITEM_HEIGHT;
    dragStartY.value = -index * ITEM_HEIGHT;
  }, [dragStartY, index, translateY, values.length]);

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const next = values[nextIndex];
      if (next !== undefined && next !== value) onChange(next);
    },
    [onChange, value, values],
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const minY = -maxIndex * ITEM_HEIGHT;
      const next = dragStartY.value + event.translationY;
      const overscroll = ITEM_HEIGHT * 0.4;
      translateY.value = Math.min(overscroll, Math.max(minY - overscroll, next));
    })
    .onEnd((event) => {
      const projected = translateY.value + event.velocityY * 0.06;
      const rawIndex = Math.round(-projected / ITEM_HEIGHT);
      const nearest = Math.min(maxIndex, Math.max(0, rawIndex));
      translateY.value = withTiming(
        -nearest * ITEM_HEIGHT,
        { duration: 200, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(commitIndex)(nearest);
        },
      );
    });

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.wheel, { width }]}>
      <View pointerEvents="none" style={[styles.wheelHighlight, { borderColor: theme.border }]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ paddingVertical: padding }, listStyle]}>
          {values.map((entry) => {
            const selected = entry === value;
            return (
              <View key={entry} style={styles.wheelItem}>
                <Text
                  style={{ color: selected ? theme.text : theme.textMuted }}
                  className={`text-center ${selected ? 'text-[22px] font-bold' : 'text-[18px] font-medium'}`}
                >
                  {formatLabel(entry)}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>
      <View pointerEvents="none" style={[styles.wheelFadeTop, { backgroundColor: theme.background }]} />
      <View pointerEvents="none" style={[styles.wheelFadeBottom, { backgroundColor: theme.background }]} />
    </View>
  );
}

function splitTime(date: Date, timeFormat: '12h' | '24h') {
  const minutes = Math.round(date.getMinutes() / MINUTE_STEP) * MINUTE_STEP;
  const normalizedMinutes = minutes === 60 ? 0 : minutes;
  let hours24 = date.getHours();
  if (minutes === 60) hours24 = (hours24 + 1) % 24;

  if (timeFormat === '24h') {
    return { hour: hours24, minute: normalizedMinutes, period: hours24 >= 12 ? ('PM' as const) : ('AM' as const) };
  }

  const period = hours24 >= 12 ? ('PM' as const) : ('AM' as const);
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return { hour: hour12, minute: normalizedMinutes, period };
}

function toHours24(hour: number, period: 'AM' | 'PM', timeFormat: '12h' | '24h') {
  if (timeFormat === '24h') return hour;
  if (hour === 12) return period === 'AM' ? 0 : 12;
  return period === 'PM' ? hour + 12 : hour;
}

function mergeDate(base: Date, next: Date) {
  const merged = new Date(base);
  merged.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return merged;
}

function mergeTime(base: Date, hours: number, minutes: number) {
  const merged = new Date(base);
  merged.setHours(hours, minutes, 0, 0);
  return merged;
}

function range(from: number, to: number) {
  const values: number[] = [];
  for (let value = from; value <= to; value += 1) values.push(value);
  return values;
}

function daysInMonthCount(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 24, 18, 0.45)',
  },
  sheetWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  wheel: {
    height: WHEEL_HEIGHT,
    overflow: 'hidden',
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    zIndex: 2,
  },
  wheelFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    opacity: 0.72,
    zIndex: 1,
  },
  wheelFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    opacity: 0.72,
    zIndex: 1,
  },
});
