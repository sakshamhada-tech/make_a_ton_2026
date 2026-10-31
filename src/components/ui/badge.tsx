import type { ReactNode } from 'react';
import type { InvoiceStatus, SubscriptionStatus } from '@/lib/enums';

const dotColor: Record<string, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  zinc: 'bg-zinc-400',
  red: 'bg-red-500',
};

const textColor: Record<string, string> = {
  emerald: 'text-emerald-800',
  amber: 'text-amber-800',
  sky: 'text-sky-800',
  zinc: 'text-zinc-600',
  red: 'text-red-700',
};

export function StatusBadge({ label, tone }: { label: string; tone: keyof typeof dotColor }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-2xs font-medium ${textColor[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor[tone]}`} aria-hidden="true" />
      {label}
    </span>
  );
}

const subscriptionTone: Record<SubscriptionStatus, keyof typeof dotColor> = {
  DRAFT: 'zinc',
  QUOTATION: 'amber',
  CONFIRMED: 'sky',
  ACTIVE: 'emerald',
  CLOSED: 'zinc',
};

export function SubscriptionBadge({ status, paused }: { status: SubscriptionStatus; paused?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <StatusBadge label={status.charAt(0) + status.slice(1).toLowerCase()} tone={subscriptionTone[status]} />
      {paused ? <StatusBadge label="Paused" tone="amber" /> : null}
    </span>
  );
}

const invoiceTone: Record<InvoiceStatus, keyof typeof dotColor> = {
  DRAFT: 'zinc',
  CONFIRMED: 'sky',
  PAID: 'emerald',
  CANCELLED: 'red',
};

export function InvoiceBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <StatusBadge label={status.charAt(0) + status.slice(1).toLowerCase()} tone={invoiceTone[status]} />
      {overdue ? <StatusBadge label="Overdue" tone="red" /> : null}
    </span>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-2xs font-medium text-zinc-600">
      {children}
    </span>
  );
}
