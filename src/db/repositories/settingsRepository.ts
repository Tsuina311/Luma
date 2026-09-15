import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

export const preferencesSchema = z.object({
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  timeFormat: z.enum(['12h', '24h']),
  defaultUrgencyProfileId: z.string().min(1),
  // `auto` follows attention urgency; green/yellow/red lock the canvas for development.
  visualMode: z.enum(['auto', 'green', 'yellow', 'red']).default('auto'),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type VisualModePreference = Preferences['visualMode'];

const defaultPreferences: Preferences = {
  weekStartsOn: 1,
  timeFormat: '24h',
  defaultUrgencyProfileId: 'normal',
  visualMode: 'auto',
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
    const existing = await this.db.getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM settings WHERE key = ?',
      'preferences',
    );
    const previous = existing ? (JSON.parse(existing.value_json) as Record<string, unknown>) : {};
    await this.db.runAsync(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      'preferences',
      JSON.stringify({
        ...previous,
        ...parsed,
        visualModeAutoMigrated: true,
      }),
      new Date().toISOString(),
    );
  }
}
