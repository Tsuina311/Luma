import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import {
  habitInputSchema,
  type Habit,
  type HabitInput,
  type HabitRecurrence,
} from '@/src/domain/habits/schemas';
import {
  getNotificationPermissionState,
  reconcileNotifications,
  requestNotificationPermission,
} from '@/src/services/notifications';
import {
  Button,
  Field,
  SectionHeader,
  SegmentedControl,
  TactilePressable,
} from '@/src/components/ui';
import { selectionFeedback } from '@/src/ui/feedback';

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type RecurrenceKind = HabitRecurrence['type'];

function defaultRecurrence(type: RecurrenceKind): HabitRecurrence {
  if (type === 'weekdays') return { type: 'weekdays', days: [1, 2, 3, 4, 5] };
  if (type === 'weekly') return { type: 'weekly', frequency: 2 };
  if (type === 'monthly') return { type: 'monthly', frequency: 4 };
  if (type === 'interval') return { type: 'interval', everyDays: 3 };
  return { type: 'daily' };
}

export function HabitForm({
  db,
  initial,
  timeFormat = '24h',
  onSaved,
}: {
  db: SQLiteDatabase;
  initial?: Habit;
  timeFormat?: '12h' | '24h';
  onSaved: (habit: Habit) => void;
}) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const { control, setValue, handleSubmit, formState: { errors } } = useForm<HabitInput>({
    resolver: zodResolver(habitInputSchema),
    defaultValues: {
      title: initial?.title ?? '',
      notes: initial?.notes ?? '',
      recurrence: initial?.recurrence ?? { type: 'weekly', frequency: 2 },
      targetType: initial?.targetType ?? 'boolean',
      targetValue: initial?.targetValue ?? 1,
      unit: initial?.unit ?? '',
      reminderTime: initial?.reminderTime,
      active: initial?.active ?? true,
    },
  });
  const recurrence = useWatch({ control, name: 'recurrence' }) ?? defaultRecurrence('weekly');
  const targetType = useWatch({ control, name: 'targetType' });
  const targetValue = useWatch({ control, name: 'targetValue' });
  const reminderTime = useWatch({ control, name: 'reminderTime' });
  const reminderDate = new Date(`2000-01-01T${reminderTime ?? '19:00'}:00`);

  const submit = handleSubmit(async (values) => {
    setSaving(true);
    setSaveError(undefined);
    let saved: Habit;
    try {
      saved = await new HabitRepository(db).save(values, initial?.id);
    } catch {
      setSaveError('The habit could not be saved. Check the details and try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved(saved);
    try {
      const permission = await getNotificationPermissionState();
      if (values.reminderTime && permission === 'undetermined') {
        Alert.alert(
          'Make this habit easier to remember?',
          'Luma can send the local reminder time you chose. Habit data stays on this device.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Enable reminders',
              onPress: () => {
                void requestNotificationPermission()
                  .then(() => reconcileNotifications(db))
                  .catch(() => undefined);
              },
            },
          ],
        );
      } else {
        await reconcileNotifications(db);
      }
    } catch {
      // The habit is safely stored; notification scheduling is best-effort.
    }
  });

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="title"
        render={({ field: { value, onBlur, onChange } }) => (
          <Field
            label="Title"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="What do you want to keep doing?"
            error={errors.title?.message}
            autoFocus={!initial}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field: { value, onBlur, onChange } }) => (
          <Field label="Notes (optional)" value={value} onBlur={onBlur} onChangeText={onChange} multiline />
        )}
      />

      <SectionHeader>Frequency</SectionHeader>
      <SegmentedControl
        accessibilityLabel="Habit frequency"
        value={recurrence.type}
        options={[
          { value: 'daily', label: 'Daily' },
          { value: 'weekdays', label: 'Days' },
          { value: 'weekly', label: 'Per week' },
          { value: 'monthly', label: 'Per month' },
          { value: 'interval', label: 'Every N days' },
        ]}
        onChange={(type) => setValue('recurrence', defaultRecurrence(type))}
      />
      {recurrence.type === 'weekdays' ? (
        <View className="flex-row justify-between gap-1">
          {weekdayLabels.map((label, day) => {
            const selected = recurrence.days.includes(day);
            return (
              <TactilePressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  selectionFeedback();
                  const days = selected
                    ? recurrence.days.filter((value) => value !== day)
                    : [...recurrence.days, day];
                  if (days.length === 0) return;
                  setValue('recurrence', { type: 'weekdays', days });
                }}
                className={`h-11 w-11 items-center justify-center rounded-[9px] border ${
                  selected ? 'border-primary bg-accent' : 'border-border bg-card'
                }`}
              >
                <Text className={`text-sm font-semibold ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{label}</Text>
              </TactilePressable>
            );
          })}
        </View>
      ) : null}
      {recurrence.type === 'weekly' ? (
        <Field
          label="Times per week"
          value={String(recurrence.frequency)}
          onChangeText={(value) => {
            const frequency = Math.max(1, Math.min(7, Number(value) || 0));
            setValue('recurrence', { type: 'weekly', frequency });
          }}
          keyboardType="number-pad"
          error={errors.recurrence?.message}
        />
      ) : null}
      {recurrence.type === 'monthly' ? (
        <Field
          label="Times per month"
          value={String(recurrence.frequency)}
          onChangeText={(value) => {
            const frequency = Math.max(1, Math.min(31, Number(value) || 0));
            setValue('recurrence', { type: 'monthly', frequency });
          }}
          keyboardType="number-pad"
          error={errors.recurrence?.message}
        />
      ) : null}
      {recurrence.type === 'interval' ? (
        <Field
          label="Every how many days?"
          value={String(recurrence.everyDays)}
          onChangeText={(value) => {
            const everyDays = Math.max(1, Math.min(365, Number(value) || 0));
            setValue('recurrence', { type: 'interval', everyDays });
          }}
          keyboardType="number-pad"
          error={errors.recurrence?.message}
        />
      ) : null}
      {recurrence.type === 'weekly' ? (
        <Text className="text-sm leading-5 text-[#F7F1DF]/70">
          Example: yoga twice a week. If you miss the weekly count, it turns overdue when the next week starts.
        </Text>
      ) : null}

      <SectionHeader>Target</SectionHeader>
      <SegmentedControl
        accessibilityLabel="Habit target type"
        value={targetType}
        options={[
          { value: 'boolean', label: 'Done / not done' },
          { value: 'count', label: 'Number' },
        ]}
        onChange={(value) => {
          if (value === 'boolean') {
            setValue('targetType', 'boolean');
            setValue('targetValue', 1);
          } else {
            setValue('targetType', 'count');
            if (targetValue === 1) setValue('targetValue', 10);
          }
        }}
      />
      {targetType === 'count' ? (
        <View className="gap-3">
          <Controller
            control={control}
            name="targetValue"
            render={({ field: { value, onChange } }) => (
              <Field
                label="Target amount"
                value={String(value)}
                onChangeText={(text) => onChange(Number(text))}
                keyboardType="decimal-pad"
                error={errors.targetValue?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="unit"
            render={({ field: { value, onChange } }) => (
              <Field label="Unit (optional)" value={value} onChangeText={onChange} placeholder="reps, minutes…" />
            )}
          />
        </View>
      ) : null}

      <SectionHeader>Reminder</SectionHeader>
      {reminderTime ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Button size="compact" variant="secondary" onPress={() => setShowTimePicker(true)}>
              {format(reminderDate, timeFormat === '12h' ? 'h:mm a' : 'HH:mm')}
            </Button>
            <Button size="compact" variant="ghost" onPress={() => setValue('reminderTime', undefined)}>Remove</Button>
          </View>
          {showTimePicker ? (
            <DateTimePicker
              value={reminderDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, value) => {
                if (Platform.OS !== 'ios') setShowTimePicker(false);
                if (value) {
                  setValue('reminderTime', `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`);
                }
              }}
            />
          ) : null}
          {showTimePicker && Platform.OS === 'ios' ? (
            <Button size="compact" variant="secondary" onPress={() => setShowTimePicker(false)}>Done</Button>
          ) : null}
        </>
      ) : (
        <Button size="compact" variant="secondary" onPress={() => { setValue('reminderTime', '19:00'); setShowTimePicker(true); }}>
          Add reminder time
        </Button>
      )}

      {saveError ? <Text className="text-sm text-destructive">{saveError}</Text> : null}
      <Button haptic disabled={saving} onPress={() => void submit()}>
        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create habit'}
      </Button>
    </View>
  );
}
