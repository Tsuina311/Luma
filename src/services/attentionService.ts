import type { SQLiteDatabase } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import { getAttentionItems } from '@/src/domain/attention/engine';

export async function loadAttentionOverview(db: SQLiteDatabase, now = new Date()) {
  const deadlines = new DeadlineRepository(db);
  const habits = new HabitRepository(db);
  const settings = new SettingsRepository(db);
  const [activeDeadlines, completedDeadlines, profiles, activeHabits, logs, preferences] = await Promise.all([
    deadlines.listActive(),
    deadlines.listCompleted(),
    deadlines.listProfiles(),
    habits.listActive(),
    habits.listLogs(),
    settings.getPreferences(),
  ]);
  return {
    items: getAttentionItems({
      deadlines: activeDeadlines,
      profiles,
      habits: activeHabits,
      habitLogs: logs,
      weekStartsOn: preferences.weekStartsOn,
    }, now),
    completedDeadlines,
  };
}
