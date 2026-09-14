import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

export const preferencesSchema = z.object({
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  timeFormat: z.enum(['12h', '24h']),
  defaultUrgencyProfileId: z.string().min(1),
});

export type Preferences = z.infer<typeof preferencesSchema>;

const defaultPreferences: Preferences = {
  weekStartsOn: 1,
  timeFormat: '24h',
  defaultUrgencyProfileId: 'normal',
};

export class SettingsRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async getPreferences(): Promise<Preferences> {
    const row = await this.db.getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM settings WHERE key = ?',
      'preferences',
    );
    return row ? preferencesSchema.parse(JSON.parse(row.value_json)) : defaultPreferences;
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    const parsed = preferencesSchema.parse(preferences);
    await this.db.runAsync(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      'preferences',
      JSON.stringify(parsed),
      new Date().toISOString(),
    );
  }
}
