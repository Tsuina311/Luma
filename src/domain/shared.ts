import { z } from 'zod';

export const isoTimestampSchema = z.string().datetime({ offset: true });
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

export type Urgency = 'green' | 'yellow' | 'orange' | 'red';

export type AttentionItem = {
  id: string;
  sourceType: 'deadline' | 'habit';
  sourceId: string;
  title: string;
  urgency: Urgency;
  subtitle: string;
  nextActionAt?: string;
  icon: string;
  progress?: { current: number; target: number; unit?: string };
};

export const urgencyWeight: Record<Urgency, number> = {
  green: 0,
  yellow: 1,
  orange: 2,
  red: 3,
};
