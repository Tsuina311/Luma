import { z } from 'zod';
import { isoTimestampSchema } from '@/src/domain/shared';

const urgencyProfileObjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  yellowDays: z.number().int().positive(),
  orangeDays: z.number().int().positive(),
  redDays: z.number().int().nonnegative(),
  isDefault: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const urgencyProfileSchema = urgencyProfileObjectSchema.refine(
  (value) => value.yellowDays > value.orangeDays && value.orangeDays > value.redDays,
  { message: 'Urgency thresholds must descend from yellow to red' },
);

export type UrgencyProfile = z.infer<typeof urgencyProfileSchema>;

export const urgencyProfileInputSchema = urgencyProfileObjectSchema.pick({
  name: true,
  yellowDays: true,
  orangeDays: true,
  redDays: true,
  isDefault: true,
}).refine(
  (value) => value.yellowDays > value.orangeDays && value.orangeDays > value.redDays,
  { message: 'Urgency thresholds must descend from yellow to red' },
);

export type UrgencyProfileInput = z.infer<typeof urgencyProfileInputSchema>;

export const deadlineSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(160),
  notes: z.string().trim().max(4000).optional(),
  dueAt: isoTimestampSchema,
  urgencyProfileId: z.string().min(1),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  completedAt: isoTimestampSchema.optional(),
});

export type Deadline = z.infer<typeof deadlineSchema>;

export const deadlineInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  notes: z.string().trim().max(4000).optional(),
  dueAt: isoTimestampSchema,
  urgencyProfileId: z.string().min(1),
  reminderOffsets: z.array(z.union([z.literal(7), z.literal(3), z.literal(1), z.literal(0)])),
});

export type DeadlineInput = z.infer<typeof deadlineInputSchema>;

export const deadlineNotificationRuleSchema = z.object({
  id: z.string().min(1),
  deadlineId: z.string().min(1),
  offsetDays: z.union([z.literal(7), z.literal(3), z.literal(1), z.literal(0)]),
  enabled: z.boolean(),
  createdAt: isoTimestampSchema,
});

export type DeadlineNotificationRule = z.infer<typeof deadlineNotificationRuleSchema>;
