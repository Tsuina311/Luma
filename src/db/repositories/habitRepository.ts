import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  habitInputSchema,
  habitLogSchema,
  habitSchema,
  recurrenceSchema,
  type Habit,
  type HabitInput,
  type HabitLog,
} from '@/src/domain/habits/schemas';
import { localDateSchema } from '@/src/domain/shared';

type HabitRow = {
  id: string;
  title: string;
  notes: string | null;
  recurrence_type: string;
  recurrence_config: string;
  target_type: 'boolean' | 'count';
  target_value: number;
  unit: string | null;
  active: number;
  created_at: string;
  updated_at: string;
  reminder_time: string | null;
  archived_at: string | null;
  archive_reason: 'deleted' | null;
};

type LogRow = {
  id: string;
  habit_id: string;
  date: string;
  amount: number;
  previous_amount: number | null;
  completed: number;
  created_at: string;
  updated_at: string;
};

export class HabitRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listActive(): Promise<Habit[]> {
    const rows = await this.db.getAllAsync<HabitRow>(
      habitSelect('WHERE h.active = 1 AND h.archived_at IS NULL ORDER BY h.created_at ASC'),
    );
    return rows.map(mapHabit);
  }

  async listAll(): Promise<Habit[]> {
    const rows = await this.db.getAllAsync<HabitRow>(
      habitSelect('WHERE h.archived_at IS NULL ORDER BY h.active DESC, h.created_at ASC'),
    );
    return rows.map(mapHabit);
  }

  async listArchived(): Promise<Habit[]> {
    const rows = await this.db.getAllAsync<HabitRow>(
      habitSelect('WHERE h.archived_at IS NOT NULL ORDER BY h.archived_at DESC'),
    );
    return rows.map(mapHabit);
  }

  async getById(id: string): Promise<Habit | null> {
    const row = await this.db.getFirstAsync<HabitRow>(habitSelect('WHERE h.id = ?'), id);
    return row ? mapHabit(row) : null;
  }

  async listLogs(habitId?: string): Promise<HabitLog[]> {
    const rows = habitId
      ? await this.db.getAllAsync<LogRow>(
          'SELECT * FROM habit_logs WHERE habit_id = ? ORDER BY date ASC',
          habitId,
        )
      : await this.db.getAllAsync<LogRow>('SELECT * FROM habit_logs ORDER BY date ASC');
    return rows.map(mapLog);
  }

  async save(input: HabitInput, id?: string): Promise<Habit> {
    const parsed = habitInputSchema.parse(input);
    const now = new Date().toISOString();
    const habitId = id ?? Crypto.randomUUID();
    const recurrenceConfig = JSON.stringify(parsed.recurrence);

    await this.db.withTransactionAsync(async () => {
      if (id) {
        await this.db.runAsync(
          `UPDATE habits SET title = ?, notes = ?, recurrence_type = ?, recurrence_config = ?,
           target_type = ?, target_value = ?, unit = ?, active = ?, updated_at = ? WHERE id = ?`,
          parsed.title,
          parsed.notes ?? null,
          parsed.recurrence.type,
          recurrenceConfig,
          parsed.targetType,
          parsed.targetValue,
          parsed.unit ?? null,
          parsed.active ? 1 : 0,
          now,
          id,
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO habits
            (id, title, notes, recurrence_type, recurrence_config, target_type, target_value, unit,
             active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          habitId,
          parsed.title,
          parsed.notes ?? null,
          parsed.recurrence.type,
          recurrenceConfig,
          parsed.targetType,
          parsed.targetValue,
          parsed.unit ?? null,
          parsed.active ? 1 : 0,
          now,
          now,
        );
      }
      await this.db.runAsync('DELETE FROM habit_notification_rules WHERE habit_id = ?', habitId);
      if (parsed.reminderTime) {
        await this.db.runAsync(
          `INSERT INTO habit_notification_rules
            (id, habit_id, reminder_time, enabled, created_at) VALUES (?, ?, ?, 1, ?)`,
          Crypto.randomUUID(),
          habitId,
          parsed.reminderTime,
          now,
        );
      }
    });

    const saved = await this.getById(habitId);
    if (!saved) throw new Error('Habit could not be saved.');
    return saved;
  }

  async setProgress(habit: Habit, date: string, amount: number): Promise<HabitLog> {
    localDateSchema.parse(date);
    habitSchema.parse(habit);
    const safeAmount = Math.max(0, amount);
    const completed = safeAmount >= habit.targetValue;
    const now = new Date().toISOString();
    const existing = await this.db.getFirstAsync<LogRow>(
      'SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?',
      habit.id,
      date,
    );

    if (existing) {
      await this.db.runAsync(
        `UPDATE habit_logs
         SET previous_amount = CASE
               WHEN completed = 0 AND ? = 1 THEN amount
               WHEN ? = 0 THEN NULL
               ELSE previous_amount
             END,
             amount = ?, completed = ?, updated_at = ?
         WHERE id = ?`,
        completed ? 1 : 0,
        completed ? 1 : 0,
        safeAmount,
        completed ? 1 : 0,
        now,
        existing.id,
      );
    } else {
      await this.db.runAsync(
        `INSERT INTO habit_logs
          (id, habit_id, date, amount, previous_amount, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        habit.id,
        date,
        safeAmount,
        completed ? 0 : null,
        completed ? 1 : 0,
        now,
        now,
      );
    }
    const saved = await this.db.getFirstAsync<LogRow>(
      'SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?',
      habit.id,
      date,
    );
    if (!saved) throw new Error('Habit progress could not be saved.');
    return mapLog(saved);
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.db.runAsync(
      'UPDATE habits SET active = ?, updated_at = ? WHERE id = ?',
      active ? 1 : 0,
      new Date().toISOString(),
      id,
    );
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE habits
       SET archived_at = ?, archive_reason = 'deleted', active = 0, updated_at = ?
       WHERE id = ?`,
      now,
      now,
      id,
    );
  }

  async restore(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE habits
       SET archived_at = NULL, archive_reason = NULL, active = 1, updated_at = ?
       WHERE id = ?`,
      new Date().toISOString(),
      id,
    );
  }
}

function habitSelect(suffix: string): string {
  return `SELECT h.*, r.reminder_time
    FROM habits h
    LEFT JOIN habit_notification_rules r ON r.habit_id = h.id AND r.enabled = 1
    ${suffix}`;
}

function mapHabit(row: HabitRow): Habit {
  const recurrence = recurrenceSchema.parse(JSON.parse(row.recurrence_config));
  if (recurrence.type !== row.recurrence_type) throw new Error('Habit recurrence data is inconsistent.');
  return habitSchema.parse({
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    recurrence,
    targetType: row.target_type,
    targetValue: row.target_value,
    unit: row.unit ?? undefined,
    reminderTime: row.reminder_time ?? undefined,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    archiveReason: row.archive_reason ?? undefined,
  });
}

function mapLog(row: LogRow): HabitLog {
  return habitLogSchema.parse({
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    amount: row.amount,
    previousAmount: row.previous_amount ?? undefined,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
