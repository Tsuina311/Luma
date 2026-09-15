import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

const migrations: Record<number, string> = {
  1: `
    CREATE TABLE urgency_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      yellow_days INTEGER NOT NULL,
      orange_days INTEGER NOT NULL,
      red_days INTEGER NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE deadlines (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      due_at TEXT NOT NULL,
      urgency_profile_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (urgency_profile_id) REFERENCES urgency_profiles(id)
    );

    CREATE TABLE deadline_notification_rules (
      id TEXT PRIMARY KEY NOT NULL,
      deadline_id TEXT NOT NULL,
      offset_days INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE (deadline_id, offset_days),
      FOREIGN KEY (deadline_id) REFERENCES deadlines(id) ON DELETE CASCADE
    );

    CREATE TABLE habits (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      recurrence_type TEXT NOT NULL,
      recurrence_config TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_value REAL NOT NULL,
      unit TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE habit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (habit_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE habit_notification_rules (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL UNIQUE,
      reminder_time TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE scheduled_notifications (
      id TEXT PRIMARY KEY NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      native_notification_id TEXT NOT NULL UNIQUE,
      fire_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX deadlines_due_at_idx ON deadlines(due_at);
    CREATE INDEX deadlines_completed_at_idx ON deadlines(completed_at);
    CREATE INDEX habit_logs_habit_date_idx ON habit_logs(habit_id, date);
    CREATE INDEX scheduled_notifications_fire_at_idx ON scheduled_notifications(fire_at);
  `,
  2: `
    ALTER TABLE deadlines ADD COLUMN urgent_before_minutes INTEGER NOT NULL DEFAULT 1440;
    ALTER TABLE deadlines ADD COLUMN archived_at TEXT;
    ALTER TABLE deadlines ADD COLUMN archive_reason TEXT;
    ALTER TABLE habits ADD COLUMN archived_at TEXT;
    ALTER TABLE habits ADD COLUMN archive_reason TEXT;

    CREATE INDEX deadlines_archived_at_idx ON deadlines(archived_at);
    CREATE INDEX habits_archived_at_idx ON habits(archived_at);
  `,
  3: `
    SELECT 1;
  `,
  4: `
    SELECT 1;
  `,
};

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;
  const latestVersion = Math.max(...Object.keys(migrations).map(Number));

  if (currentVersion > latestVersion) {
    throw new Error(`Database version ${currentVersion} is newer than this app supports.`);
  }

  while (currentVersion < latestVersion) {
    const nextVersion = currentVersion + 1;
    await runInTransaction(db, async (executor) => {
      await executor.execAsync(migrations[nextVersion]);
      if (nextVersion === 3) {
        const columns = await executor.getAllAsync<{ name: string }>('PRAGMA table_info(habit_logs)');
        if (!columns.some((column) => column.name === 'previous_amount')) {
          await executor.execAsync('ALTER TABLE habit_logs ADD COLUMN previous_amount REAL');
        }
      }
      if (nextVersion === 1) await seedFoundation(executor);
      await executor.execAsync(`PRAGMA user_version = ${nextVersion}`);
    });
    currentVersion = nextVersion;
  }
}

// An exclusive transaction runs on its own connection, so every statement must
// use the transaction it hands back rather than the original database. Web has
// no exclusive transactions, and a single tab has no competing writer anyway.
async function runInTransaction(
  db: SQLiteDatabase,
  task: (executor: SQLiteDatabase) => Promise<void>,
): Promise<void> {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => {
      await task(db);
    });
    return;
  }
  await db.withExclusiveTransactionAsync((transaction) => task(transaction));
}

async function seedFoundation(db: SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO urgency_profiles
      (id, name, yellow_days, orange_days, red_days, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'normal',
    'Normal',
    30,
    14,
    5,
    1,
    now,
    now,
  );
  await db.runAsync(
    'INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
    'preferences',
    JSON.stringify({ weekStartsOn: 1, timeFormat: '24h', defaultUrgencyProfileId: 'normal' }),
    now,
  );
}
