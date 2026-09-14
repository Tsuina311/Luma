import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
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
import { Button, Field, SectionTitle } from '@/src/components/ui';

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
  const [showPicker, setShowPicker] = useState<'date' | 'time'>();
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
      reminderOffsets: initialOffsets.filter((value): value is 0 | 1 | 3 | 7 =>
        reminderOptions.includes(value as 0 | 1 | 3 | 7)),
    },
  });
  const dueAt = useWatch({ control, name: 'dueAt' });
  const selectedOffsets = useWatch({ control, name: 'reminderOffsets' });
  const urgencyProfileId = useWatch({ control, name: 'urgencyProfileId' });
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
    setValue(
      'reminderOffsets',
      selectedOffsets.includes(offset)
        ? selectedOffsets.filter((value) => value !== offset)
        : [...selectedOffsets, offset].sort((a, b) => b - a),
      { shouldDirty: true },
    );
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

      <SectionTitle>When</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        <Button variant="secondary" onPress={() => setShowPicker('date')}>
          {format(dueDate, 'EEE, d MMM yyyy')}
        </Button>
        <Button variant="secondary" onPress={() => setShowPicker('time')}>
          {format(dueDate, timeFormat === '12h' ? 'h:mm a' : 'HH:mm')}
        </Button>
      </View>
      {showPicker ? (
        <DateTimePicker
          value={dueDate}
          mode={showPicker}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, value) => {
            if (Platform.OS !== 'ios') setShowPicker(undefined);
            if (value) setValue('dueAt', value.toISOString(), { shouldDirty: true, shouldValidate: true });
          }}
        />
      ) : null}
      {showPicker && Platform.OS === 'ios' ? (
        <Button variant="secondary" onPress={() => setShowPicker(undefined)}>Done</Button>
      ) : null}

      <SectionTitle>Urgency profile</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {profiles.map((profile) => {
          const selected = urgencyProfileId === profile.id;
          return (
            <Pressable
              key={profile.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setValue('urgencyProfileId', profile.id)}
              className={`rounded-full border px-4 py-2.5 ${
                selected ? 'border-primary bg-primary' : 'border-border bg-card'
              }`}
            >
              <Text className={`font-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>
                {profile.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Remind me</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {reminderOptions.map((offset) => {
          const selected = selectedOffsets.includes(offset);
          const label = offset === 0 ? 'On the day' : `${offset} day${offset === 1 ? '' : 's'} before`;
          return (
            <Pressable
              key={offset}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleOffset(offset)}
              className={`rounded-full border px-4 py-2.5 ${
                selected ? 'border-primary bg-primary' : 'border-border bg-card'
              }`}
            >
              <Text className={`font-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {saveError ? <Text className="text-sm text-destructive">{saveError}</Text> : null}
      <Button disabled={saving} onPress={() => void submit()}>
        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create deadline'}
      </Button>
    </View>
  );
}
