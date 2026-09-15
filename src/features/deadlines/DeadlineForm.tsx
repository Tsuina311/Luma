import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import {
  deadlineInputSchema,
  type Deadline,
  type DeadlineInput,
  type UrgencyProfile,
} from '@/src/domain/deadlines/schemas';
import {
  getNotificationPermissionState,
  reconcileNotifications,
  requestNotificationPermission,
} from '@/src/services/notifications';
import { Button, Field, SectionHeader, SegmentedControl, TactilePressable } from '@/src/components/ui';
import { DueAtPicker } from '@/src/features/deadlines/DueAtPicker';
import { selectionFeedback } from '@/src/ui/feedback';

const reminderOptions = [7, 3, 1, 0] as const;

type Props = {
  db: SQLiteDatabase;
  profiles: UrgencyProfile[];
  initial?: Deadline;
  initialOffsets?: number[];
  timeFormat?: '12h' | '24h';
  onSaved: (deadline: Deadline) => void;
};

export function DeadlineForm({ db, profiles, initial, initialOffsets = [], timeFormat = '24h', onSaved }: Props) {
  const defaultProfile = profiles.find((profile) => profile.isDefault) ?? profiles[0];
  const [urgencyUnit, setUrgencyUnit] = useState<'hours' | 'days'>(
    initial && initial.urgentBeforeMinutes < 1440 ? 'hours' : 'days',
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [defaultDueAt] = useState(() => new Date(Date.now() + 86_400_000).toISOString());
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<DeadlineInput>({
    resolver: zodResolver(deadlineInputSchema),
    defaultValues: {
      title: initial?.title ?? '',
      notes: initial?.notes ?? '',
      dueAt: initial?.dueAt ?? defaultDueAt,
      urgencyProfileId: initial?.urgencyProfileId ?? defaultProfile?.id ?? 'normal',
      urgentBeforeMinutes: initial?.urgentBeforeMinutes ?? 1440,
      reminderOffsets: initialOffsets.filter((value): value is 0 | 1 | 3 | 7 =>
        reminderOptions.includes(value as 0 | 1 | 3 | 7)),
    },
  });
  const dueAt = useWatch({ control, name: 'dueAt' });
  const selectedOffsets = useWatch({ control, name: 'reminderOffsets' });
  const urgentBeforeMinutes = useWatch({ control, name: 'urgentBeforeMinutes' });
  const dueDate = new Date(dueAt);

  const submit = handleSubmit(async (values) => {
    setSaving(true);
    setSaveError(undefined);
    let saved: Deadline;
    try {
      saved = await new DeadlineRepository(db).save(values, initial?.id);
    } catch {
      setSaveError('The deadline could not be saved. Check the details and try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved(saved);
    try {
      const permission = await getNotificationPermissionState();
      if (values.reminderOffsets.length > 0 && permission === 'undetermined') {
        Alert.alert(
          'Stay ahead of this deadline?',
          'Luma can send local reminders you chose. Your deadline stays only on this device.',
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
      // The deadline is safely stored; notification scheduling is best-effort.
    }
  });

  const toggleOffset = (offset: 0 | 1 | 3 | 7) => {
    selectionFeedback();
    setValue(
      'reminderOffsets',
      selectedOffsets.includes(offset)
        ? selectedOffsets.filter((value) => value !== offset)
        : [...selectedOffsets, offset].sort((a, b) => b - a),
      { shouldDirty: true },
    );
  };

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
            placeholder="What needs to happen?"
            error={errors.title?.message}
            autoFocus={!initial}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field: { value, onBlur, onChange } }) => (
          <Field
            label="Notes (optional)"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Useful context or next step"
            multiline
            error={errors.notes?.message}
          />
        )}
      />

      <SectionHeader>When</SectionHeader>
      <DueAtPicker
        value={dueDate}
        timeFormat={timeFormat}
        onChange={(next) => {
          setValue('dueAt', next.toISOString(), { shouldDirty: true, shouldValidate: true });
        }}
      />

      <SectionHeader>Become urgent</SectionHeader>
      <Text className="text-sm text-muted-foreground">Show yellow this long before it is due.</Text>
      <View className="flex-row items-end gap-3">
        <View className="w-28">
          <Field
            label="Before due"
            value={String(Math.max(1, Math.round(
              urgentBeforeMinutes / (urgencyUnit === 'days' ? 1440 : 60),
            )))}
            onChangeText={(value) => {
              const amount = Number.parseInt(value, 10);
              if (Number.isFinite(amount)) {
                setValue(
                  'urgentBeforeMinutes',
                  amount * (urgencyUnit === 'days' ? 1440 : 60),
                  { shouldDirty: true, shouldValidate: true },
                );
              }
            }}
            keyboardType="number-pad"
            error={errors.urgentBeforeMinutes?.message}
          />
        </View>
        <SegmentedControl
          accessibilityLabel="Urgency time unit"
          value={urgencyUnit}
          options={[
            { value: 'hours', label: 'Hours' },
            { value: 'days', label: 'Days' },
          ]}
          onChange={setUrgencyUnit}
        />
      </View>

      <SectionHeader>Remind me</SectionHeader>
      <View className="flex-row flex-wrap gap-2">
        {reminderOptions.map((offset) => {
          const selected = selectedOffsets.includes(offset);
          const label = offset === 0 ? 'On the day' : `${offset} day${offset === 1 ? '' : 's'} before`;
          return (
            <TactilePressable
              key={offset}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleOffset(offset)}
              className={`min-h-10 justify-center rounded-[9px] border px-3.5 ${
                selected ? 'border-primary bg-accent' : 'border-border bg-card'
              }`}
            >
              <Text className={`text-sm ${selected ? 'font-semibold text-accent-foreground' : 'font-medium text-foreground'}`}>
                {selected ? '✓  ' : ''}{label}
              </Text>
            </TactilePressable>
          );
        })}
      </View>
      {saveError ? <Text className="text-sm text-destructive">{saveError}</Text> : null}
      <Button haptic disabled={saving} onPress={() => void submit()}>
        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create deadline'}
      </Button>
    </View>
  );
}
