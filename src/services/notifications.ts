import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DeadlineRepository } from '@/src/db/repositories/deadlineRepository';
import { HabitRepository } from '@/src/db/repositories/habitRepository';
import { NotificationRepository } from '@/src/db/repositories/notificationRepository';
import { SettingsRepository } from '@/src/db/repositories/settingsRepository';
import {
  limitNotificationIntents,
  planDeadlineNotifications,
  planHabitNotifications,
} from '@/src/domain/notifications/planner';

const CHANNEL_ID = 'luma-reminders';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  const response = await Notifications.getPermissionsAsync();
  if (response.status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (response.status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Luma reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    });
  }
  const response = await Notifications.requestPermissionsAsync();
  return response.status === Notifications.PermissionStatus.GRANTED ? 'granted' : 'denied';
}

export async function reconcileNotifications(db: SQLiteDatabase): Promise<number> {
  const notificationRepository = new NotificationRepository(db);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const lumaScheduled = scheduled.filter((request) => request.content.data?.luma === true);
  await Promise.all(
    lumaScheduled.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
  await notificationRepository.clear();

  if (await getNotificationPermissionState() !== 'granted') return 0;

  const deadlineRepository = new DeadlineRepository(db);
  const habitRepository = new HabitRepository(db);
  const settingsRepository = new SettingsRepository(db);
  const [deadlines, rules, habits, logs, preferences] = await Promise.all([
    deadlineRepository.listActive(),
    deadlineRepository.listRules(),
    habitRepository.listActive(),
    habitRepository.listLogs(),
    settingsRepository.getPreferences(),
  ]);

  const intents = limitNotificationIntents([
    ...planDeadlineNotifications(deadlines, rules),
    ...planHabitNotifications(habits, logs, new Date(), 14, preferences.weekStartsOn),
  ]);

  const records = [];
  for (const intent of intents) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: intent.title,
        body: intent.body,
        data: {
          luma: true,
          sourceType: intent.sourceType,
          sourceId: intent.sourceId,
          route: intent.route,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: intent.fireAt,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    records.push({
      sourceType: intent.sourceType,
      sourceId: intent.sourceId,
      nativeNotificationId: identifier,
      fireAt: intent.fireAt.toISOString(),
    });
  }
  await notificationRepository.replace(records);
  return records.length;
}

export function configureForegroundNotifications(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
