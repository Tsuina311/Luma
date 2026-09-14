import { format, parseISO, startOfWeek } from 'date-fns';

export type WeekStart = 0 | 1;

export function toLocalDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseLocalDate(date: string): Date {
  return parseISO(`${date}T12:00:00`);
}

export function getWeekStart(date: Date, weekStartsOn: WeekStart): Date {
  return startOfWeek(date, { weekStartsOn });
}

export function combineLocalDateAndTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}
