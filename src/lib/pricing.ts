import type { BillingPeriod, DiscountType } from '@/lib/enums';

/** Final unit price for a product line: base price plus variant extra. */
export function finalUnitPrice(basePriceMinor: number, variantExtraMinor: number): number {
  return basePriceMinor + variantExtraMinor;
}

/** Pre-discount line amount. */
export function lineAmount(quantity: number, unitPriceMinor: number): number {
  return quantity * unitPriceMinor;
}

/** Tax for a (possibly discounted) base, rounded half-up to whole minor units. */
export function taxAmountFor(baseMinor: number, rateBps: number): number {
  return Math.round((baseMinor * rateBps) / 10_000);
}

/**
 * Discount value for a base amount.
 * FIXED: value in minor units. PERCENT: value in basis points.
 * Never exceeds the base.
 */
export function computeDiscountAmount(type: DiscountType, value: number, baseMinor: number): number {
  if (baseMinor <= 0) return 0;
  const raw = type === 'FIXED' ? value : Math.round((baseMinor * value) / 10_000);
  return Math.min(Math.max(raw, 0), baseMinor);
}

/** Invoice total from parts. */
export function invoiceTotal(subtotalMinor: number, discountMinor: number, taxMinor: number): number {
  return subtotalMinor - discountMinor + taxMinor;
}

/** MRR contribution of one period amount. */
export function normalizeToMonthly(amountMinor: number, period: BillingPeriod): number {
  switch (period) {
    case 'DAILY':
      return Math.round((amountMinor * 365) / 12 / 30.4);
    case 'WEEKLY':
      return Math.round((amountMinor * 52) / 12);
    case 'MONTHLY':
      return amountMinor;
    case 'YEARLY':
      return Math.round(amountMinor / 12);
  }
}

/** Split a discount across line bases proportionally; remainder goes to the largest line. */
export function allocateDiscount(bases: readonly number[], totalDiscountMinor: number): number[] {
  const baseTotal = bases.reduce((sum, b) => sum + b, 0);
  if (baseTotal <= 0 || totalDiscountMinor <= 0) return bases.map(() => 0);
  const capped = Math.min(totalDiscountMinor, baseTotal);
  let allocated = 0;
  const shares = bases.map((b, i) => {
    const share = Math.floor((capped * b) / baseTotal);
    allocated += share;
    return { i, share, b };
  });
  let remainder = capped - allocated;
  const bySize = [...shares].sort((a, b) => b.b - a.b || a.i - b.i);
  for (const s of bySize) {
    if (remainder <= 0) break;
    shares[s.i].share += 1;
    remainder -= 1;
  }
  return shares.map((s) => s.share);
}
