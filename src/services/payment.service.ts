import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCustomerAccess, assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums';
import { paymentCreateSchema } from '@/validation/billing';

export interface PaymentListItem {
  id: string;
  invoiceNumber: string;
  invoiceId: string;
  customerName: string;
  method: string;
  methodLabel: string;
  amount: number;
  paidAt: Date;
  note: string | null;
  createdByName: string | null;
}

export interface PaymentFilters {
  q?: string;
  method?: string;
  customerId?: string;
  from?: Date | null;
  to?: Date | null;
}

function buildPaymentWhere(filters: PaymentFilters): Prisma.PaymentWhereInput {
  return {
    ...(filters.q
      ? {
          OR: [
            { invoice: { number: { contains: filters.q } } },
            { invoice: { customer: { name: { contains: filters.q } } } },
          ],
        }
      : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.customerId ? { invoice: { customerId: filters.customerId } } : {}),
    ...(filters.from || filters.to
      ? {
          paidAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: new Date(filters.to.getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };
}

export async function listPayments(actor: Actor, params: ListParams, filters: PaymentFilters = {}) {
  assertStaff(actor);
  const where = buildPaymentWhere(filters);
  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: [{ paidAt: params.dir }, { id: params.dir }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        invoice: {
          select: { id: true, number: true, customer: { select: { id: true, name: true } } },
        },
        createdBy: { select: { name: true } },
      },
    }),
    db.payment.count({ where }),
  ]);
  return {
    items: items.map((p): PaymentListItem => ({
      id: p.id,
      invoiceNumber: p.invoice.number,
      invoiceId: p.invoice.id,
      customerName: p.invoice.customer.name,
      method: p.method,
      methodLabel: PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method,
      amount: p.amount,
      paidAt: p.paidAt,
      note: p.note,
      createdByName: p.createdBy?.name ?? null,
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

/**
 * Record a payment against an invoice. Partial payments are allowed; the
 * invoice flips to PAID automatically once fully settled.
 */
export async function recordPayment(actor: Actor, raw: unknown): Promise<string> {
  assertStaff(actor);
  const parsed = paymentCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(
      issue ? `${issue.path.join('.') || 'form'}: ${issue.message}` : 'Invalid payment.',
    );
  }
  const input = parsed.data;
  const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (invoice.status !== 'CONFIRMED') {
    throw new ConflictError('Payments can only be recorded against confirmed invoices.');
  }
  const outstanding = invoice.total - invoice.paidTotal;
  if (input.amount > outstanding) {
    throw new ValidationError(
      `Payment exceeds the outstanding amount of ${(outstanding / 100).toFixed(2)}.`,
    );
  }

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        method: input.method,
        amount: input.amount,
        paidAt: input.paidAt,
        note: input.note || null,
        createdById: actor.id,
      },
    });
    const newPaidTotal = invoice.paidTotal + input.amount;
    const settled = newPaidTotal >= invoice.total;
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidTotal: newPaidTotal,
        ...(settled ? { status: 'PAID' } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'payment',
        entityId: created.id,
        action: 'record',
        toStatus: settled ? 'PAID' : undefined,
        userId: actor.id,
        detail: `Invoice ${invoice.number}: ${(input.amount / 100).toFixed(2)} via ${input.method}`,
      },
    });
    return created;
  });
  return payment.id;
}

export async function deletePayment(actor: Actor, paymentId: string): Promise<void> {
  assertStaff(actor);
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });
  if (!payment) throw new NotFoundError('Payment not found.');
  if (payment.invoice.status === 'CANCELLED') {
    throw new ConflictError('Payments cannot be removed from cancelled invoices.');
  }
  await db.$transaction(async (tx) => {
    const newPaidTotal = Math.max(payment.invoice.paidTotal - payment.amount, 0);
    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        paidTotal: newPaidTotal,
        ...(payment.invoice.status === 'PAID' && newPaidTotal < payment.invoice.total
          ? { status: 'CONFIRMED' }
          : {}),
      },
    });
    await tx.payment.delete({ where: { id: paymentId } });
    await tx.auditLog.create({
      data: {
        entityType: 'payment',
        entityId: paymentId,
        action: 'delete',
        userId: actor.id,
        detail: `Removed from invoice ${payment.invoice.number}`,
      },
    });
  });
}

/** Own payments for the portal (scoped to the customer's invoices). */
export async function listOwnPayments(actor: Actor, params: ListParams) {
  if (actor.role !== 'CUSTOMER' || !actor.customerId) {
    throw new ValidationError('No customer profile linked to this account.');
  }
  const where: Prisma.PaymentWhereInput = { invoice: { customerId: actor.customerId } };
  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: [{ paidAt: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { invoice: { select: { id: true, number: true } } },
    }),
    db.payment.count({ where }),
  ]);
  return {
    items: items.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoice.number,
      invoiceId: p.invoice.id,
      method: PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method,
      amount: p.amount,
      paidAt: p.paidAt,
      note: p.note,
    })),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

export async function getInvoicePayments(actor: Actor, invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  assertCustomerAccess(actor, invoice.customerId);
  const payments = await db.payment.findMany({
    where: { invoiceId },
    orderBy: { paidAt: 'desc' },
    include: { createdBy: { select: { name: true } } },
  });
  return payments.map((p) => ({
    id: p.id,
    method: PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method,
    amount: p.amount,
    paidAt: p.paidAt,
    note: p.note,
    createdByName: p.createdBy?.name ?? null,
  }));
}
