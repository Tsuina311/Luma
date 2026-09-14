import { addDays, isAfter, subDays } from 'date-fns';
import type { Deadline, DeadlineNotificationRule } from '@/src/domain/deadlines/schemas';
import { getHabitStatusForDate, isHabitScheduledOnDate } from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import { combineLocalDateAndTime, toLocalDateKey, type WeekStart } from '@/src/utils/dates';

export type NotificationIntent = {
  sourceType: 'deadline' | 'habit';
  sourceId: string;
  title: string;
  body: string;
  fireAt: Date;
  route: `/deadline/${string}` | `/habit/${string}`;
};

export function planDeadlineNotifications(
  deadlines: Deadline[],
  rules: DeadlineNotificationRule[],
  now = new Date(),
): NotificationIntent[] {
  const rulesByDeadline = new Map<string, DeadlineNotificationRule[]>();
  for (const rule of rules) {
    rulesByDeadline.set(rule.deadlineId, [...(rulesByDeadline.get(rule.deadlineId) ?? []), rule]);
  }
  return deadlines.flatMap((deadline) => {
    if (deadline.completedAt) return [];
    return (rulesByDeadline.get(deadline.id) ?? []).flatMap((rule): NotificationIntent[] => {
      const fireAt = subDays(new Date(deadline.dueAt), rule.offsetDays);
      if (!rule.enabled || !isAfter(fireAt, now)) return [];
      return [{
        sourceType: 'deadline',
        sourceId: deadline.id,
        title: deadline.title,
        body: rule.offsetDays === 0 ? 'Due now. Open Luma to review your plan.' : `Due in ${rule.offsetDays} days.`,
        fireAt,
        route: `/deadline/${deadline.id}`,
      }];
    });
  });
}

export function planHabitNotifications(
  habits: Habit[],
  logs: HabitLog[],
  now = new Date(),
  horizonDays = 14,
  weekStartsOn: WeekStart = 1,
): NotificationIntent[] {
  const intents: NotificationIntent[] = [];
  for (const habit of habits) {
    if (!habit.active || !habit.reminderTime) continue;
    const habitLogs = logs.filter((log) => log.habitId === habit.id);
    for (let offset = 0; offset < horizonDays; offset += 1) {
      const day = addDays(now, offset);
      if (!isHabitScheduledOnDate(habit, day)) continue;
      const status = getHabitStatusForDate(habit, habitLogs, day, weekStartsOn);
      if (status.completed) continue;
      const fireAt = combineLocalDateAndTime(toLocalDateKey(day), habit.reminderTime);
      if (!isAfter(fireAt, now)) continue;
      intents.push({
        sourceType: 'habit',
        sourceId: habit.id,
        title: habit.title,
        body: status.subtitle,
        fireAt,
        route: `/habit/${habit.id}`,
      });
    }
  }
  return intents;
}

export function limitNotificationIntents(intents: NotificationIntent[], limit = 60): NotificationIntent[] {
  return [...intents].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, limit);
}
