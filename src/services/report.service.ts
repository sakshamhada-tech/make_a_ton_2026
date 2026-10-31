import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { assertStaff, type Actor } from '@/lib/rbac';
import { normalizeToMonthly } from '@/lib/pricing';
import { addDays, todayUtc } from '@/lib/dates';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '@/lib/enums';
import type { BillingPeriod } from '@/lib/enums';

export interface DashboardFilters {
  from?: Date | null;
  to?: Date | null;
  planId?: string;
  customerId?: string;
  status?: string;
}

export interface OverdueRow {
  id: string;
  number: string;
  customerName: string;
  subscriptionNumber: string;
  dueDate: Date;
  total: number;
  paidTotal: number;
  outstanding: number;
  daysOverdue: number;
}

export interface DashboardData {
  activeSubscriptions: number;
  pausedSubscriptions: number;
  mrrMinor: number;
  revenueCollectedMinor: number;
  outstandingMinor: number;
  overdueCount: number;
  overdueInvoiceValueMinor: number;
  newSubscriptionsInRange: number;
  overdue: OverdueRow[];
  recentPayments: {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
    paidAt: Date;
    method: string;
  }[];
  revenueByMonth: { month: string; label: string; amountMinor: number }[];
  subsByPlan: { planName: string; period: string; count: number; mrrMinor: number }[];
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Dashboard aggregates — all computed in SQL, never by loading tables. */
export async function getDashboardData(actor: Actor, filters: DashboardFilters = {}): Promise<DashboardData> {
  assertStaff(actor);
  const today = todayUtc();
  const rangeStart = filters.from ?? addDays(today, -365);
  const rangeEnd = filters.to ? addDays(filters.to, 1) : addDays(today, 1);

  const subWhere = {
    status: filters.status ?? 'ACTIVE',
    ...(filters.planId ? { planId: filters.planId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };

  const [activeCount, pausedCount, subs, paymentsAgg, outstandingAgg, overdueCountAgg, newSubsInRange, revenueRows] =
    await Promise.all([
      db.subscription.count({ where: { ...subWhere, status: 'ACTIVE' } }),
      db.subscription.count({
        where: {
          status: 'ACTIVE',
          pausedAt: { not: null },
          ...(filters.planId ? { planId: filters.planId } : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
        },
      }),
      db.subscription.findMany({
        where: { ...subWhere, status: 'ACTIVE', pausedAt: null },
        select: { total: true, plan: { select: { period: true } } },
      }),
      db.payment.aggregate({
        where: {
          paidAt: { gte: rangeStart, lt: rangeEnd },
          ...(filters.customerId ? { invoice: { customerId: filters.customerId } } : {}),
          ...(filters.planId ? { invoice: { subscription: { planId: filters.planId } } } : {}),
        },
        _sum: { amount: true },
      }),
      db.invoice.aggregate({
        where: {
          status: 'CONFIRMED',
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.planId ? { subscription: { planId: filters.planId } } : {}),
        },
        _sum: { total: true, paidTotal: true },
      }),
      db.invoice.aggregate({
        where: {
          status: 'CONFIRMED',
          dueDate: { lt: today },
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.planId ? { subscription: { planId: filters.planId } } : {}),
        },
        _count: { id: true },
        _sum: { total: true, paidTotal: true },
      }),
      db.subscription.count({
        where: {
          createdAt: { gte: rangeStart, lt: rangeEnd },
          ...(filters.planId ? { planId: filters.planId } : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
        },
      }),
      db.$queryRaw<{ month: string; total: number }[]>`
        SELECT substr(p.paidAt, 1, 7) AS month, SUM(p.amount) AS total
        FROM "Payment" p
        JOIN "Invoice" i ON i.id = p.invoiceId
        WHERE p.paidAt >= ${rangeStart.toISOString()}
          AND p.paidAt < ${rangeEnd.toISOString()}
          ${filters.customerId ? Prisma.sql`AND i.customerId = ${filters.customerId}` : Prisma.empty}
        GROUP BY month
        ORDER BY month ASC
      `,
    ]);

  const mrrMinor = subs.reduce(
    (sum, s) => sum + normalizeToMonthly(s.total, s.plan.period as BillingPeriod),
    0,
  );

  const [overdueRows, recentPayments, subsByPlanRaw] = await Promise.all([
    db.invoice.findMany({
      where: {
        status: 'CONFIRMED',
        dueDate: { lt: today },
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.planId ? { subscription: { planId: filters.planId } } : {}),
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      include: {
        customer: { select: { name: true } },
        subscription: { select: { number: true } },
      },
    }),
    db.payment.findMany({
      where: {
        paidAt: { gte: rangeStart, lt: rangeEnd },
        ...(filters.customerId ? { invoice: { customerId: filters.customerId } } : {}),
        ...(filters.planId ? { invoice: { subscription: { planId: filters.planId } } } : {}),
      },
      orderBy: { paidAt: 'desc' },
      take: 10,
      include: {
        invoice: {
          select: { id: true, number: true, customer: { select: { name: true } } },
        },
      },
    }),
    db.subscription.findMany({
      where: {
        status: 'ACTIVE',
        pausedAt: null,
        ...(filters.planId ? { planId: filters.planId } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
      select: { total: true, plan: { select: { name: true, period: true } } },
    }),
  ]);

  const byPlan = new Map<string, { planName: string; period: string; count: number; mrrMinor: number }>();
  for (const s of subsByPlanRaw) {
    const key = s.plan.name;
    const entry = byPlan.get(key) ?? { planName: s.plan.name, period: s.plan.period, count: 0, mrrMinor: 0 };
    entry.count += 1;
    entry.mrrMinor += normalizeToMonthly(s.total, s.plan.period as BillingPeriod);
    byPlan.set(key, entry);
  }

  // Ensure a continuous month series for the chart.
  const revenueByMonth: DashboardData['revenueByMonth'] = [];
  const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), 1));
  const totalsByKey = new Map(revenueRows.map((r) => [r.month, Number(r.total)]));
  while (cursor.getTime() <= endMonth.getTime() && revenueByMonth.length < 24) {
    const key = monthKey(cursor);
    revenueByMonth.push({
      month: key,
      label: MONTH_LABEL.format(cursor),
      amountMinor: totalsByKey.get(key) ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return {
    activeSubscriptions: activeCount,
    pausedSubscriptions: pausedCount,
    mrrMinor,
    revenueCollectedMinor: paymentsAgg._sum.amount ?? 0,
    outstandingMinor: (outstandingAgg._sum.total ?? 0) - (outstandingAgg._sum.paidTotal ?? 0),
    overdueCount: overdueCountAgg._count.id,
    overdueInvoiceValueMinor:
      (overdueCountAgg._sum.total ?? 0) - (overdueCountAgg._sum.paidTotal ?? 0),
    newSubscriptionsInRange: newSubsInRange,
    overdue: overdueRows.map((i) => ({
      id: i.id,
      number: i.number,
      customerName: i.customer.name,
      subscriptionNumber: i.subscription.number,
      dueDate: i.dueDate,
      total: i.total,
      paidTotal: i.paidTotal,
      outstanding: i.total - i.paidTotal,
      daysOverdue: Math.max(Math.round((today.getTime() - i.dueDate.getTime()) / 86_400_000), 0),
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.number,
      customerName: p.invoice.customer.name,
      amount: p.amount,
      paidAt: p.paidAt,
      method: p.method,
    })),
    revenueByMonth,
    subsByPlan: [...byPlan.values()].sort((a, b) => b.mrrMinor - a.mrrMinor).slice(0, 8),
  };
}

export interface ExportRow {
  [key: string]: string | number;
}

export async function exportSubscriptionsCsv(actor: Actor, filters: DashboardFilters & { q?: string } = {}): Promise<ExportRow[]> {
  assertStaff(actor);
  const rows = await db.subscription.findMany({
    where: {
      ...(filters.q ? { number: { contains: filters.q } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.planId ? { planId: filters.planId } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    orderBy: { number: 'asc' },
    take: 10_000,
    include: {
      customer: { select: { name: true, email: true } },
      plan: { select: { name: true, period: true } },
    },
  });
  return rows.map((s) => ({
    number: s.number,
    status: s.status,
    customer: s.customer.name,
    email: s.customer.email,
    plan: s.plan.name,
    period: s.plan.period,
    quantity: s.quantity,
    start: s.startDate.toISOString().slice(0, 10),
    end: s.endDate.toISOString().slice(0, 10),
    next_billing: s.nextBillingDate ? s.nextBillingDate.toISOString().slice(0, 10) : '',
    total_minor: s.total,
  }));
}

export async function exportInvoicesCsv(actor: Actor, filters: DashboardFilters & { q?: string } = {}): Promise<ExportRow[]> {
  assertStaff(actor);
  const rows = await db.invoice.findMany({
    where: {
      ...(filters.q ? { number: { contains: filters.q } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.planId ? { subscription: { planId: filters.planId } } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.from || filters.to
        ? {
            issueDate: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: addDays(filters.to, 1) } : {}),
            },
          }
        : {}),
    },
    orderBy: { number: 'asc' },
    take: 10_000,
    include: {
      customer: { select: { name: true, email: true } },
      subscription: { select: { number: true } },
    },
  });
  return rows.map((i) => ({
    number: i.number,
    status: INVOICE_STATUS_LABELS[i.status as InvoiceStatus] ?? i.status,
    customer: i.customer.name,
    email: i.customer.email,
    subscription: i.subscription.number,
    issued: i.issueDate.toISOString().slice(0, 10),
    due: i.dueDate.toISOString().slice(0, 10),
    subtotal_minor: i.subtotal,
    discount_minor: i.discountTotal,
    tax_minor: i.taxTotal,
    total_minor: i.total,
    paid_minor: i.paidTotal,
    outstanding_minor: i.total - i.paidTotal,
  }));
}

export async function exportPaymentsCsv(actor: Actor, filters: DashboardFilters & { q?: string } = {}): Promise<ExportRow[]> {
  assertStaff(actor);
  const rows = await db.payment.findMany({
    where: {
      ...(filters.q ? { invoice: { number: { contains: filters.q } } } : {}),
      ...(filters.customerId ? { invoice: { customerId: filters.customerId } } : {}),
      ...(filters.from || filters.to
        ? {
            paidAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: addDays(filters.to, 1) } : {}),
            },
          }
        : {}),
    },
    orderBy: { paidAt: 'asc' },
    take: 10_000,
    include: {
      invoice: {
        select: { number: true, customer: { select: { name: true } } },
      },
    },
  });
  return rows.map((p) => ({
    paid_at: p.paidAt.toISOString().slice(0, 10),
    invoice: p.invoice.number,
    customer: p.invoice.customer.name,
    method: p.method,
    amount_minor: p.amount,
    note: p.note ?? '',
  }));
}
