import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertAdmin, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { formatBps, formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { DiscountCandidate } from '@/lib/discount-rules';
import { discountSchema, parseDiscountForm } from '@/validation/catalog';

export interface DiscountListItem {
  id: string;
  name: string;
  type: string;
  value: number;
  valueLabel: string;
  scope: string;
  startsAt: Date;
  endsAt: Date;
  minPurchase: number | null;
  minQuantity: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  periodLabel: string;
}

export async function listDiscounts(actor: Actor, params: ListParams) {
  assertStaff(actor);
  const [items, total] = await Promise.all([
    db.discount.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.discount.count(),
  ]);
  return {
    items: items.map((d): DiscountListItem => ({
      id: d.id,
      name: d.name,
      type: d.type,
      value: d.value,
      valueLabel: d.type === 'PERCENT' ? formatBps(d.value) : formatMoney(d.value),
      scope: d.scope,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      minPurchase: d.minPurchase,
      minQuantity: d.minQuantity,
      usageLimit: d.usageLimit,
      usedCount: d.usedCount,
      isActive: d.isActive,
      periodLabel: `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}`,
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

export async function getDiscount(actor: Actor, id: string) {
  assertStaff(actor);
  const d = await db.discount.findUnique({
    where: { id },
    include: { products: true },
  });
  if (!d) throw new NotFoundError('Discount not found.');
  return {
    ...d,
    valueLabel: d.type === 'PERCENT' ? formatBps(d.value) : formatMoney(d.value),
    productIds: d.products.map((p) => p.productId),
  };
}

export async function createDiscount(actor: Actor, raw: unknown): Promise<string> {
  assertAdmin(actor);
  const form = discountSchema.safeParse(raw);
  if (!form.success) {
    const issue = form.error.issues[0];
    throw new ValidationError(issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid discount');
  }
  const input = parseDiscountForm(form.data);
  const d = await db.discount.create({
    data: {
      name: input.name,
      type: input.type,
      value: input.value,
      minPurchase: input.minPurchase,
      minQuantity: input.minQuantity,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      usageLimit: input.usageLimit,
      scope: input.scope,
      isActive: input.isActive,
      products:
        input.scope === 'PRODUCTS'
          ? { create: input.productIds.map((productId) => ({ productId })) }
          : undefined,
    },
  });
  return d.id;
}

export async function updateDiscount(actor: Actor, id: string, raw: unknown): Promise<void> {
  assertAdmin(actor);
  const form = discountSchema.safeParse(raw);
  if (!form.success) {
    const issue = form.error.issues[0];
    throw new ValidationError(issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid discount');
  }
  const existing = await db.discount.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Discount not found.');
  const input = parseDiscountForm(form.data);
  await db.$transaction([
    db.discountProduct.deleteMany({ where: { discountId: id } }),
    db.discount.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        value: input.value,
        minPurchase: input.minPurchase,
        minQuantity: input.minQuantity,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        usageLimit: input.usageLimit,
        scope: input.scope,
        isActive: input.isActive,
      },
    }),
    ...(input.scope === 'PRODUCTS' && input.productIds.length > 0
      ? [
          db.discountProduct.createMany({
            data: input.productIds.map((productId) => ({ discountId: id, productId })),
          }),
        ]
      : []),
  ]);
}

/**
 * Candidate discounts for automatic application on the next invoice.
 * Fetch only plausibly-active windows to keep invoice generation cheap.
 */
export async function discountCandidates(onDate: Date): Promise<DiscountCandidate[]> {
  const discounts = await db.discount.findMany({
    where: { isActive: true, startsAt: { lte: onDate }, endsAt: { gte: onDate } },
    include: { products: true },
  });
  return discounts.map((d) => ({
    id: d.id,
    name: d.name,
    isActive: d.isActive,
    type: d.type as DiscountCandidate['type'],
    value: d.value,
    minPurchase: d.minPurchase,
    minQuantity: d.minQuantity,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    scope: d.scope as DiscountCandidate['scope'],
    productIds: d.products.map((p) => p.productId),
  }));
}
