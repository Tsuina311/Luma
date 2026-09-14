import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMonths,
  differenceInWeeks,
  isSameDay,
} from 'date-fns';
import type { Urgency } from '@/src/domain/shared';
import type { Deadline, UrgencyProfile } from './schemas';

const DAY_MS = 86_400_000;

export function calculateDeadlineUrgency(
  deadline: Deadline,
  profile: UrgencyProfile,
  now = new Date(),
): Urgency {
  if (deadline.completedAt) return 'green';
  const due = new Date(deadline.dueAt);
  if (due.getTime() < now.getTime()) return 'red';

  const remainingDays = (due.getTime() - now.getTime()) / DAY_MS;
  if (remainingDays < profile.redDays) return 'red';
  if (remainingDays <= profile.orangeDays) return 'orange';
  if (remainingDays <= profile.yellowDays) return 'yellow';
  return 'green';
}

export function getTimeRemaining(dueAt: string | Date, now = new Date()): string {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const ms = due.getTime() - now.getTime();

  if (ms < 0) {
    const calendarDays = Math.max(0, -differenceInCalendarDays(due, now));
    if (calendarDays === 0) {
      const hours = Math.max(1, Math.abs(differenceInHours(due, now)));
      return `Overdue by ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `Overdue by ${calendarDays} ${calendarDays === 1 ? 'day' : 'days'}`;
  }

  if (isSameDay(due, now)) return 'Due today';
  const days = differenceInCalendarDays(due, now);
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `${days} days left`;
  if (days < 60) {
    const weeks = Math.max(2, differenceInWeeks(due, now));
    return `${weeks} weeks left`;
  }
  const months = Math.max(2, differenceInMonths(due, now));
  return `${months} months left`;
}
