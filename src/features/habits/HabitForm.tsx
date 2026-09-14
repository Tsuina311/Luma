import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { habitInputSchema, type Habit, type HabitInput } from '@/src/domain/habits/schemas';
import {
  getNotificationPermissionState,
  reconcileNotifications,
  requestNotificationPermission,
} from '@/src/services/notifications';
import { Button, Field, SectionTitle } from '@/src/components/ui';

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
      recurrence: initial?.recurrence ?? { type: 'daily' },
      targetType: initial?.targetType ?? 'boolean',
      targetValue: initial?.targetValue ?? 1,
      unit: initial?.unit ?? '',
      reminderTime: initial?.reminderTime,
      active: initial?.active ?? true,
    },
  });
  const recurrence = useWatch({ control, name: 'recurrence' });
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

  const setRecurrenceType = (type: 'daily' | 'weekdays' | 'weekly') => {
    if (type === 'daily') setValue('recurrence', { type: 'daily' });
    if (type === 'weekdays') setValue('recurrence', { type: 'weekdays', days: [1, 2, 3, 4, 5] });
    if (type === 'weekly') setValue('recurrence', { type: 'weekly', frequency: 3 });
  };

  return (
    <View className="gap-5">
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

      <SectionTitle>Frequency</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {(['daily', 'weekdays', 'weekly'] as const).map((type) => (
          <Choice
            key={type}
            label={type === 'daily' ? 'Every day' : type === 'weekdays' ? 'Selected days' : 'Times per week'}
            selected={recurrence.type === type}
            onPress={() => setRecurrenceType(type)}
          />
        ))}
      </View>
      {recurrence.type === 'weekdays' ? (
        <View className="flex-row justify-between gap-1">
          {weekdayLabels.map((label, day) => {
            const selected = recurrence.days.includes(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}
                accessibilityState={{ checked: selected }}
                onPress={() => setValue('recurrence', {
                  type: 'weekdays',
                  days: selected ? recurrence.days.filter((value) => value !== day) : [...recurrence.days, day],
                })}
                className={`h-11 w-11 items-center justify-center rounded-full border ${
                  selected ? 'border-primary bg-primary' : 'border-border bg-card'
                }`}
              >
                <Text className={`font-bold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {recurrence.type === 'weekly' ? (
        <Field
          label="Times per week"
          value={String(recurrence.frequency)}
          onChangeText={(value) => setValue('recurrence', { type: 'weekly', frequency: Number(value) })}
          keyboardType="number-pad"
          error={errors.recurrence?.message}
        />
      ) : null}

      <SectionTitle>Target</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        <Choice
          label="Done / not done"
          selected={targetType === 'boolean'}
          onPress={() => {
            setValue('targetType', 'boolean');
            setValue('targetValue', 1);
          }}
        />
        <Choice
          label="Number"
          selected={targetType === 'count'}
          onPress={() => {
            setValue('targetType', 'count');
            if (targetValue === 1) setValue('targetValue', 10);
          }}
        />
      </View>
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

      <SectionTitle>Reminder</SectionTitle>
      {reminderTime ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Button variant="secondary" onPress={() => setShowTimePicker(true)}>
              {format(reminderDate, timeFormat === '12h' ? 'h:mm a' : 'HH:mm')}
            </Button>
            <Button variant="secondary" onPress={() => setValue('reminderTime', undefined)}>Remove</Button>
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
            <Button variant="secondary" onPress={() => setShowTimePicker(false)}>Done</Button>
          ) : null}
        </>
      ) : (
        <Button variant="secondary" onPress={() => { setValue('reminderTime', '19:00'); setShowTimePicker(true); }}>
          Add reminder time
        </Button>
      )}

      {saveError ? <Text className="text-sm text-destructive">{saveError}</Text> : null}
      <Button disabled={saving} onPress={() => void submit()}>
        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create habit'}
      </Button>
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`rounded-full border px-4 py-2.5 ${
        selected ? 'border-primary bg-primary' : 'border-border bg-card'
      }`}
    >
      <Text className={`font-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>{label}</Text>
    </Pressable>
  );
}
