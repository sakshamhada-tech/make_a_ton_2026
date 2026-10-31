import type { InvoiceStatus, SubscriptionStatus } from '@/lib/enums';

// Subscription status flows strictly forward: Draft -> Quotation -> Confirmed
// -> Active -> Closed. Any other transition must be rejected server-side.
const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  DRAFT: ['QUOTATION'],
  QUOTATION: ['CONFIRMED'],
  CONFIRMED: ['ACTIVE'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};

export function subscriptionTransitions(from: SubscriptionStatus): SubscriptionStatus[] {
  return SUBSCRIPTION_TRANSITIONS[from] ?? [];
}

export function canTransitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return subscriptionTransitions(from).includes(to);
}

const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'], // PAID is set automatically when fully settled
  PAID: [],
  CANCELLED: [],
};

export function invoiceTransitions(from: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_TRANSITIONS[from] ?? [];
}

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return invoiceTransitions(from).includes(to);
}
