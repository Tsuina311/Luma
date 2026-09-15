import { addDays, set } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { toLocalDateKey } from '@/src/utils/dates';

export async function seedDevelopmentData(db: SQLiteDatabase): Promise<boolean> {
  if (!__DEV__) return false;
  await resetDevelopmentData(db);
  return true;
}

export async function resetDevelopmentData(db: SQLiteDatabase): Promise<void> {
  if (!__DEV__) return;

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM scheduled_notifications;
      DELETE FROM deadlines;
      DELETE FROM habits;
    `);
  });

  const deadlines = new DeadlineRepository(db);
  const habits = new HabitRepository(db);

  const dueAt = (days: number, hour = 17) => set(addDays(new Date(), days), {
    hours: hour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  }).toISOString();

  await deadlines.save({
    title: 'Submit rent documents',
    notes: 'Upload the signed form and the latest proof of income.',
    dueAt: dueAt(-1, 9),
    urgencyProfileId: 'normal',
    urgentBeforeMinutes: 1440,
    reminderOffsets: [],
  });
  await deadlines.save({
    title: 'Book dentist appointment',
    notes: 'Call the clinic near work and ask for an early appointment.',
    dueAt: dueAt(3, 12),
    urgencyProfileId: 'normal',
    urgentBeforeMinutes: 1440,
    reminderOffsets: [3, 1, 0],
  });
  await deadlines.save({
    title: 'Pick up prescription',
    notes: 'The pharmacy closes at 19:00.',
    dueAt: dueAt(0, 18),
    urgencyProfileId: 'normal',
    urgentBeforeMinutes: 1440,
    reminderOffsets: [0],
  });
  await deadlines.save({
    title: 'Renew library card',
    notes: 'Bring photo ID and proof of address.',
    dueAt: dueAt(10),
    urgencyProfileId: 'normal',
    urgentBeforeMinutes: 4320,
    reminderOffsets: [7, 3, 1],
  });
  await deadlines.save({
    title: 'Plan birthday dinner',
    notes: 'Choose a place and check everyone’s availability.',
    dueAt: dueAt(24, 19),
    urgencyProfileId: 'normal',
    urgentBeforeMinutes: 10_080,
    reminderOffsets: [7, 3],
  });
  await deadlines.save({
    title: 'Renew passport',
    notes: 'Take a new photo before starting the application.',
    dueAt: dueAt(52),
    urgencyProfileId: 'normal',
    urgentBeforeMinutes: 10_080,
    reminderOffsets: [7, 1],
  });
  const completedDeadline = await deadlines.save({
    title: 'Send project update',
    notes: 'Share the short summary with the team.',
    dueAt: dueAt(0, 10),
    urgencyProfileId: 'normal',
    urgentBeforeMinutes: 1440,
    reminderOffsets: [],
  });
  await deadlines.setCompleted(completedDeadline.id, true);

  const stretch = await habits.save({
    title: 'Morning stretch',
    notes: 'Five quiet minutes before opening messages.',
    recurrence: { type: 'daily' },
    targetType: 'boolean',
    targetValue: 1,
    reminderTime: '08:00',
    active: true,
  });

  const reading = await habits.save({
    title: 'Read',
    notes: 'Continue the book on the bedside table.',
    recurrence: { type: 'daily' },
    targetType: 'count',
    targetValue: 20,
    unit: 'pages',
    reminderTime: '20:30',
    active: true,
  });

  const walk = await habits.save({
    title: 'Walk',
    notes: 'A short walk still counts on busy days.',
    recurrence: { type: 'daily' },
    targetType: 'count',
    targetValue: 6000,
    unit: 'steps',
    active: true,
  });

  const plants = await habits.save({
    title: 'Water plants',
    notes: 'Check the soil first; only water the pots that need it.',
    recurrence: { type: 'daily' },
    targetType: 'boolean',
    targetValue: 1,
    reminderTime: '18:30',
    active: true,
  });

  const today = toLocalDateKey(new Date());
  await habits.setProgress(reading, today, 8);
  await habits.setProgress(walk, today, 3400);
  await habits.setProgress(plants, today, 1);

  for (const daysAgo of [1, 2, 3, 4]) {
    const date = toLocalDateKey(addDays(new Date(), -daysAgo));
    await habits.setProgress(stretch, date, daysAgo === 3 ? 0 : 1);
    await habits.setProgress(reading, date, daysAgo === 2 ? 12 : 20);
    await habits.setProgress(walk, date, daysAgo === 4 ? 4200 : 6000);
    await habits.setProgress(plants, date, daysAgo % 2 === 0 ? 1 : 0);
  }
}
