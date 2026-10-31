import { describe, expect, it } from 'vitest';
import {
  allocateDiscount,
  computeDiscountAmount,
  finalUnitPrice,
  invoiceTotal,
  lineAmount,
  normalizeToMonthly,
  taxAmountFor,
} from '@/lib/pricing';

describe('variant pricing', () => {
  it('adds the variant extra to the base price', () => {
    // Workspace Suite ₹1,499.00 base + On-premise ₹560.00 extra
    expect(finalUnitPrice(149_900, 56_000)).toBe(205_900);
    expect(finalUnitPrice(149_900, 0)).toBe(149_900);
  });

  it('computes line amounts from quantity and unit price', () => {
    expect(lineAmount(5, 205_900)).toBe(1_029_500);
  });
});

describe('tax calculation', () => {
  it('applies GST 18% with rounding to whole paise', () => {
    expect(taxAmountFor(100_000, 1800)).toBe(18_000);
    expect(taxAmountFor(99_999, 1800)).toBe(18_000); // 17999.82 -> 18000
  });

  it('applies GST 5%', () => {
    expect(taxAmountFor(49_900, 500)).toBe(2_495);
  });

  it('returns zero for zero rates and zero base', () => {
    expect(taxAmountFor(123_456, 0)).toBe(0);
    expect(taxAmountFor(0, 1800)).toBe(0);
  });
});

describe('discount calculation', () => {
  it('computes percentage discounts in basis points', () => {
    expect(computeDiscountAmount('PERCENT', 1000, 50_000)).toBe(5_000);
    expect(computeDiscountAmount('PERCENT', 1575, 10_000)).toBe(1_575);
  });

  it('computes fixed discounts and caps at the base', () => {
    expect(computeDiscountAmount('FIXED', 2_000, 50_000)).toBe(2_000);
    expect(computeDiscountAmount('FIXED', 60_000, 50_000)).toBe(50_000);
  });

  it('never produces a negative or zero-base discount', () => {
    expect(computeDiscountAmount('FIXED', 1_000, 0)).toBe(0);
    expect(computeDiscountAmount('PERCENT', 1000, -5)).toBe(0);
  });
});

describe('invoice totals', () => {
  it('totals = subtotal - discount + tax', () => {
    expect(invoiceTotal(1_000_000, 100_000, 162_000)).toBe(1_062_000);
  });
});

describe('discount allocation across lines', () => {
  it('splits proportionally and assigns the remainder', () => {
    const shares = allocateDiscount([300, 300, 400], 101);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(101);
    expect(shares[0]).toBe(30); // floor(101*300/1000)=30
    expect(shares[2]).toBe(41); // remainder lands on the largest line
  });

  it('caps allocation at the combined base', () => {
    const shares = allocateDiscount([100, 100], 500);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(200);
  });

  it('returns zeros for empty or zero bases', () => {
    expect(allocateDiscount([], 100)).toEqual([]);
    expect(allocateDiscount([0, 0], 100)).toEqual([0, 0]);
  });
});

describe('MRR normalisation', () => {
  it('normalises each period to a monthly figure', () => {
    expect(normalizeToMonthly(1_000_000, 'MONTHLY')).toBe(1_000_000);
    expect(normalizeToMonthly(12_000_000, 'YEARLY')).toBe(1_000_000);
    expect(normalizeToMonthly(70_000, 'WEEKLY')).toBe(Math.round((70_000 * 52) / 12));
    expect(normalizeToMonthly(1_000, 'DAILY')).toBe(Math.round((1_000 * 365) / 12 / 30.4));
  });
});
