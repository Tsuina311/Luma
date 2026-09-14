import { addDays, setHours } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { toLocalDateKey } from '@/src/utils/dates';

export async function seedDevelopmentData(db: SQLiteDatabase): Promise<boolean> {
  if (!__DEV__) return false;
  const deadlines = new DeadlineRepository(db);
  const habits = new HabitRepository(db);
  const [existingDeadlines, existingHabits] = await Promise.all([
    deadlines.listAll(),
    habits.listAll(),
  ]);
  if (existingDeadlines.length || existingHabits.length) return false;

  const dueAt = (days: number) => setHours(addDays(new Date(), days), 17).toISOString();
  await deadlines.save({
    title: 'Tax return',
    dueAt: dueAt(3),
    urgencyProfileId: 'normal',
    reminderOffsets: [3, 1, 0],
  });
  await deadlines.save({
    title: 'Passport renewal',
    dueAt: dueAt(45),
    urgencyProfileId: 'normal',
    reminderOffsets: [7, 1],
  });
  await deadlines.save({
    title: 'Car inspection',
    dueAt: dueAt(-2),
    urgencyProfileId: 'normal',
    reminderOffsets: [],
  });

  const pushUps = await habits.save({
    title: 'Push-ups',
    recurrence: { type: 'daily' },
    targetType: 'count',
    targetValue: 30,
    unit: 'reps',
    reminderTime: '19:00',
    active: true,
  });
  await habits.setProgress(pushUps, toLocalDateKey(new Date()), 12);

  const reading = await habits.save({
    title: 'Reading',
    recurrence: { type: 'daily' },
    targetType: 'boolean',
    targetValue: 1,
    reminderTime: '20:00',
    active: true,
  });
  await habits.setProgress(reading, toLocalDateKey(new Date()), 1);
  return true;
}
