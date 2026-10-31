import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCustomerAccess, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { nextDocumentNumber } from '@/lib/numbering';
import { addBillingPeriod, addDays, todayUtc } from '@/lib/dates';
import { canTransitionSubscription, subscriptionTransitions } from '@/lib/transitions';
import { finalUnitPrice, invoiceTotal, lineAmount, taxAmountFor } from '@/lib/pricing';
import {
  SUBSCRIPTION_STATUS_LABELS,
  type BillingPeriod,
  type SubscriptionStatus,
} from '@/lib/enums';
import {
  subscriptionAddLineSchema,
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
} from '@/validation/subscription';
import type { ZodError } from 'zod';
import { defaultTaxForProduct } from '@/services/tax.service';
import { getPlan } from '@/services/plan.service';

function zodMessage(error: ZodError, fallback: string): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : fallback;
}

export interface SubscriptionLineView {
  id: string;
  kind: string;
  productId: string | null;
  productName: string | null;
  variantLabel: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxName: string | null;
  taxRateBps: number | null;
  taxAmount: number;
  sortOrder: number;
}

export interface SubscriptionSummary {
  id: string;
  number: string;
  status: SubscriptionStatus;
  statusLabel: string;
  paused: boolean;
  customerName: string;
  customerEmail: string;
  customerId: string;
  planName: string;
  planId: string;
  planPeriod: string;
  quantity: number;
  startDate: Date;
  endDate: Date;
  nextBillingDate: Date | null;
  total: number;
}

export interface SubscriptionFilters {
  q?: string;
  status?: string;
  planId?: string;
  customerId?: string;
  paused?: string;
}

function buildWhere(filters: SubscriptionFilters): Prisma.SubscriptionWhereInput {
  return {
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q } },
            { customer: { name: { contains: filters.q } } },
            { customer: { email: { contains: filters.q } } },
          ],
        }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.planId ? { planId: filters.planId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.paused === 'paused' ? { pausedAt: { not: null } } : {}),
    ...(filters.paused === 'active' ? { pausedAt: null } : {}),
  };
}

const SORTABLE: Record<string, keyof Prisma.SubscriptionOrderByWithRelationInput> = {
  number: 'number',
  startDate: 'startDate',
  endDate: 'endDate',
  nextBillingDate: 'nextBillingDate',
  total: 'total',
  createdAt: 'createdAt',
  status: 'status',
};

export async function listSubscriptions(actor: Actor, params: ListParams, filters: SubscriptionFilters = {}) {
  assertStaffOrOwnCustomer(actor, filters);
  const where = buildWhere({
    ...filters,
    ...(actor.role === 'CUSTOMER' ? { customerId: actor.customerId ?? '__none__' } : {}),
  });
  const orderBy: Prisma.SubscriptionOrderByWithRelationInput[] = [
    { [SORTABLE[params.sort] ?? 'createdAt']: params.dir },
  ];
  const [items, total] = await Promise.all([
    db.subscription.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, period: true } },
      },
    }),
    db.subscription.count({ where }),
  ]);
  return {
    items: items.map((s): SubscriptionSummary => ({
      id: s.id,
      number: s.number,
      status: s.status as SubscriptionStatus,
      statusLabel: SUBSCRIPTION_STATUS_LABELS[s.status as SubscriptionStatus],
      paused: s.pausedAt !== null,
      customerName: s.customer.name,
      customerEmail: s.customer.email,
      customerId: s.customer.id,
      planName: s.plan.name,
      planId: s.plan.id,
      planPeriod: s.plan.period,
      quantity: s.quantity,
      startDate: s.startDate,
      endDate: s.endDate,
      nextBillingDate: s.nextBillingDate,
      total: s.total,
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

function assertStaffOrOwnCustomer(actor: Actor, filters: SubscriptionFilters): void {
  if (actor.role === 'CUSTOMER') {
    if (!actor.customerId) throw new ValidationError('No customer profile linked to this account.');
    return;
  }
  assertStaff(actor);
  void filters;
}

export interface SubscriptionDetail {
  id: string;
  number: string;
  status: SubscriptionStatus;
  statusLabel: string;
  allowedTransitions: SubscriptionStatus[];
  customerId: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  planPeriod: string;
  planFlags: {
    autoClose: boolean;
    allowEarlyClose: boolean;
    allowPause: boolean;
    allowRenew: boolean;
  };
  quantity: number;
  startDate: Date;
  endDate: Date;
  quoteExpiresAt: Date | null;
  nextBillingDate: Date | null;
  paymentTerms: string;
  pausedAt: Date | null;
  closedAt: Date | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  templateName: string | null;
  createdByName: string | null;
  lines: SubscriptionLineView[];
  history: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    userName: string | null;
    createdAt: Date;
  }[];
  invoices: {
    id: string;
    number: string;
    status: string;
    issueDate: Date;
    dueDate: Date;
    periodStart: Date;
    periodEnd: Date;
    total: number;
    paidTotal: number;
    sentAt: Date | null;
  }[];
}

export async function getSubscription(actor: Actor, id: string): Promise<SubscriptionDetail> {
  const s = await db.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: true,
      template: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { product: true, variantOption: true, tax: true },
      },
      history: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      },
      invoices: { orderBy: { periodStart: 'desc' } },
    },
  });
  if (!s) throw new NotFoundError('Subscription not found.');
  assertCustomerAccess(actor, s.customerId);
  return {
    id: s.id,
    number: s.number,
    status: s.status as SubscriptionStatus,
    statusLabel: SUBSCRIPTION_STATUS_LABELS[s.status as SubscriptionStatus],
    allowedTransitions: subscriptionTransitions(s.status as SubscriptionStatus),
    customerId: s.customerId,
    customerName: s.customer.name,
    customerEmail: s.customer.email,
    planId: s.planId,
    planName: s.plan.name,
    planPeriod: s.plan.period,
    planFlags: {
      autoClose: s.plan.autoClose,
      allowEarlyClose: s.plan.allowEarlyClose,
      allowPause: s.plan.allowPause,
      allowRenew: s.plan.allowRenew,
    },
    quantity: s.quantity,
    startDate: s.startDate,
    endDate: s.endDate,
    quoteExpiresAt: s.quoteExpiresAt,
    nextBillingDate: s.nextBillingDate,
    paymentTerms: s.paymentTerms,
    pausedAt: s.pausedAt,
    closedAt: s.closedAt,
    subtotal: s.subtotal,
    taxTotal: s.taxTotal,
    total: s.total,
    templateName: s.template?.name ?? null,
    createdByName: s.createdBy?.name ?? null,
    lines: s.lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      productId: l.productId,
      productName: l.product?.name ?? null,
      variantLabel: l.variantOption ? `${l.variantOption.attribute}: ${l.variantOption.value}` : null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      taxName: l.tax?.name ?? null,
      taxRateBps: l.tax?.rateBps ?? null,
      taxAmount: l.taxAmount,
      sortOrder: l.sortOrder,
    })),
    history: s.history.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      userName: h.user?.name ?? null,
      createdAt: h.createdAt,
    })),
    invoices: s.invoices.map((i) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd,
      total: i.total,
      paidTotal: i.paidTotal,
      sentAt: i.sentAt,
    })),
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Recompute cached subscription totals from its lines. */
async function recomputeTotals(client: Db, subscriptionId: string): Promise<void> {
  const lines = await client.subscriptionLine.findMany({ where: { subscriptionId } });
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);
  await client.subscription.update({
    where: { id: subscriptionId },
    data: { subtotal, taxTotal, total: invoiceTotal(subtotal, 0, taxTotal) },
  });
}

interface ResolvedLine {
  kind: 'PLAN' | 'PRODUCT';
  productId: string | null;
  variantOptionId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxId: string | null;
}

/** Build plan + product lines with server-computed prices and default taxes. */
async function resolveLines(
  planId: string,
  quantity: number,
  lineInputs: { productId: string; variantOptionId?: string; quantity: number; taxId?: string }[],
): Promise<ResolvedLine[]> {
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new ValidationError('Selected plan does not exist.');
  if (quantity < plan.minQuantity) {
    throw new ValidationError(`Quantity must be at least the plan minimum of ${plan.minQuantity}.`);
  }
  const productIds = lineInputs.map((l) => l.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { variantOptions: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines: ResolvedLine[] = [
    {
      kind: 'PLAN',
      productId: null,
      variantOptionId: null,
      description: plan.name,
      quantity,
      unitPrice: plan.price,
      taxId: null,
    },
  ];

  for (const input of lineInputs) {
    const product = productById.get(input.productId);
    if (!product) throw new ValidationError('One or more selected products no longer exist.');
    if (!product.isActive) throw new ValidationError(`${product.name} is inactive and cannot be added.`);
    let variantId: string | null = null;
    let extra = 0;
    let variantLabel = '';
    if (input.variantOptionId) {
      const variant = product.variantOptions.find((v) => v.id === input.variantOptionId);
      if (!variant) throw new ValidationError(`Invalid variant selected for ${product.name}.`);
      variantId = variant.id;
      extra = variant.priceExtra;
      variantLabel = ` — ${variant.attribute}: ${variant.value}`;
    }
    const taxId = input.taxId || (await defaultTaxForProduct(product.id))?.id || null;
    lines.push({
      kind: 'PRODUCT',
      productId: product.id,
      variantOptionId: variantId,
      description: `${product.name}${variantLabel}`,
      quantity: input.quantity,
      unitPrice: finalUnitPrice(product.salesPrice, extra),
      taxId,
    });
  }
  return lines;
}

async function createLineRecords(
  client: Db,
  subscriptionId: string,
  lines: ResolvedLine[],
  taxRateLookup: Map<string, number>,
): Promise<void> {
  await client.subscriptionLine.deleteMany({ where: { subscriptionId } });
  for (const [i, line] of lines.entries()) {
    const amount = lineAmount(line.quantity, line.unitPrice);
    const rate = line.taxId ? (taxRateLookup.get(line.taxId) ?? 0) : 0;
    await client.subscriptionLine.create({
      data: {
        subscriptionId,
        kind: line.kind,
        productId: line.productId,
        variantOptionId: line.variantOptionId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxId: line.taxId,
        amount,
        taxAmount: taxAmountFor(amount, rate),
        sortOrder: i,
      },
    });
  }
}

async function taxRateLookup(ids: (string | null)[]): Promise<Map<string, number>> {
  const unique = [...new Set(ids.filter((x): x is string => x !== null))];
  if (unique.length === 0) return new Map();
  const taxes = await db.tax.findMany({ where: { id: { in: unique } } });
  return new Map(taxes.map((t) => [t.id, t.rateBps]));
}

export async function createSubscription(actor: Actor, raw: unknown): Promise<string> {
  assertStaff(actor);
  const parsed = subscriptionCreateSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(zodMessage(parsed.error, 'Invalid subscription.'));
  const input = parsed.data;

  const customer = await db.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new ValidationError('Selected customer does not exist.');
  const plan = await getPlan(actor, input.planId);
  const today = todayUtc();
  if (!plan.isActive) throw new ValidationError('Selected plan is inactive.');
  if (plan.availableFrom.getTime() > today.getTime()) {
    throw new ValidationError('Selected plan is not yet available.');
  }
  if (plan.availableTo && plan.availableTo.getTime() < today.getTime()) {
    throw new ValidationError('Selected plan is no longer available.');
  }

  const lines = await resolveLines(input.planId, input.quantity, input.lines);
  const rates = await taxRateLookup(lines.map((l) => l.taxId));
  let templateId: string | null = null;
  let quoteValidityDays = 15;
  if (input.templateId) {
    const template = await db.quoteTemplate.findUnique({ where: { id: input.templateId } });
    if (!template) throw new ValidationError('Selected template does not exist.');
    if (template.planId !== input.planId) {
      throw new ValidationError('The selected template is linked to a different plan.');
    }
    templateId = template.id;
    quoteValidityDays = template.validityDays;
  }

  return db.$transaction(async (tx) => {
    const number = await nextDocumentNumber('SUB', tx);
    const sub = await tx.subscription.create({
      data: {
        number,
        customerId: customer.id,
        planId: input.planId,
        quantity: input.quantity,
        status: 'DRAFT',
        startDate: input.startDate,
        endDate: input.endDate,
        quoteExpiresAt: templateId ? addDays(input.startDate, quoteValidityDays) : null,
        paymentTerms: input.paymentTerms,
        templateId,
        createdById: actor.id,
      },
    });
    await createLineRecords(tx, sub.id, lines, rates);
    await recomputeTotals(tx, sub.id);
    await tx.subscriptionStatusHistory.create({
      data: {
        subscriptionId: sub.id,
        fromStatus: null,
        toStatus: 'DRAFT',
        userId: actor.id,
        note: 'Subscription created as draft.',
      },
    });
    await tx.auditLog.create({
      data: { entityType: 'subscription', entityId: sub.id, action: 'create', toStatus: 'DRAFT', userId: actor.id },
    });
    return sub.id;
  });
}

export async function transitionSubscription(
  actor: Actor,
  id: string,
  toStatusRaw: string,
  note?: string,
): Promise<void> {
  assertStaff(actor);
  const toStatus = toStatusRaw as SubscriptionStatus;
  if (!['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'].includes(toStatus)) {
    throw new ValidationError('Unknown subscription status.');
  }
  const s = await db.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!s) throw new NotFoundError('Subscription not found.');
  const fromStatus = s.status as SubscriptionStatus;
  if (!canTransitionSubscription(fromStatus, toStatus)) {
    throw new ConflictError(
      `Cannot move subscription from ${SUBSCRIPTION_STATUS_LABELS[fromStatus]} to ${SUBSCRIPTION_STATUS_LABELS[toStatus]}.`,
    );
  }
  if (toStatus === 'ACTIVE') {
    if (s.startDate.getTime() > Date.now()) {
      throw new ValidationError('Cannot activate a subscription before its start date.');
    }
    const planLineCount = await db.subscriptionLine.count({
      where: { subscriptionId: id, kind: 'PLAN' },
    });
    if (s.quantity < s.plan.minQuantity || planLineCount === 0) {
      throw new ValidationError(`Plan minimum quantity is ${s.plan.minQuantity}.`);
    }
  }
  await db.$transaction(async (tx) => {
    const data: Prisma.SubscriptionUpdateInput = { status: toStatus };
    if (toStatus === 'QUOTATION' && !s.quoteExpiresAt) {
      data.quoteExpiresAt = addDays(todayUtc(), 15);
    }
    if (toStatus === 'ACTIVE') {
      data.nextBillingDate = s.startDate;
    }
    if (toStatus === 'CLOSED') {
      data.closedAt = new Date();
      data.nextBillingDate = null;
      data.pausedAt = null;
    }
    await tx.subscription.update({ where: { id }, data });
    await tx.subscriptionStatusHistory.create({
      data: { subscriptionId: id, fromStatus, toStatus, userId: actor.id, note: note ?? null },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'subscription',
        entityId: id,
        action: 'status_change',
        fromStatus,
        toStatus,
        userId: actor.id,
        detail: note ?? null,
      },
    });
  });
}

export interface SubscriptionUpdateData {
  paymentTerms: string;
  startDate: Date;
  endDate: Date;
  quantity: number;
}

export async function updateSubscription(actor: Actor, id: string, raw: unknown): Promise<void> {
  assertStaff(actor);
  const s = await db.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'DRAFT') {
    throw new ConflictError('Only draft subscriptions can be edited.');
  }
  const parsed = subscriptionUpdateSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(zodMessage(parsed.error, 'Invalid subscription update.'));
  const input = parsed.data;
  if (input.endDate.getTime() <= input.startDate.getTime()) {
    throw new ValidationError('Expiry date must be after the start date.');
  }
  if (input.quantity < s.plan.minQuantity) {
    throw new ValidationError(`Quantity must be at least the plan minimum of ${s.plan.minQuantity}.`);
  }
  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id },
      data: {
        paymentTerms: input.paymentTerms,
        startDate: input.startDate,
        endDate: input.endDate,
        quantity: input.quantity,
      },
    });
    const planLine = await tx.subscriptionLine.findFirst({
      where: { subscriptionId: id, kind: 'PLAN' },
    });
    if (planLine) {
      await tx.subscriptionLine.update({
        where: { id: planLine.id },
        data: {
          quantity: input.quantity,
          amount: lineAmount(input.quantity, planLine.unitPrice),
        },
      });
    }
    await recomputeTotals(tx, id);
  });
}

export async function addSubscriptionLine(
  actor: Actor,
  subscriptionId: string,
  raw: unknown,
): Promise<void> {
  assertStaff(actor);
  const parsed = subscriptionAddLineSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(zodMessage(parsed.error, 'Invalid line.'));
  const s = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'DRAFT') throw new ConflictError('Lines can only be edited while the subscription is a draft.');
  const [resolved] = await resolveLines(s.planId, s.quantity, [parsed.data]);
  const productLine = resolved.kind === 'PRODUCT' ? resolved : null;
  if (!productLine) throw new ValidationError('Could not resolve product line.');
  const rates = await taxRateLookup([productLine.taxId]);
  await db.$transaction(async (tx) => {
    const last = await tx.subscriptionLine.findFirst({
      where: { subscriptionId },
      orderBy: { sortOrder: 'desc' },
    });
    const amount = lineAmount(productLine.quantity, productLine.unitPrice);
    await tx.subscriptionLine.create({
      data: {
        subscriptionId,
        kind: 'PRODUCT',
        productId: productLine.productId,
        variantOptionId: productLine.variantOptionId,
        description: productLine.description,
        quantity: productLine.quantity,
        unitPrice: productLine.unitPrice,
        taxId: productLine.taxId,
        amount,
        taxAmount: taxAmountFor(amount, rates.get(productLine.taxId ?? '') ?? 0),
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    await recomputeTotals(tx, subscriptionId);
  });
}

export async function removeSubscriptionLine(actor: Actor, subscriptionId: string, lineId: string): Promise<void> {
  assertStaff(actor);
  const s = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'DRAFT') throw new ConflictError('Lines can only be edited while the subscription is a draft.');
  const line = await db.subscriptionLine.findFirst({ where: { id: lineId, subscriptionId } });
  if (!line) throw new NotFoundError('Line not found.');
  if (line.kind === 'PLAN') throw new ValidationError('The plan line cannot be removed.');
  await db.$transaction(async (tx) => {
    await tx.subscriptionLine.delete({ where: { id: lineId } });
    await recomputeTotals(tx, subscriptionId);
  });
}

export async function deleteSubscription(actor: Actor, id: string): Promise<void> {
  assertStaff(actor);
  const s = await db.subscription.findUnique({ where: { id }, include: { _count: { select: { invoices: true } } } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'DRAFT') throw new ConflictError('Only draft subscriptions can be deleted.');
  if (s._count.invoices > 0) throw new ConflictError('This subscription already has invoices.');
  await db.$transaction([
    db.subscriptionStatusHistory.deleteMany({ where: { subscriptionId: id } }),
    db.auditLog.deleteMany({ where: { entityType: 'subscription', entityId: id } }),
    db.subscription.delete({ where: { id } }),
  ]);
}

export async function pauseSubscription(actor: Actor, id: string): Promise<void> {
  assertStaff(actor);
  const s = await db.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be paused.');
  if (!s.plan.allowPause) throw new ConflictError('Pause is not allowed for this plan.');
  if (s.pausedAt) throw new ConflictError('Subscription is already paused.');
  await db.$transaction([
    db.subscription.update({ where: { id }, data: { pausedAt: new Date() } }),
    db.auditLog.create({
      data: { entityType: 'subscription', entityId: id, action: 'pause', userId: actor.id },
    }),
  ]);
}

export async function resumeSubscription(actor: Actor, id: string): Promise<void> {
  assertStaff(actor);
  const s = await db.subscription.findUnique({ where: { id } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be resumed.');
  if (!s.pausedAt) throw new ConflictError('Subscription is not paused.');
  await db.$transaction([
    db.subscription.update({ where: { id }, data: { pausedAt: null } }),
    db.auditLog.create({
      data: { entityType: 'subscription', entityId: id, action: 'resume', userId: actor.id },
    }),
  ]);
}

/**
 * Close a subscription. Closing before the end date requires the plan to
 * allow early close; closing a past-end subscription is the auto-close path.
 */
export async function closeSubscription(actor: Actor, id: string, note?: string): Promise<void> {
  assertStaff(actor);
  const s = await db.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be closed.');
  const today = todayUtc();
  const early = s.endDate.getTime() > today.getTime();
  if (early && !s.plan.allowEarlyClose) {
    throw new ConflictError('Early close is not allowed for this plan.');
  }
  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), nextBillingDate: null, pausedAt: null },
    });
    await tx.subscriptionStatusHistory.create({
      data: {
        subscriptionId: id,
        fromStatus: 'ACTIVE',
        toStatus: 'CLOSED',
        userId: actor.id,
        note: note ?? (early ? 'Closed early.' : 'Closed at end of term.'),
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'subscription',
        entityId: id,
        action: 'status_change',
        fromStatus: 'ACTIVE',
        toStatus: 'CLOSED',
        userId: actor.id,
        detail: early ? 'early_close' : 'term_end',
      },
    });
  });
}

/** Renew: extend the term by one billing period from the later of end date or today. */
export async function renewSubscription(actor: Actor, id: string): Promise<void> {
  assertStaff(actor);
  const s = await db.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!s) throw new NotFoundError('Subscription not found.');
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be renewed.');
  if (!s.plan.allowRenew) throw new ConflictError('Renewal is not allowed for this plan.');
  const today = todayUtc();
  const base = s.endDate.getTime() > today.getTime() ? s.endDate : today;
  const newEnd = addBillingPeriod(base, s.plan.period as BillingPeriod);
  await db.$transaction([
    db.subscription.update({
      where: { id },
      data: { endDate: newEnd, nextBillingDate: s.nextBillingDate ?? today, pausedAt: null },
    }),
    db.auditLog.create({
      data: {
        entityType: 'subscription',
        entityId: id,
        action: 'renew',
        userId: actor.id,
        detail: `Extended to ${newEnd.toISOString().slice(0, 10)}`,
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Customer portal lifecycle actions (ownership enforced server-side)
// ---------------------------------------------------------------------------

async function loadOwnActiveSubscription(actor: Actor, id: string) {
  if (actor.role !== 'CUSTOMER' || !actor.customerId) {
    throw new ForbiddenError('This action is limited to customer accounts.');
  }
  const s = await db.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!s) throw new NotFoundError('Subscription not found.');
  assertCustomerAccess(actor, s.customerId);
  return s;
}

/** Customer portal: pause own subscription when the plan allows it. */
export async function portalPauseSubscription(actor: Actor, id: string): Promise<void> {
  const s = await loadOwnActiveSubscription(actor, id);
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be paused.');
  if (!s.plan.allowPause) throw new ConflictError('Pause is not allowed for this plan.');
  if (s.pausedAt) throw new ConflictError('Subscription is already paused.');
  await db.$transaction([
    db.subscription.update({ where: { id }, data: { pausedAt: new Date() } }),
    db.auditLog.create({
      data: { entityType: 'subscription', entityId: id, action: 'pause', userId: actor.id, detail: 'portal' },
    }),
  ]);
}

export async function portalResumeSubscription(actor: Actor, id: string): Promise<void> {
  const s = await loadOwnActiveSubscription(actor, id);
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be resumed.');
  if (!s.pausedAt) throw new ConflictError('Subscription is not paused.');
  await db.$transaction([
    db.subscription.update({ where: { id }, data: { pausedAt: null } }),
    db.auditLog.create({
      data: { entityType: 'subscription', entityId: id, action: 'resume', userId: actor.id, detail: 'portal' },
    }),
  ]);
}

export async function portalCloseSubscription(actor: Actor, id: string): Promise<void> {
  const s = await loadOwnActiveSubscription(actor, id);
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be closed.');
  if (!s.plan.allowEarlyClose) throw new ConflictError('Early close is not allowed for this plan.');
  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), nextBillingDate: null, pausedAt: null },
    });
    await tx.subscriptionStatusHistory.create({
      data: {
        subscriptionId: id,
        fromStatus: 'ACTIVE',
        toStatus: 'CLOSED',
        userId: actor.id,
        note: 'Closed by customer from the portal.',
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'subscription',
        entityId: id,
        action: 'status_change',
        fromStatus: 'ACTIVE',
        toStatus: 'CLOSED',
        userId: actor.id,
        detail: 'portal_early_close',
      },
    });
  });
}

export async function portalRenewSubscription(actor: Actor, id: string): Promise<void> {
  const s = await loadOwnActiveSubscription(actor, id);
  if (s.status !== 'ACTIVE') throw new ConflictError('Only active subscriptions can be renewed.');
  if (!s.plan.allowRenew) throw new ConflictError('Renewal is not allowed for this plan.');
  const today = todayUtc();
  const base = s.endDate.getTime() > today.getTime() ? s.endDate : today;
  const newEnd = addBillingPeriod(base, s.plan.period as BillingPeriod);
  await db.$transaction([
    db.subscription.update({
      where: { id },
      data: { endDate: newEnd, nextBillingDate: s.nextBillingDate ?? today, pausedAt: null },
    }),
    db.auditLog.create({
      data: {
        entityType: 'subscription',
        entityId: id,
        action: 'renew',
        userId: actor.id,
        detail: `portal renew to ${newEnd.toISOString().slice(0, 10)}`,
      },
    }),
  ]);
}

/** Auto-close pass used by the billing run: close past-end subs on auto-close plans. */
export async function autoCloseDueSubscriptions(
  asOfDate: Date,
  actorId: string | null,
  client: Db,
): Promise<{ id: string; number: string }[]> {
  const due = await client.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: asOfDate },
      plan: { autoClose: true },
    },
    select: { id: true, number: true },
  });
  if (due.length === 0) return [];
  const ids = due.map((d) => d.id);
  await client.subscription.updateMany({
    where: { id: { in: ids } },
    data: { status: 'CLOSED', closedAt: new Date(), nextBillingDate: null, pausedAt: null },
  });
  await client.subscriptionStatusHistory.createMany({
    data: ids.map((id) => ({
      subscriptionId: id,
      fromStatus: 'ACTIVE',
      toStatus: 'CLOSED',
      userId: actorId,
      note: 'Auto-closed at end of term.',
    })),
  });
  await client.auditLog.createMany({
    data: ids.map((id) => ({
      entityType: 'subscription',
      entityId: id,
      action: 'auto_close',
      fromStatus: 'ACTIVE',
      toStatus: 'CLOSED',
      userId: actorId,
    })),
  });
  return due;
}
