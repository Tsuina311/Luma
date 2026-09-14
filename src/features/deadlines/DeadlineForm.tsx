import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useTheme } from '@/src/ui/theme';

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
  const theme = useTheme();
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
    <View style={styles.form}>
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
      <View style={styles.pickerRow}>
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
      <View style={styles.choices}>
        {profiles.map((profile) => {
          const selected = urgencyProfileId === profile.id;
          return (
            <Pressable
              key={profile.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setValue('urgencyProfileId', profile.id)}
              style={[
                styles.choice,
                { backgroundColor: selected ? theme.primary : theme.surface, borderColor: selected ? theme.primary : theme.border },
              ]}
            >
              <Text style={{ color: selected ? theme.primaryText : theme.text, fontWeight: '600' }}>
                {profile.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Remind me</SectionTitle>
      <View style={styles.choices}>
        {reminderOptions.map((offset) => {
          const selected = selectedOffsets.includes(offset);
          const label = offset === 0 ? 'On the day' : `${offset} day${offset === 1 ? '' : 's'} before`;
          return (
            <Pressable
              key={offset}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleOffset(offset)}
              style={[
                styles.choice,
                { backgroundColor: selected ? theme.primary : theme.surface, borderColor: selected ? theme.primary : theme.border },
              ]}
            >
              <Text style={{ color: selected ? theme.primaryText : theme.text, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {saveError ? <Text style={{ color: theme.red }}>{saveError}</Text> : null}
      <Button disabled={saving} onPress={() => void submit()}>
        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create deadline'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  pickerRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
});
