import type { BillingPeriod } from '@/lib/enums';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/** "31 Oct 2026" */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFmt.format(d);
}

/** "31 Oct 2026, 14:05" (UTC) */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateTimeFmt.format(d);
}

/** Date input value "yyyy-mm-dd" (UTC). */
export function toDateInput(value: Date | null | undefined): string {
  if (!value) return '';
  return value.toISOString().slice(0, 10);
}

/** Parse "yyyy-mm-dd" as UTC midnight. Returns null when invalid. */
export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Today at UTC midnight. */
export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getUTCMonth() + months;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const monthInYear = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, monthInYear + 1, 0)).getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(targetYear, monthInYear);
  d.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return d;
}

/** Advance a date by n billing periods (UTC arithmetic). */
export function addBillingPeriod(date: Date, period: BillingPeriod, count = 1): Date {
  switch (period) {
    case 'DAILY':
      return addDays(date, count);
    case 'WEEKLY':
      return addDays(date, 7 * count);
    case 'MONTHLY':
      return addMonthsClamped(date, count);
    case 'YEARLY':
      return addMonthsClamped(date, 12 * count);
  }
}

/** Human label for a billing period length, e.g. for period end display. */
export function billingPeriodLengthDays(period: BillingPeriod): number {
  switch (period) {
    case 'DAILY':
      return 1;
    case 'WEEKLY':
      return 7;
    case 'MONTHLY':
      return 30;
    case 'YEARLY':
      return 365;
  }
}

/** Day difference b - a (whole days). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
