import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCustomerAccess, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { nextDocumentNumber } from '@/lib/numbering';
import { addBillingPeriod, addDays, formatDate, todayUtc } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { allocateDiscount, invoiceTotal, taxAmountFor } from '@/lib/pricing';
import { canTransitionInvoice } from '@/lib/transitions';
import { INVOICE_STATUS_LABELS, type BillingPeriod, type InvoiceStatus } from '@/lib/enums';
import { discountCandidates } from '@/services/discount.service';
import { selectBestDiscount, type DiscountLineContext } from '@/lib/discount-rules';
import { sendMail } from '@/lib/mail';

export interface InvoiceListItem {
  id: string;
  number: string;
  status: InvoiceStatus;
  statusLabel: string;
  customerName: string;
  customerId: string;
  subscriptionId: string;
  subscriptionNumber: string;
  issueDate: Date;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  total: number;
  paidTotal: number;
  outstanding: number;
  overdue: boolean;
  sentAt: Date | null;
}

export interface InvoiceFilters {
  q?: string;
  status?: string;
  customerId?: string;
  planId?: string;
  overdue?: string;
  from?: Date | null;
  to?: Date | null;
}

function buildInvoiceWhere(filters: InvoiceFilters): Prisma.InvoiceWhereInput {
  const today = todayUtc();
  return {
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q } },
            { customer: { name: { contains: filters.q } } },
            { subscription: { number: { contains: filters.q } } },
          ],
        }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.planId ? { subscription: { planId: filters.planId } } : {}),
    // Fully settled invoices move to PAID, so CONFIRMED + past due = overdue.
    ...(filters.overdue === 'overdue' ? { status: 'CONFIRMED', dueDate: { lt: today } } : {}),
    ...(filters.from || filters.to
      ? {
          issueDate: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: addDays(filters.to, 1) } : {}),
          },
        }
      : {}),
  };
}

export async function listInvoices(actor: Actor, params: ListParams, filters: InvoiceFilters = {}) {
  if (actor.role === 'CUSTOMER') {
    if (!actor.customerId) throw new ValidationError('No customer profile linked to this account.');
    return listOwnInvoices(actor, params, filters);
  }
  assertStaff(actor);
  const where = buildInvoiceWhere(filters);
  const [items, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: sortOrderBy(params.sort, params.dir),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        subscription: { select: { id: true, number: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);
  return {
    items: items.map(toListItem),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

function sortOrderBy(
  sort: string,
  dir: 'asc' | 'desc',
): Prisma.InvoiceOrderByWithRelationInput[] {
  switch (sort) {
    case 'number':
      return [{ number: dir }];
    case 'total':
      return [{ total: dir }];
    case 'dueDate':
      return [{ dueDate: dir }];
    case 'issueDate':
      return [{ issueDate: dir }];
    case 'status':
      return [{ status: dir }];
    default:
      return [{ issueDate: dir }];
  }
}

function toListItem(i: {
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
  customer: { id: string; name: string; email: string };
  subscription: { id: string; number: string };
}): InvoiceListItem {
  const outstanding = Math.max(i.total - i.paidTotal, 0);
  return {
    id: i.id,
    number: i.number,
    status: i.status as InvoiceStatus,
    statusLabel: INVOICE_STATUS_LABELS[i.status as InvoiceStatus],
    customerName: i.customer.name,
    customerId: i.customer.id,
    subscriptionId: i.subscription.id,
    subscriptionNumber: i.subscription.number,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    total: i.total,
    paidTotal: i.paidTotal,
    outstanding,
    overdue:
      i.status === 'CONFIRMED' && outstanding > 0 && i.dueDate.getTime() < todayUtc().getTime(),
    sentAt: i.sentAt,
  };
}

async function listOwnInvoices(actor: Actor, params: ListParams, filters: InvoiceFilters) {
  const today = todayUtc();
  const where: Prisma.InvoiceWhereInput = {
    customerId: actor.customerId ?? '__none__',
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.overdue === 'overdue'
      ? { status: 'CONFIRMED', dueDate: { lt: today } }
      : {}),
    ...(filters.q ? { number: { contains: filters.q } } : {}),
  };
  const [items, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: sortOrderBy(params.sort, params.dir),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        subscription: { select: { id: true, number: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);
  return {
    items: items.map(toListItem),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

export interface InvoiceLineView {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discountAmount: number;
  taxName: string | null;
  taxRateBps: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoiceDetail {
  id: string;
  number: string;
  status: InvoiceStatus;
  statusLabel: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string | null;
  customerCity: string | null;
  customerState: string | null;
  customerCountry: string;
  customerPostalCode: string | null;
  customerGstin: string | null;
  subscriptionId: string;
  subscriptionNumber: string;
  planName: string;
  issueDate: Date;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paidTotal: number;
  outstanding: number;
  overdue: boolean;
  discountName: string | null;
  sentAt: Date | null;
  paymentTerms: string;
  lines: InvoiceLineView[];
  payments: {
    id: string;
    method: string;
    amount: number;
    paidAt: Date;
    note: string | null;
    createdByName: string | null;
  }[];
}

export async function getInvoice(actor: Actor, id: string): Promise<InvoiceDetail> {
  const i = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: { include: { plan: { select: { name: true } } } },
      discount: { select: { name: true } },
      lines: { orderBy: { id: 'asc' }, include: { tax: true } },
      payments: { orderBy: { paidAt: 'desc' }, include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!i) throw new NotFoundError('Invoice not found.');
  assertCustomerAccess(actor, i.customerId);
  const outstanding = Math.max(i.total - i.paidTotal, 0);
  return {
    id: i.id,
    number: i.number,
    status: i.status as InvoiceStatus,
    statusLabel: INVOICE_STATUS_LABELS[i.status as InvoiceStatus],
    customerId: i.customerId,
    customerName: i.customer.name,
    customerEmail: i.customer.email,
    customerAddress: i.customer.address,
    customerCity: i.customer.city,
    customerState: i.customer.state,
    customerCountry: i.customer.country,
    customerPostalCode: i.customer.postalCode,
    customerGstin: i.customer.gstin,
    subscriptionId: i.subscriptionId,
    subscriptionNumber: i.subscription.number,
    planName: i.subscription.plan.name,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    subtotal: i.subtotal,
    discountTotal: i.discountTotal,
    taxTotal: i.taxTotal,
    total: i.total,
    paidTotal: i.paidTotal,
    outstanding,
    overdue: i.status === 'CONFIRMED' && outstanding > 0 && i.dueDate.getTime() < todayUtc().getTime(),
    discountName: i.discount?.name ?? null,
    sentAt: i.sentAt,
    paymentTerms: i.subscription.paymentTerms,
    lines: i.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      discountAmount: l.discountAmount,
      taxName: l.tax?.name ?? null,
      taxRateBps: l.taxRateBps,
      taxAmount: l.taxAmount,
      lineTotal: l.lineTotal,
    })),
    payments: i.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount,
      paidAt: p.paidAt,
      note: p.note,
      createdByName: p.createdBy?.name ?? null,
    })),
  };
}

export type InvoiceGenerationSkipReason =
  | 'invalid_status'
  | 'already_billed'
  | 'paused'
  | 'not_due'
  | 'past_end_with_auto_close';

export interface InvoiceGenerationResult {
  outcome: 'created' | 'skipped' | 'failed';
  invoiceId?: string;
  invoiceNumber?: string;
  reason?: InvoiceGenerationSkipReason | string;
}

/**
 * Generate the next invoice for a subscription.
 *
 * Runs in a single transaction: the (subscriptionId, periodStart) unique
 * constraint guarantees an invoice can never bill the same period twice, and
 * the chosen discount's usage counter is incremented atomically with the
 * invoice insert.
 */
export async function generateInvoiceForSubscription(
  subscriptionId: string,
  actorId: string | null,
  asOfDate: Date = todayUtc(),
): Promise<InvoiceGenerationResult> {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, customer: true },
  });
  if (!subscription) return { outcome: 'failed', reason: 'Subscription not found.' };
  if (subscription.status !== 'ACTIVE') return { outcome: 'skipped', reason: 'invalid_status' };
  if (subscription.pausedAt) return { outcome: 'skipped', reason: 'paused' };
  const period = subscription.plan.period as BillingPeriod;
  const periodStart = subscription.nextBillingDate ?? subscription.startDate;
  if (subscription.plan.autoClose && periodStart.getTime() > subscription.endDate.getTime()) {
    return { outcome: 'skipped', reason: 'past_end_with_auto_close' };
  }
  if (periodStart.getTime() > asOfDate.getTime()) {
    return { outcome: 'skipped', reason: 'not_due' };
  }
  const periodEnd = addBillingPeriod(periodStart, period);

  const existing = await db.invoice.findUnique({
    where: { subscriptionId_periodStart: { subscriptionId, periodStart } },
  });
  if (existing) return { outcome: 'skipped', reason: 'already_billed' };

  const lines = await db.subscriptionLine.findMany({
    where: { subscriptionId },
    orderBy: { sortOrder: 'asc' },
    include: { tax: true },
  });
  if (lines.length === 0) return { outcome: 'failed', reason: 'Subscription has no lines.' };

  const lineContexts: DiscountLineContext[] = lines.map((l) => ({
    productId: l.productId,
    amount: l.amount,
    quantity: l.quantity,
  }));
  const candidates = await discountCandidates(periodStart);
  const best = selectBestDiscount(candidates, { onDate: periodStart, lines: lineContexts });
  const discountTotal = best?.amount ?? 0;

  const bases = lines.map((l) => l.amount);
  const allocations = allocateDiscount(bases, discountTotal);
  const taxTotal = lines.reduce(
    (sum, l, idx) => sum + taxAmountFor(l.amount - allocations[idx], l.tax?.rateBps ?? 0),
    0,
  );
  const total = invoiceTotal(
    bases.reduce((a, b) => a + b, 0),
    discountTotal,
    taxTotal,
  );
  const paymentTermDays = parsePaymentTermDays(subscription.paymentTerms);
  const dueDate =
    paymentTermDays === 0 ? periodStart : addDays(periodStart, paymentTermDays);

  try {
    const invoice = await db.$transaction(async (tx) => {
      const number = await nextDocumentNumber('INV', tx);
      const created = await tx.invoice.create({
        data: {
          number,
          subscriptionId,
          customerId: subscription.customerId,
          status: 'DRAFT',
          issueDate: periodStart,
          dueDate,
          periodStart,
          periodEnd,
          subtotal: bases.reduce((a, b) => a + b, 0),
          discountTotal,
          taxTotal,
          total,
          discountId: best?.discount.id ?? null,
          createdById: actorId,
          lines: {
            create: lines.map((l, idx) => {
              const allocated = allocations[idx];
              const rate = l.tax?.rateBps ?? 0;
              const taxAmount = taxAmountFor(l.amount - allocated, rate);
              return {
                productId: l.productId,
                variantOptionId: l.variantOptionId,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountAmount: allocated,
                taxId: l.taxId,
                taxRateBps: rate,
                amount: l.amount,
                taxAmount,
                lineTotal: l.amount - allocated + taxAmount,
              };
            }),
          },
        },
      });
      if (best) {
        await tx.discount.update({
          where: { id: best.discount.id },
          data: { usedCount: { increment: 1 } },
        });
      }
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { nextBillingDate: periodEnd },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'invoice',
          entityId: created.id,
          action: 'generate',
          toStatus: 'DRAFT',
          userId: actorId,
          detail: `Period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
        },
      });
      return created;
    });
    return { outcome: 'created', invoiceId: invoice.id, invoiceNumber: invoice.number };
  } catch (error) {
    // Unique violation: another generator billed this period concurrently.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { outcome: 'skipped', reason: 'already_billed' };
    }
    return {
      outcome: 'failed',
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function parsePaymentTermDays(terms: string): number {
  const match = /^Net\s+(\d+)$/.exec(terms);
  if (match) return Number.parseInt(match[1], 10);
  return 0; // Due on receipt
}

/** Manual "Generate invoice" from a subscription page (staff only). */
export async function createInvoiceFromSubscription(
  actor: Actor,
  subscriptionId: string,
): Promise<InvoiceGenerationResult> {
  assertStaff(actor);
  const result = await generateInvoiceForSubscription(subscriptionId, actor.id, todayUtc());
  if (result.outcome === 'failed') {
    throw new ValidationError(result.reason ?? 'Invoice generation failed.');
  }
  return result;
}

async function transitionInvoice(actor: Actor, id: string, to: InvoiceStatus, action: string): Promise<void> {
  assertStaff(actor);
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  const from = invoice.status as InvoiceStatus;
  if (!canTransitionInvoice(from, to)) {
    throw new ConflictError(
      `Cannot move invoice from ${INVOICE_STATUS_LABELS[from]} to ${INVOICE_STATUS_LABELS[to]}.`,
    );
  }
  await db.$transaction([
    db.invoice.update({ where: { id }, data: { status: to } }),
    db.auditLog.create({
      data: {
        entityType: 'invoice',
        entityId: id,
        action,
        fromStatus: from,
        toStatus: to,
        userId: actor.id,
      },
    }),
  ]);
}

export async function confirmInvoice(actor: Actor, id: string): Promise<void> {
  await transitionInvoice(actor, id, 'CONFIRMED', 'confirm');
}

export async function cancelInvoice(actor: Actor, id: string): Promise<void> {
  await transitionInvoice(actor, id, 'CANCELLED', 'cancel');
}

/** Send the invoice to the customer via the dev outbox mailer. */
export async function sendInvoice(actor: Actor, id: string): Promise<void> {
  assertStaff(actor);
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { customer: true, subscription: { include: { plan: { select: { name: true } } } } },
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (invoice.status !== 'CONFIRMED') {
    throw new ConflictError('Confirm the invoice before sending it.');
  }
  const body = [
    `Hello ${invoice.customer.name},`,
    '',
    `Invoice ${invoice.number} from Brightloop Software is ready.`,
    `Plan: ${invoice.subscription.plan.name}`,
    `Billing period: ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`,
    `Amount: ${formatMoney(invoice.total)} (paid to date: ${formatMoney(invoice.paidTotal)})`,
    `Due date: ${formatDate(invoice.dueDate)}`,
    `Payment terms: ${invoice.subscription.paymentTerms}`,
    '',
    'View and print your invoices in the customer portal.',
    '',
    '— Brightloop Software billing',
  ].join('\n');
  await sendMail({
    to: invoice.customer.email,
    subject: `Invoice ${invoice.number} from Brightloop Software`,
    body,
    entityType: 'invoice',
    entityId: invoice.id,
  });
  await db.$transaction([
    db.invoice.update({ where: { id }, data: { sentAt: new Date() } }),
    db.auditLog.create({
      data: { entityType: 'invoice', entityId: id, action: 'send', userId: actor.id },
    }),
  ]);
}
