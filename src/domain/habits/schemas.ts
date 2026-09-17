import { z } from 'zod';
import { isoTimestampSchema, localDateSchema, timeOfDaySchema } from '@/src/domain/shared';

export const recurrenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({
    type: z.literal('weekdays'),
    days: z.array(z.number().int().min(0).max(6)).min(1).transform((days) => [...new Set(days)].sort()),
  }),
  z.object({
    type: z.literal('weekly'),
    frequency: z.number().int().min(1).max(7),
  }),
  z.object({
    type: z.literal('monthly'),
    frequency: z.number().int().min(1).max(31),
  }),
  z.object({
    type: z.literal('interval'),
    everyDays: z.number().int().min(1).max(365),
  }),
]);

export type HabitRecurrence = z.infer<typeof recurrenceSchema>;

export const habitSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(4000).optional(),
  recurrence: recurrenceSchema,
  targetType: z.enum(['boolean', 'count']),
  targetValue: z.number().positive(),
  unit: z.string().trim().max(40).optional(),
  reminderTime: timeOfDaySchema.optional(),
  active: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  archivedAt: isoTimestampSchema.optional(),
  archiveReason: z.enum(['deleted']).optional(),
});

export type Habit = z.infer<typeof habitSchema>;

export const habitInputSchema = habitSchema.pick({
  title: true,
  notes: true,
  recurrence: true,
  targetType: true,
  targetValue: true,
  unit: true,
  reminderTime: true,
  active: true,
}).superRefine((value, context) => {
  if (value.targetType === 'boolean' && value.targetValue !== 1) {
    context.addIssue({ code: 'custom', path: ['targetValue'], message: 'Boolean habits use a target of 1' });
  }
});

export type HabitInput = z.infer<typeof habitInputSchema>;

export const habitLogSchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  date: localDateSchema,
  amount: z.number().nonnegative(),
  previousAmount: z.number().nonnegative().optional(),
  completed: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export type HabitLog = z.infer<typeof habitLogSchema>;
