import { addDays, addHours } from 'date-fns';
import { describe, expect, it } from '@jest/globals';
import { compareAttentionItems, getAttentionItems } from '@/src/domain/attention/engine';
import { calculateDeadlineUrgency, getTimeRemaining } from '@/src/domain/deadlines/logic';
import type { Deadline, UrgencyProfile } from '@/src/domain/deadlines/schemas';
import type { AttentionItem, Urgency } from '@/src/domain/shared';

const now = new Date('2026-09-14T10:00:00.000Z');
const profile: UrgencyProfile = {
  id: 'normal',
  name: 'Normal',
  yellowDays: 30,
  orangeDays: 14,
  redDays: 5,
  isDefault: true,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

function deadline(days: number, completed = false): Deadline {
  return {
    id: `deadline-${days}`,
    title: `Deadline ${days}`,
    dueAt: addDays(now, days).toISOString(),
    urgencyProfileId: profile.id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: completed ? now.toISOString() : undefined,
  };
}

describe('deadline urgency', () => {
  it.each<[number, Urgency]>([
    [31, 'green'],
    [30, 'yellow'],
    [15, 'yellow'],
    [14, 'orange'],
    [5, 'orange'],
    [4, 'red'],
    [-1, 'red'],
  ])('classifies the exact %s-day boundary as %s', (days, expected) => {
    expect(calculateDeadlineUrgency(deadline(days), profile, now)).toBe(expected);
  });

  it('does not leave a completed deadline urgent', () => {
    expect(calculateDeadlineUrgency(deadline(-3, true), profile, now)).toBe('green');
  });
});

describe('time remaining', () => {
  it('uses direct, human-friendly copy', () => {
    expect(getTimeRemaining(addHours(now, 2), now)).toBe('Due today');
    expect(getTimeRemaining(addDays(now, 1), now)).toBe('Tomorrow');
    expect(getTimeRemaining(addDays(now, 3), now)).toBe('3 days left');
    expect(getTimeRemaining(addDays(now, 21), now)).toBe('3 weeks left');
    expect(getTimeRemaining(addDays(now, 92), now)).toBe('3 months left');
    expect(getTimeRemaining(addDays(now, -2), now)).toBe('Overdue by 2 days');
  });
});

describe('attention sorting', () => {
  it('orders by urgency then actionable time and excludes completed deadlines', () => {
    const items = getAttentionItems({
      deadlines: [deadline(30), deadline(2), deadline(8), deadline(-1), deadline(1, true)],
      profiles: [profile],
      habits: [],
      habitLogs: [],
    }, now);
    expect(items.map((item) => item.urgency)).toEqual(['red', 'red', 'orange', 'yellow']);
    expect(items[0].sourceId).toBe('deadline--1');
  });

  it('uses stable title ordering when urgency and time are equal', () => {
    const base: AttentionItem = {
      id: '1',
      sourceId: '1',
      sourceType: 'habit',
      title: 'Beta',
      urgency: 'yellow',
      subtitle: 'Due',
      icon: '!',
    };
    expect([base, { ...base, id: '2', title: 'Alpha' }].sort(compareAttentionItems)[0].title).toBe('Alpha');
  });
});
