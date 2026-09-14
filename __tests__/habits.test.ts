import { addDays } from 'date-fns';
import { describe, expect, it } from '@jest/globals';
import {
  calculateHabitReliability,
  getHabitStatusForDate,
  isHabitScheduledOnDate,
} from '@/src/domain/habits/logic';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import { toLocalDateKey } from '@/src/utils/dates';

const monday = new Date(2026, 8, 14, 12);

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    title: 'Push-ups',
    recurrence: { type: 'daily' },
    targetType: 'count',
    targetValue: 30,
    unit: 'reps',
    active: true,
    createdAt: addDays(monday, -30).toISOString(),
    updatedAt: monday.toISOString(),
    ...overrides,
  };
}

function log(date: Date, amount = 1, completed = true): HabitLog {
  return {
    id: `log-${toLocalDateKey(date)}`,
    habitId: 'habit-1',
    date: toLocalDateKey(date),
    amount,
    completed,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
  };
}

describe('habit obligations', () => {
  it('makes a daily habit actionable every local day', () => {
    expect(isHabitScheduledOnDate(habit(), monday)).toBe(true);
    expect(getHabitStatusForDate(habit(), [], monday).completed).toBe(false);
  });

  it('honors selected weekdays across a week boundary', () => {
    const weekdays = habit({ recurrence: { type: 'weekdays', days: [1, 3, 5] } });
    expect(isHabitScheduledOnDate(weekdays, monday)).toBe(true);
    expect(isHabitScheduledOnDate(weekdays, addDays(monday, 1))).toBe(false);
    expect(isHabitScheduledOnDate(weekdays, addDays(monday, 4))).toBe(true);
    expect(isHabitScheduledOnDate(weekdays, addDays(monday, 6))).toBe(false);
  });

  it('marks a numeric target complete only when its target is reached', () => {
    expect(getHabitStatusForDate(habit(), [log(monday, 29, false)], monday).completed).toBe(false);
    expect(getHabitStatusForDate(habit(), [log(monday, 30, true)], monday).completed).toBe(true);
  });

  it('tracks weekly frequency without inventing a recurrence language', () => {
    const weekly = habit({
      recurrence: { type: 'weekly', frequency: 3 },
      targetType: 'boolean',
      targetValue: 1,
    });
    const logs = [log(monday), log(addDays(monday, 1))];
    const status = getHabitStatusForDate(weekly, logs, addDays(monday, 2), 1);
    expect(status.completed).toBe(false);
    expect(status.subtitle).toBe('2 / 3 this week');
    expect(getHabitStatusForDate(weekly, [...logs, log(addDays(monday, 2))], addDays(monday, 2), 1).completed).toBe(true);
  });
});

describe('habit reliability', () => {
  it('calculates expected and completed obligations for the current week', () => {
    const logs = [log(monday), log(addDays(monday, 1)), log(addDays(monday, 2))];
    const metrics = calculateHabitReliability(habit(), logs, addDays(monday, 3), 1);
    expect(metrics).toMatchObject({
      expected: 4,
      completed: 3,
      reliability: 75,
      totalCompletions: 3,
      xp: 30,
    });
    expect(metrics.bestStreak).toBe(3);
  });

  it('respects Sunday as a configurable week boundary', () => {
    const sunday = addDays(monday, 6);
    const metrics = calculateHabitReliability(habit(), [log(sunday)], sunday, 0);
    expect(metrics.expected).toBe(1);
    expect(metrics.completed).toBe(1);
    expect(metrics.reliability).toBe(100);
  });

  it('counts consecutive successful weeks for weekly-frequency habits', () => {
    const weekly = habit({
      recurrence: { type: 'weekly', frequency: 3 },
      targetType: 'boolean',
      targetValue: 1,
      createdAt: addDays(monday, -7).toISOString(),
    });
    const logs = [
      log(addDays(monday, -7)),
      log(addDays(monday, -6)),
      log(addDays(monday, -5)),
      log(monday),
      log(addDays(monday, 1)),
      log(addDays(monday, 2)),
    ];
    const metrics = calculateHabitReliability(weekly, logs, addDays(monday, 2), 1);
    expect(metrics.currentStreak).toBe(2);
    expect(metrics.bestStreak).toBe(2);
  });
});

describe('local calendar dates', () => {
  it('keeps observations on the intended side of local midnight', () => {
    expect(toLocalDateKey(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02');
    expect(toLocalDateKey(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
  });

  it('advances by a civil day across the local daylight-saving transition', () => {
    const beforeTransition = new Date(2026, 2, 28, 12);
    expect(toLocalDateKey(addDays(beforeTransition, 1))).toBe('2026-03-29');
  });
});
