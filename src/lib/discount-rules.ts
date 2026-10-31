import type { DiscountType } from '@/lib/enums';
import { computeDiscountAmount } from '@/lib/pricing';

/** Candidate discount as evaluated against one subscription period. */
export interface DiscountCandidate {
  id: string;
  name: string;
  isActive: boolean;
  type: DiscountType;
  value: number; // minor units for FIXED, basis points for PERCENT
  minPurchase: number | null;
  minQuantity: number | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  usedCount: number;
  scope: 'SUBSCRIPTION' | 'PRODUCTS';
  productIds: string[];
}

export interface DiscountLineContext {
  productId: string | null;
  amount: number; // quantity * unitPrice, pre-discount
  quantity: number;
}

export interface DiscountEvaluationContext {
  /** Invoice period start; eligibility window is inclusive. */
  onDate: Date;
  lines: DiscountLineContext[];
}

export type DiscountIneligibilityReason =
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'min_purchase'
  | 'min_quantity'
  | 'no_matching_products';

export interface DiscountEvaluation {
  discountId: string;
  eligible: boolean;
  reason?: DiscountIneligibilityReason;
  discountAmount: number;
}

/** Amount this discount would remove for the given lines. */
export function discountAmountForLines(
  discount: Pick<DiscountCandidate, 'type' | 'value' | 'scope' | 'productIds'>,
  lines: DiscountLineContext[],
): number {
  const base = eligibleBase(discount, lines);
  return computeDiscountAmount(discount.type, discount.value, base);
}

function eligibleBase(
  discount: Pick<DiscountCandidate, 'scope' | 'productIds'>,
  lines: DiscountLineContext[],
): number {
  const scoped =
    discount.scope === 'PRODUCTS'
      ? lines.filter((l) => l.productId !== null && discount.productIds.includes(l.productId))
      : lines;
  return scoped.reduce((sum, l) => sum + l.amount, 0);
}

export function eligibleQuantity(
  discount: Pick<DiscountCandidate, 'scope' | 'productIds'>,
  lines: DiscountLineContext[],
): number {
  const scoped =
    discount.scope === 'PRODUCTS'
      ? lines.filter((l) => l.productId !== null && discount.productIds.includes(l.productId))
      : lines;
  return scoped.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * Evaluate a discount against the billing context.
 * Expiry, usage limits, minimums and product scope are all enforced here,
 * so a discount that fails any rule must never be applied.
 */
export function evaluateDiscount(discount: DiscountCandidate, ctx: DiscountEvaluationContext): DiscountEvaluation {
  const ineligible = (reason: DiscountIneligibilityReason): DiscountEvaluation => ({
    discountId: discount.id,
    eligible: false,
    reason,
    discountAmount: 0,
  });

  if (!discount.isActive) return ineligible('inactive');
  if (ctx.onDate.getTime() < discount.startsAt.getTime()) return ineligible('not_started');
  if (ctx.onDate.getTime() > discount.endsAt.getTime()) return ineligible('expired');
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    return ineligible('usage_limit');
  }
  const base = eligibleBase(discount, ctx.lines);
  if (discount.scope === 'PRODUCTS' && base === 0) return ineligible('no_matching_products');
  if (discount.minPurchase !== null && base < discount.minPurchase) return ineligible('min_purchase');
  if (discount.minQuantity !== null && eligibleQuantity(discount, ctx.lines) < discount.minQuantity) {
    return ineligible('min_quantity');
  }
  const amount = computeDiscountAmount(discount.type, discount.value, base);
  if (amount <= 0) return ineligible('min_purchase');
  return { discountId: discount.id, eligible: true, discountAmount: amount };
}

/**
 * Pick the single best eligible discount (largest amount off).
 * Deterministic tie-break by discount id.
 */
export function selectBestDiscount(
  candidates: DiscountCandidate[],
  ctx: DiscountEvaluationContext,
): { discount: DiscountCandidate; amount: number } | null {
  let best: { discount: DiscountCandidate; amount: number } | null = null;
  for (const candidate of candidates) {
    const evaluation = evaluateDiscount(candidate, ctx);
    if (!evaluation.eligible) continue;
    if (!best || evaluation.discountAmount > best.amount || (evaluation.discountAmount === best.amount && candidate.id < best.discount.id)) {
      best = { discount: candidate, amount: evaluation.discountAmount };
    }
  }
  return best;
}
