import { TIME_WINDOW_LABELS, type TimeWindow } from '../types';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatDateTime(value: Date | null | undefined): string {
  return value ? dateTime.format(value) : '-';
}

export function formatDate(value: Date | null | undefined): string {
  return value ? dateOnly.format(value) : '-';
}

/** Format a YYYY-MM-DD string without timezone drift. */
export function formatIsoDate(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ?? '-';
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return dateOnly.format(new Date(y, m - 1, d));
}

export function formatTimeWindow(value: TimeWindow | string): string {
  return TIME_WINDOW_LABELS[value as TimeWindow] ?? value;
}

/** Today as YYYY-MM-DD in the user's local timezone (for <input type="date" min>). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
