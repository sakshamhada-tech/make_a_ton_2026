import { describe, expect, it } from 'vitest';
import {
  canTransitionInvoice,
  canTransitionSubscription,
  subscriptionTransitions,
} from '@/lib/transitions';
import { SUBSCRIPTION_STATUSES, INVOICE_STATUSES } from '@/lib/enums';

describe('subscription status transitions', () => {
  it('allows the strict forward flow', () => {
    expect(canTransitionSubscription('DRAFT', 'QUOTATION')).toBe(true);
    expect(canTransitionSubscription('QUOTATION', 'CONFIRMED')).toBe(true);
    expect(canTransitionSubscription('CONFIRMED', 'ACTIVE')).toBe(true);
    expect(canTransitionSubscription('ACTIVE', 'CLOSED')).toBe(true);
  });

  it('rejects skipping statuses', () => {
    expect(canTransitionSubscription('DRAFT', 'ACTIVE')).toBe(false);
    expect(canTransitionSubscription('QUOTATION', 'ACTIVE')).toBe(false);
    expect(canTransitionSubscription('DRAFT', 'CLOSED')).toBe(false);
  });

  it('rejects backward transitions', () => {
    expect(canTransitionSubscription('ACTIVE', 'CONFIRMED')).toBe(false);
    expect(canTransitionSubscription('CLOSED', 'ACTIVE')).toBe(false);
    expect(canTransitionSubscription('CONFIRMED', 'DRAFT')).toBe(false);
  });

  it('treats CLOSED as terminal', () => {
    expect(subscriptionTransitions('CLOSED')).toEqual([]);
    for (const to of SUBSCRIPTION_STATUSES) {
      expect(canTransitionSubscription('CLOSED', to)).toBe(false);
    }
  });

  it('only allows self-transitions nowhere', () => {
    for (const from of SUBSCRIPTION_STATUSES) {
      expect(canTransitionSubscription(from, from)).toBe(false);
    }
  });
});

describe('invoice status transitions', () => {
  it('allows draft to confirmed and cancellation from draft/confirmed', () => {
    expect(canTransitionInvoice('DRAFT', 'CONFIRMED')).toBe(true);
    expect(canTransitionInvoice('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransitionInvoice('CONFIRMED', 'CANCELLED')).toBe(true);
  });

  it('does not allow reopening paid or cancelled invoices', () => {
    expect(canTransitionInvoice('PAID', 'CONFIRMED')).toBe(false);
    expect(canTransitionInvoice('CANCELLED', 'DRAFT')).toBe(false);
    expect(canTransitionInvoice('CONFIRMED', 'DRAFT')).toBe(false);
  });

  it('covers every status without gaps', () => {
    for (const from of INVOICE_STATUSES) {
      for (const to of INVOICE_STATUSES) {
        expect(typeof canTransitionInvoice(from, to)).toBe('boolean');
      }
    }
  });
});
