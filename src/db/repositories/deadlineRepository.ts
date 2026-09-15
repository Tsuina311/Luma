import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  deadlineNotificationRuleSchema,
  deadlineInputSchema,
  deadlineSchema,
  urgencyProfileSchema,
  urgencyProfileInputSchema,
  type Deadline,
  type DeadlineInput,
  type DeadlineNotificationRule,
  type UrgencyProfile,
  type UrgencyProfileInput,
} from '@/src/domain/deadlines/schemas';

type DeadlineRow = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string;
  urgency_profile_id: string;
  urgent_before_minutes: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
  archive_reason: 'deleted' | null;
};

type ProfileRow = {
  id: string;
  name: string;
  yellow_days: number;
  orange_days: number;
  red_days: number;
  is_default: number;
  created_at: string;
  updated_at: string;
};

type RuleRow = {
  id: string;
  deadline_id: string;
  offset_days: number;
  enabled: number;
  created_at: string;
};

export class DeadlineRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listAll(): Promise<Deadline[]> {
    const rows = await this.db.getAllAsync<DeadlineRow>(
      'SELECT * FROM deadlines WHERE archived_at IS NULL ORDER BY completed_at IS NOT NULL, due_at ASC',
    );
    return rows.map(mapDeadline);
  }

  async listActive(): Promise<Deadline[]> {
    const rows = await this.db.getAllAsync<DeadlineRow>(
      'SELECT * FROM deadlines WHERE completed_at IS NULL AND archived_at IS NULL ORDER BY due_at ASC',
    );
    return rows.map(mapDeadline);
  }

  async listCompleted(limit = 5): Promise<Deadline[]> {
    const rows = await this.db.getAllAsync<DeadlineRow>(
      `SELECT * FROM deadlines
       WHERE completed_at IS NOT NULL AND archived_at IS NULL
       ORDER BY completed_at DESC LIMIT ?`,
      limit,
    );
    return rows.map(mapDeadline);
  }

  async getById(id: string): Promise<Deadline | null> {
    const row = await this.db.getFirstAsync<DeadlineRow>('SELECT * FROM deadlines WHERE id = ?', id);
    return row ? mapDeadline(row) : null;
  }

  async listBin(): Promise<Deadline[]> {
    const rows = await this.db.getAllAsync<DeadlineRow>(
      `SELECT * FROM deadlines
       WHERE completed_at IS NOT NULL OR archived_at IS NOT NULL
       ORDER BY COALESCE(archived_at, completed_at) DESC`,
    );
    return rows.map(mapDeadline);
  }

  async listProfiles(): Promise<UrgencyProfile[]> {
    const rows = await this.db.getAllAsync<ProfileRow>(
      'SELECT * FROM urgency_profiles ORDER BY is_default DESC, name ASC',
    );
    return rows.map(mapProfile);
  }

  async saveProfile(input: UrgencyProfileInput, id?: string): Promise<UrgencyProfile> {
    const parsed = urgencyProfileInputSchema.parse(input);
    const profileId = id ?? Crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      if (parsed.isDefault) {
        await this.db.runAsync('UPDATE urgency_profiles SET is_default = 0, updated_at = ?', now);
      }
      if (id) {
        await this.db.runAsync(
          `UPDATE urgency_profiles SET name = ?, yellow_days = ?, orange_days = ?, red_days = ?,
           is_default = ?, updated_at = ? WHERE id = ?`,
          parsed.name,
          parsed.yellowDays,
          parsed.orangeDays,
          parsed.redDays,
          parsed.isDefault ? 1 : 0,
          now,
          id,
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO urgency_profiles
            (id, name, yellow_days, orange_days, red_days, is_default, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          profileId,
          parsed.name,
          parsed.yellowDays,
          parsed.orangeDays,
          parsed.redDays,
          parsed.isDefault ? 1 : 0,
          now,
          now,
        );
      }
      const defaults = await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM urgency_profiles WHERE is_default = 1',
      );
      if (!defaults?.count) throw new Error('At least one urgency profile must remain the default.');
    });
    const row = await this.db.getFirstAsync<ProfileRow>('SELECT * FROM urgency_profiles WHERE id = ?', profileId);
    if (!row) throw new Error('Urgency profile could not be saved.');
    return mapProfile(row);
  }

  async listRules(deadlineId?: string): Promise<DeadlineNotificationRule[]> {
    const rows = deadlineId
      ? await this.db.getAllAsync<RuleRow>(
          'SELECT * FROM deadline_notification_rules WHERE deadline_id = ? AND enabled = 1',
          deadlineId,
        )
      : await this.db.getAllAsync<RuleRow>(
          'SELECT * FROM deadline_notification_rules WHERE enabled = 1',
        );
    return rows.map(mapRule);
  }

  async save(input: DeadlineInput, id?: string): Promise<Deadline> {
    const parsed = deadlineInputSchema.parse(input);
    const now = new Date().toISOString();
    const deadlineId = id ?? Crypto.randomUUID();
    await this.db.withTransactionAsync(async () => {
      if (id) {
        await this.db.runAsync(
          `UPDATE deadlines
           SET title = ?, notes = ?, due_at = ?, urgency_profile_id = ?,
               urgent_before_minutes = ?, updated_at = ?
           WHERE id = ?`,
          parsed.title,
          parsed.notes ?? null,
          parsed.dueAt,
          parsed.urgencyProfileId,
          parsed.urgentBeforeMinutes,
          now,
          id,
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO deadlines
            (id, title, notes, due_at, urgency_profile_id, urgent_before_minutes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          deadlineId,
          parsed.title,
          parsed.notes ?? null,
          parsed.dueAt,
          parsed.urgencyProfileId,
          parsed.urgentBeforeMinutes,
          now,
          now,
        );
      }
      await this.db.runAsync('DELETE FROM deadline_notification_rules WHERE deadline_id = ?', deadlineId);
      for (const offset of parsed.reminderOffsets) {
        await this.db.runAsync(
          `INSERT INTO deadline_notification_rules
            (id, deadline_id, offset_days, enabled, created_at) VALUES (?, ?, ?, 1, ?)`,
          Crypto.randomUUID(),
          deadlineId,
          offset,
          now,
        );
      }
    });
    const saved = await this.getById(deadlineId);
    if (!saved) throw new Error('Deadline could not be saved.');
    return saved;
  }

  async setCompleted(id: string, completed: boolean): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      'UPDATE deadlines SET completed_at = ?, updated_at = ? WHERE id = ?',
      completed ? now : null,
      now,
      id,
    );
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE deadlines
       SET archived_at = ?, archive_reason = 'deleted', updated_at = ?
       WHERE id = ?`,
      now,
      now,
      id,
    );
  }

  async restore(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE deadlines
       SET completed_at = NULL, archived_at = NULL, archive_reason = NULL, updated_at = ?
       WHERE id = ?`,
      new Date().toISOString(),
      id,
    );
  }
}

function mapDeadline(row: DeadlineRow): Deadline {
  return deadlineSchema.parse({
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    dueAt: row.due_at,
    urgencyProfileId: row.urgency_profile_id,
    urgentBeforeMinutes: row.urgent_before_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    archiveReason: row.archive_reason ?? undefined,
  });
}

function mapProfile(row: ProfileRow): UrgencyProfile {
  return urgencyProfileSchema.parse({
    id: row.id,
    name: row.name,
    yellowDays: row.yellow_days,
    orangeDays: row.orange_days,
    redDays: row.red_days,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapRule(row: RuleRow): DeadlineNotificationRule {
  return deadlineNotificationRuleSchema.parse({
    id: row.id,
    deadlineId: row.deadline_id,
    offsetDays: row.offset_days,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  });
}
