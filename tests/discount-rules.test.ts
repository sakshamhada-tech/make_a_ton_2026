import { describe, expect, it } from 'vitest';
import {
  evaluateDiscount,
  selectBestDiscount,
  type DiscountCandidate,
  type DiscountLineContext,
} from '@/lib/discount-rules';

const day = 86_400_000;
const now = new Date('2026-10-31T00:00:00.000Z');

function candidate(overrides: Partial<DiscountCandidate> = {}): DiscountCandidate {
  return {
    id: 'd1',
    name: 'Test offer',
    isActive: true,
    type: 'PERCENT',
    value: 1000,
    minPurchase: null,
    minQuantity: null,
    startsAt: new Date(now.getTime() - 30 * day),
    endsAt: new Date(now.getTime() + 30 * day),
    usageLimit: null,
    usedCount: 0,
    scope: 'SUBSCRIPTION',
    productIds: [],
    ...overrides,
  };
}

const lines: DiscountLineContext[] = [
  { productId: 'p1', amount: 100_000, quantity: 2 },
  { productId: 'p2', amount: 50_000, quantity: 1 },
];

describe('discount eligibility', () => {
  it('applies an active in-window percentage discount', () => {
    const result = evaluateDiscount(candidate(), { onDate: now, lines });
    expect(result.eligible).toBe(true);
    expect(result.discountAmount).toBe(15_000); // 10% of 150,000
  });

  it('stops applying once the end date has passed', () => {
    const result = evaluateDiscount(candidate(), { onDate: new Date(now.getTime() + 31 * day), lines });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('expired');
    expect(result.discountAmount).toBe(0);
  });

  it('does not apply before the start date', () => {
    const result = evaluateDiscount(candidate(), { onDate: new Date(now.getTime() - 31 * day), lines });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_started');
  });

  it('stops when the usage limit is exhausted', () => {
    const exhausted = candidate({ usageLimit: 5, usedCount: 5 });
    const result = evaluateDiscount(exhausted, { onDate: now, lines });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('usage_limit');
  });

  it('applies while under the usage limit', () => {
    const almostDone = candidate({ usageLimit: 5, usedCount: 4 });
    expect(evaluateDiscount(almostDone, { onDate: now, lines }).eligible).toBe(true);
  });

  it('enforces the minimum purchase amount', () => {
    const result = evaluateDiscount(candidate({ minPurchase: 200_000 }), { onDate: now, lines });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('min_purchase');
  });

  it('enforces the minimum quantity', () => {
    const result = evaluateDiscount(candidate({ minQuantity: 10 }), { onDate: now, lines });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('min_quantity');
  });

  it('scopes to matching products only', () => {
    const scoped = candidate({ scope: 'PRODUCTS', productIds: ['p2'] });
    const result = evaluateDiscount(scoped, { onDate: now, lines });
    expect(result.eligible).toBe(true);
    expect(result.discountAmount).toBe(5_000); // 10% of p2 only
  });

  it('is ineligible when no scoped products appear in the lines', () => {
    const scoped = candidate({ scope: 'PRODUCTS', productIds: ['p9'] });
    const result = evaluateDiscount(scoped, { onDate: now, lines });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_matching_products');
  });

  it('ignores inactive discounts', () => {
    const result = evaluateDiscount(candidate({ isActive: false }), { onDate: now, lines });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('inactive');
  });
});

describe('best discount selection', () => {
  it('picks the largest eligible discount', () => {
    const small = candidate({ id: 'a', value: 500 });
    const large = candidate({ id: 'b', value: 1500 });
    const expired = candidate({ id: 'c', value: 5000, endsAt: new Date(now.getTime() - day) });
    const best = selectBestDiscount([small, large, expired], { onDate: now, lines });
    expect(best?.discount.id).toBe('b');
    expect(best?.amount).toBe(22_500);
  });

  it('returns null when nothing is eligible', () => {
    const expired = candidate({ endsAt: new Date(now.getTime() - day) });
    expect(selectBestDiscount([expired], { onDate: now, lines })).toBeNull();
  });
});
