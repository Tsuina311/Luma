import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type { Urgency } from '@/src/domain/shared';
import { getWeekStart, parseLocalDate, toLocalDateKey, type WeekStart } from '@/src/utils/dates';
import type { Habit, HabitLog } from './schemas';

export type HabitStatus = {
  isScheduled: boolean;
  completed: boolean;
  current: number;
  target: number;
  subtitle: string;
  urgency: Urgency;
};

function completedDatesInRange(logs: HabitLog[], start: Date, end: Date): number {
  return new Set(
    logs
      .filter((log) => log.completed)
      .filter((log) => {
        const logged = parseLocalDate(log.date);
        return !isBefore(logged, start) && !isAfter(logged, end);
      })
      .map((log) => log.date),
  ).size;
}

function periodQuotaStatus(args: {
  current: number;
  target: number;
  daysLeftInPeriod: number;
  previousPeriodMissed: boolean;
  periodLabel: string;
}): HabitStatus {
  const { current, target, daysLeftInPeriod, previousPeriodMissed, periodLabel } = args;
  const complete = current >= target;
  let urgency: Urgency = 'yellow';
  if (complete) urgency = 'green';
  else if (previousPeriodMissed) urgency = 'red';
  else if (daysLeftInPeriod <= 1) urgency = 'orange';

  return {
    isScheduled: !complete,
    completed: complete,
    current,
    target,
    subtitle: previousPeriodMissed && !complete
      ? `${current} / ${target} ${periodLabel} · overdue`
      : `${current} / ${target} ${periodLabel}`,
    urgency,
  };
}

export function isHabitScheduledOnDate(habit: Habit, date: Date): boolean {
  if (!habit.active) return false;
  if (habit.recurrence.type === 'daily' || habit.recurrence.type === 'weekly' || habit.recurrence.type === 'monthly') {
    return true;
  }
  if (habit.recurrence.type === 'weekdays') {
    return habit.recurrence.days.includes(date.getDay());
  }
  const start = startOfDay(new Date(habit.createdAt));
  const day = startOfDay(date);
  if (isBefore(day, start)) return false;
  const diff = differenceInCalendarDays(day, start);
  return diff % habit.recurrence.everyDays === 0;
}

export function getHabitStatusForDate(
  habit: Habit,
  logs: HabitLog[],
  date = new Date(),
  weekStartsOn: WeekStart = 1,
): HabitStatus {
  const target = habit.targetType === 'boolean' ? 1 : habit.targetValue;
  const dateKey = toLocalDateKey(date);
  const todayLog = logs.find((log) => log.date === dateKey);

  if (habit.recurrence.type === 'weekly') {
    const weekStart = getWeekStart(date, weekStartsOn);
    const weekEnd = endOfWeek(date, { weekStartsOn });
    const previousWeekStart = addDays(weekStart, -7);
    const previousWeekEnd = addDays(weekStart, -1);
    const frequency = habit.recurrence.frequency;
    const created = startOfDay(new Date(habit.createdAt));
    const previousPeriodMissed =
      !isAfter(created, previousWeekEnd) &&
      completedDatesInRange(logs, previousWeekStart, previousWeekEnd) < frequency;

    return periodQuotaStatus({
      current: completedDatesInRange(logs, weekStart, weekEnd),
      target: frequency,
      daysLeftInPeriod: differenceInCalendarDays(weekEnd, date),
      previousPeriodMissed,
      periodLabel: 'this week',
    });
  }

  if (habit.recurrence.type === 'monthly') {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const previousMonthStart = startOfMonth(addMonths(date, -1));
    const previousMonthEnd = endOfMonth(addMonths(date, -1));
    const frequency = habit.recurrence.frequency;
    const created = startOfDay(new Date(habit.createdAt));
    const previousPeriodMissed =
      !isAfter(created, previousMonthEnd) &&
      completedDatesInRange(logs, previousMonthStart, previousMonthEnd) < frequency;

    return periodQuotaStatus({
      current: completedDatesInRange(logs, monthStart, monthEnd),
      target: frequency,
      daysLeftInPeriod: differenceInCalendarDays(monthEnd, date),
      previousPeriodMissed,
      periodLabel: 'this month',
    });
  }

  if (habit.recurrence.type === 'interval') {
    const scheduled = isHabitScheduledOnDate(habit, date);
    const amount = todayLog?.amount ?? 0;
    const complete = Boolean(todayLog?.completed || amount >= target);
    if (scheduled) {
      return {
        isScheduled: !complete,
        completed: complete,
        current: amount,
        target,
        subtitle: complete ? 'Done today' : `Due every ${habit.recurrence.everyDays} days`,
        urgency: complete ? 'green' : 'orange',
      };
    }

    // Missed the previous interval day → overdue until the next interval day is completed.
    const start = startOfDay(new Date(habit.createdAt));
    const day = startOfDay(date);
    const diff = differenceInCalendarDays(day, start);
    const every = habit.recurrence.everyDays;
    const lastScheduledOffset = Math.floor((diff - 1) / every) * every;
    if (lastScheduledOffset < 0) {
      return {
        isScheduled: false,
        completed: false,
        current: 0,
        target,
        subtitle: `Every ${every} days`,
        urgency: 'green',
      };
    }
    const lastScheduled = addDays(start, lastScheduledOffset);
    const lastKey = toLocalDateKey(lastScheduled);
    const lastDone = logs.some((log) => log.date === lastKey && log.completed);
    if (!lastDone) {
      return {
        isScheduled: true,
        completed: false,
        current: 0,
        target,
        subtitle: `Missed ${lastKey} · every ${every} days`,
        urgency: 'red',
      };
    }
    return {
      isScheduled: false,
      completed: true,
      current: target,
      target,
      subtitle: `Every ${every} days`,
      urgency: 'green',
    };
  }

  const scheduled = isHabitScheduledOnDate(habit, date);
  const amount = todayLog?.amount ?? 0;
  const complete = Boolean(todayLog?.completed || amount >= target);
  const amountCopy = habit.targetType === 'count'
    ? `Today · ${amount} / ${target}${habit.unit ? ` ${habit.unit}` : ''}`
    : complete ? 'Done today' : 'Due today';

  return {
    isScheduled: scheduled,
    completed: complete,
    current: amount,
    target,
    subtitle: amountCopy,
    urgency: complete ? 'green' : 'orange',
  };
}

export type HabitMetrics = {
  expected: number;
  completed: number;
  reliability: number;
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  xp: number;
};

export function calculateHabitReliability(
  habit: Habit,
  logs: HabitLog[],
  now = new Date(),
  weekStartsOn: WeekStart = 1,
): HabitMetrics {
  const completedLogs = logs.filter((log) => log.completed).sort((a, b) => a.date.localeCompare(b.date));
  const weekStart = getWeekStart(now, weekStartsOn);
  const weekDays = eachDayOfInterval({ start: weekStart, end: now });
  const completedDates = new Set(completedLogs.map((log) => log.date));

  let expected: number;
  let completed: number;
  if (habit.recurrence.type === 'weekly') {
    expected = habit.recurrence.frequency;
    completed = Math.min(expected, weekDays.filter((day) => completedDates.has(toLocalDateKey(day))).length);
  } else if (habit.recurrence.type === 'monthly') {
    const monthStart = startOfMonth(now);
    const monthDays = eachDayOfInterval({ start: monthStart, end: now });
    expected = habit.recurrence.frequency;
    completed = Math.min(expected, monthDays.filter((day) => completedDates.has(toLocalDateKey(day))).length);
  } else {
    const scheduled = weekDays.filter((day) => isHabitScheduledOnDate(habit, day));
    expected = scheduled.length;
    completed = scheduled.filter((day) => completedDates.has(toLocalDateKey(day))).length;
  }

  let currentStreak = 0;
  let bestStreak = 0;
  if (habit.recurrence.type === 'weekly') {
    const streaks = calculateWeeklyStreaks(
      habit,
      habit.recurrence.frequency,
      completedLogs,
      now,
      weekStartsOn,
    );
    currentStreak = streaks.current;
    bestStreak = streaks.best;
  } else {
    const scheduledHistory = buildScheduledHistory(habit, completedLogs, now);
    let running = 0;
    for (const day of scheduledHistory) {
      if (completedDates.has(toLocalDateKey(day))) {
        running += 1;
        bestStreak = Math.max(bestStreak, running);
      } else if (!isSameDay(day, now)) {
        running = 0;
      }
    }
    currentStreak = running;
  }

  return {
    expected,
    completed,
    reliability: expected === 0 ? 100 : Math.round((completed / expected) * 100),
    currentStreak,
    bestStreak,
    totalCompletions: completedLogs.length,
    xp: completedLogs.length * 10,
  };
}

function buildScheduledHistory(habit: Habit, logs: HabitLog[], now: Date): Date[] {
  const firstLogDate = logs[0] ? parseLocalDate(logs[0].date) : addDays(now, -30);
  const created = startOfDay(new Date(habit.createdAt));
  const start = isAfter(created, firstLogDate) ? created : firstLogDate;
  return eachDayOfInterval({ start, end: now }).filter((day) => isHabitScheduledOnDate(habit, day));
}

function calculateWeeklyStreaks(
  habit: Habit,
  frequency: number,
  logs: HabitLog[],
  now: Date,
  weekStartsOn: WeekStart,
): { current: number; best: number } {
  const completedDates = new Set(logs.filter((log) => log.completed).map((log) => log.date));
  const weeks = eachWeekOfInterval(
    { start: new Date(habit.createdAt), end: now },
    { weekStartsOn },
  );
  let running = 0;
  let best = 0;
  for (const week of weeks) {
    const end = endOfWeek(week, { weekStartsOn });
    const completionCount = eachDayOfInterval({ start: week, end })
      .filter((day) => completedDates.has(toLocalDateKey(day))).length;
    if (completionCount >= frequency) {
      running += 1;
      best = Math.max(best, running);
    } else if (!isSameDay(week, getWeekStart(now, weekStartsOn))) {
      running = 0;
    }
  }
  return { current: running, best };
}
