import type { Urgency } from '@/src/domain/shared';

export type AttentionVisualMode = 'green' | 'yellow' | 'red';

/** Theme from the worst open attention item: overdue → red, urgent → yellow, else green. */
export function visualModeFromUrgencies(urgencies: readonly Urgency[]): AttentionVisualMode {
  if (urgencies.some((urgency) => urgency === 'red')) return 'red';
  if (urgencies.some((urgency) => urgency === 'yellow' || urgency === 'orange')) return 'yellow';
  return 'green';
}
