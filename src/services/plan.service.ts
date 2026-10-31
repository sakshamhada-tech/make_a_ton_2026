import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertAdmin, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { PERIOD_LABELS, type BillingPeriod } from '@/lib/enums';
import { planSchema, type PlanInput } from '@/validation/catalog';

export interface PlanListItem {
  id: string;
  name: string;
  price: number;
  period: string;
  minQuantity: number;
  availableFrom: Date;
  availableTo: Date | null;
  autoClose: boolean;
  allowEarlyClose: boolean;
  allowPause: boolean;
  allowRenew: boolean;
  isActive: boolean;
  subscriptionCount: number;
}

export async function listPlans(
  actor: Actor,
  params: ListParams,
  filters: { q?: string; period?: string; status?: string } = {},
) {
  assertStaff(actor);
  const where: Prisma.PlanWhereInput = {
    ...(filters.q ? { name: { contains: filters.q } } : {}),
    ...(filters.period ? { period: filters.period } : {}),
    ...(filters.status === 'active' ? { isActive: true } : filters.status === 'inactive' ? { isActive: false } : {}),
  };
  const [items, total] = await Promise.all([
    db.plan.findMany({
      where,
      orderBy: { [sortableColumn(params.sort)]: params.dir },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { _count: { select: { subscriptions: true } } },
    }),
    db.plan.count({ where }),
  ]);
  return {
    items: items.map((p): PlanListItem => ({
      id: p.id,
      name: p.name,
      price: p.price,
      period: p.period,
      minQuantity: p.minQuantity,
      availableFrom: p.availableFrom,
      availableTo: p.availableTo,
      autoClose: p.autoClose,
      allowEarlyClose: p.allowEarlyClose,
      allowPause: p.allowPause,
      allowRenew: p.allowRenew,
      isActive: p.isActive,
      subscriptionCount: p._count.subscriptions,
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

function sortableColumn(sort: string): 'name' | 'price' | 'createdAt' {
  if (sort === 'name' || sort === 'price') return sort;
  return 'createdAt';
}

export interface PlanDetail extends PlanListItem {
  createdAt: Date;
}

export async function getPlan(actor: Actor, id: string): Promise<PlanDetail> {
  assertStaff(actor);
  const p = await db.plan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!p) throw new NotFoundError('Plan not found.');
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    period: p.period,
    minQuantity: p.minQuantity,
    availableFrom: p.availableFrom,
    availableTo: p.availableTo,
    autoClose: p.autoClose,
    allowEarlyClose: p.allowEarlyClose,
    allowPause: p.allowPause,
    allowRenew: p.allowRenew,
    isActive: p.isActive,
    createdAt: p.createdAt,
    subscriptionCount: p._count.subscriptions,
  };
}

function parsePlan(raw: unknown): PlanInput {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid plan');
  }
  return parsed.data;
}

export async function createPlan(actor: Actor, raw: unknown): Promise<string> {
  assertAdmin(actor);
  const input = parsePlan(raw);
  const p = await db.plan.create({
    data: {
      name: input.name,
      price: input.price,
      period: input.period,
      minQuantity: input.minQuantity,
      availableFrom: input.availableFrom,
      availableTo: input.availableTo,
      autoClose: input.autoClose ?? true,
      allowEarlyClose: input.allowEarlyClose ?? false,
      allowPause: input.allowPause ?? false,
      allowRenew: input.allowRenew ?? true,
      isActive: input.isActive ?? true,
    },
  });
  return p.id;
}

export async function updatePlan(actor: Actor, id: string, raw: unknown): Promise<void> {
  assertAdmin(actor);
  const input = parsePlan(raw);
  const existing = await db.plan.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Plan not found.');
  if (input.minQuantity > existing.minQuantity) {
    const activeCount = await db.subscription.count({
      where: { planId: id, status: { in: ['CONFIRMED', 'ACTIVE'] } },
    });
    if (activeCount > 0) {
      throw new ValidationError(
        'Cannot raise the minimum quantity while confirmed or active subscriptions exist on this plan.',
      );
    }
  }
  await db.plan.update({
    where: { id },
    data: {
      name: input.name,
      price: input.price,
      period: input.period,
      minQuantity: input.minQuantity,
      availableFrom: input.availableFrom,
      availableTo: input.availableTo,
      autoClose: input.autoClose ?? true,
      allowEarlyClose: input.allowEarlyClose ?? false,
      allowPause: input.allowPause ?? false,
      allowRenew: input.allowRenew ?? true,
      isActive: input.isActive ?? true,
    },
  });
}

/** Plans selectable for a new subscription on a given date. */
export async function listPlansForSelection(actor: Actor, onDate: Date) {
  assertStaff(actor);
  const plans = await db.plan.findMany({
    where: {
      isActive: true,
      availableFrom: { lte: onDate },
      OR: [{ availableTo: null }, { availableTo: { gte: onDate } }],
    },
    orderBy: [{ period: 'asc' }, { price: 'asc' }],
  });
  return plans.map((p) => ({ ...p, periodLabel: PERIOD_LABELS[p.period as BillingPeriod] }));
}
