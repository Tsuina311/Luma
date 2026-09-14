import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
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

export function isHabitScheduledOnDate(habit: Habit, date: Date): boolean {
  if (!habit.active) return false;
  if (habit.recurrence.type === 'daily' || habit.recurrence.type === 'weekly') return true;
  return habit.recurrence.days.includes(date.getDay());
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
    const completedDays = new Set(
      logs
        .filter((log) => log.completed)
        .filter((log) => {
          const logged = parseLocalDate(log.date);
          return !isBefore(logged, weekStart) && !isAfter(logged, weekEnd);
        })
        .map((log) => log.date),
    ).size;
    const frequency = habit.recurrence.frequency;
    const complete = completedDays >= frequency;
    const daysLeft = differenceInCalendarDays(weekEnd, date);
    return {
      isScheduled: !complete,
      completed: complete,
      current: completedDays,
      target: frequency,
      subtitle: `${completedDays} / ${frequency} this week`,
      urgency: complete ? 'green' : daysLeft <= 1 ? 'orange' : 'yellow',
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
