import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export type ScheduledNotificationRecord = {
  id: string;
  sourceType: 'deadline' | 'habit';
  sourceId: string;
  nativeNotificationId: string;
  fireAt: string;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  source_type: 'deadline' | 'habit';
  source_id: string;
  native_notification_id: string;
  fire_at: string;
  created_at: string;
};

export class NotificationRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<ScheduledNotificationRecord[]> {
    const rows = await this.db.getAllAsync<NotificationRow>(
      'SELECT * FROM scheduled_notifications ORDER BY fire_at ASC',
    );
    return rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      nativeNotificationId: row.native_notification_id,
      fireAt: row.fire_at,
      createdAt: row.created_at,
    }));
  }

  async replace(records: Omit<ScheduledNotificationRecord, 'id' | 'createdAt'>[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM scheduled_notifications');
      const now = new Date().toISOString();
      for (const record of records) {
        await this.db.runAsync(
          `INSERT INTO scheduled_notifications
            (id, source_type, source_id, native_notification_id, fire_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          Crypto.randomUUID(),
          record.sourceType,
          record.sourceId,
          record.nativeNotificationId,
          record.fireAt,
          now,
        );
      }
    });
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM scheduled_notifications');
  }
}
