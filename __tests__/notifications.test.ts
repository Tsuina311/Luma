import { addDays } from 'date-fns';
import { describe, expect, it } from '@jest/globals';
import {
  limitNotificationIntents,
  planDeadlineNotifications,
  planHabitNotifications,
} from '@/src/domain/notifications/planner';
import type { Deadline, DeadlineNotificationRule } from '@/src/domain/deadlines/schemas';
import type { Habit, HabitLog } from '@/src/domain/habits/schemas';
import { toLocalDateKey } from '@/src/utils/dates';

const now = new Date(2026, 8, 14, 10, 0, 0);

describe('notification planning', () => {
  it('derives only future deadline reminders from authoritative rules', () => {
    const deadline: Deadline = {
      id: 'd1',
      title: 'Tax return',
      dueAt: addDays(now, 3).toISOString(),
      urgencyProfileId: 'normal',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const rule = (offsetDays: 0 | 1 | 3 | 7): DeadlineNotificationRule => ({
      id: `r${offsetDays}`,
      deadlineId: deadline.id,
      offsetDays,
      enabled: true,
      createdAt: now.toISOString(),
    });
    const intents = planDeadlineNotifications([deadline], [rule(7), rule(1), rule(0)], now);
    expect(intents).toHaveLength(2);
    expect(intents.map((intent) => intent.fireAt.toISOString())).toEqual([
      addDays(new Date(deadline.dueAt), -1).toISOString(),
      new Date(deadline.dueAt).toISOString(),
    ]);
  });

  it('does not plan a habit reminder after that local occurrence is complete', () => {
    const habit: Habit = {
      id: 'h1',
      title: 'Read',
      recurrence: { type: 'daily' },
      targetType: 'boolean',
      targetValue: 1,
      reminderTime: '19:00',
      active: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const completed: HabitLog = {
      id: 'l1',
      habitId: habit.id,
      date: toLocalDateKey(now),
      amount: 1,
      completed: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const intents = planHabitNotifications([habit], [completed], now, 2);
    expect(intents).toHaveLength(1);
    expect(toLocalDateKey(intents[0].fireAt)).toBe(toLocalDateKey(addDays(now, 1)));
  });

  it('keeps the pending schedule inside the platform-safe rolling window', () => {
    const intents = Array.from({ length: 75 }, (_, index) => ({
      sourceType: 'habit' as const,
      sourceId: String(index),
      title: 'Habit',
      body: 'Due',
      fireAt: addDays(now, 75 - index),
      route: `/habit/${index}` as const,
    }));
    const limited = limitNotificationIntents(intents);
    expect(limited).toHaveLength(60);
    expect(limited[0].sourceId).toBe('74');
  });
});
