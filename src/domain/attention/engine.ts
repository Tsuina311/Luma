import type { AttentionItem } from '@/src/domain/shared';
import { urgencyWeight } from '@/src/domain/shared';
import { calculateDeadlineUrgency, getTimeRemaining } from '@/src/domain/deadlines/logic';
import type { Deadline, UrgencyProfile } from '@/src/domain/deadlines/schemas';
import { getHabitStatusForDate } from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import { combineLocalDateAndTime, toLocalDateKey, type WeekStart } from '@/src/utils/dates';

export type AttentionInput = {
  deadlines: Deadline[];
  profiles: UrgencyProfile[];
  habits: Habit[];
  habitLogs: HabitLog[];
  weekStartsOn?: WeekStart;
};

const urgencyIcon = {
  red: '!!',
  orange: '!',
  yellow: '◷',
  green: '○',
} as const;

export function getAttentionItems(input: AttentionInput, now = new Date()): AttentionItem[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const fallbackProfile = input.profiles.find((profile) => profile.isDefault) ?? input.profiles[0];

  const deadlineItems = input.deadlines
    .filter((deadline) => !deadline.completedAt)
    .flatMap((deadline): AttentionItem[] => {
      const profile = profileById.get(deadline.urgencyProfileId) ?? fallbackProfile;
      if (!profile) return [];
      const urgency = calculateDeadlineUrgency(deadline, profile, now);
      return [{
        id: `deadline:${deadline.id}`,
        sourceId: deadline.id,
        sourceType: 'deadline',
        title: deadline.title,
        urgency,
        subtitle: getTimeRemaining(deadline.dueAt, now),
        nextActionAt: deadline.dueAt,
        icon: urgencyIcon[urgency],
      }];
    });

  const habitItems = input.habits
    .filter((habit) => habit.active)
    .flatMap((habit): AttentionItem[] => {
      const logs = input.habitLogs.filter((log) => log.habitId === habit.id);
      const status = getHabitStatusForDate(habit, logs, now, input.weekStartsOn);
      if (!status.isScheduled || status.completed) return [];
      return [{
        id: `habit:${habit.id}`,
        sourceId: habit.id,
        sourceType: 'habit',
        title: habit.title,
        urgency: status.urgency,
        subtitle: status.subtitle,
        nextActionAt: habit.reminderTime
          ? combineLocalDateAndTime(toLocalDateKey(now), habit.reminderTime).toISOString()
          : undefined,
        icon: urgencyIcon[status.urgency],
        progress: habit.targetType === 'count'
          ? { current: status.current, target: status.target, unit: habit.unit }
          : undefined,
      }];
    });

  return [...deadlineItems, ...habitItems].sort(compareAttentionItems);
}

export function compareAttentionItems(a: AttentionItem, b: AttentionItem): number {
  const urgencyDifference = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
  if (urgencyDifference !== 0) return urgencyDifference;
  if (a.nextActionAt && b.nextActionAt) {
    const timeDifference = new Date(a.nextActionAt).getTime() - new Date(b.nextActionAt).getTime();
    if (timeDifference !== 0) return timeDifference;
  } else if (a.nextActionAt) {
    return -1;
  } else if (b.nextActionAt) {
    return 1;
  }
  return a.title.localeCompare(b.title);
}
