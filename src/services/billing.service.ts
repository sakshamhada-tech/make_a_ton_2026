import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { assertStaff, type Actor } from '@/lib/rbac';
import { autoCloseDueSubscriptions } from '@/services/subscription.service';
import {
  generateInvoiceForSubscription,
  type InvoiceGenerationSkipReason,
} from '@/services/invoice.service';
import { formatDate } from '@/lib/dates';

export interface BillingRunSummaryLine {
  subscriptionNumber: string;
  customerName: string;
  outcome: 'created' | 'skipped' | 'failed';
  detail: string;
}

export interface BillingRunSummary {
  runId: string | null;
  asOfDate: Date;
  created: number;
  skipped: number;
  failed: number;
  autoClosed: number;
  lines: BillingRunSummaryLine[];
}

const SKIP_LABELS: Record<InvoiceGenerationSkipReason, string> = {
  invalid_status: 'Not active',
  already_billed: 'Period already billed',
  paused: 'Paused',
  not_due: 'Not due yet',
  past_end_with_auto_close: 'Ended — will auto-close',
};

const BATCH_SIZE = 50;
const MAX_LINES_STORED = 500;

/**
 * Run billing for all Active subscriptions due on or before `asOfDate`.
 *
 * Idempotent by construction: each invoice insert enforces the unique
 * (subscription, periodStart) constraint and advances the subscription's
 * next billing date in the same transaction, so re-running the same date
 * bills nothing twice. Past-end subscriptions on auto-close plans are closed.
 */
export async function runBilling(actor: Actor, asOfDate: Date): Promise<BillingRunSummary> {
  assertStaff(actor);

  const candidates = await db.subscription.findMany({
    where: {
      status: 'ACTIVE',
      pausedAt: null,
      nextBillingDate: { not: null, lte: asOfDate },
    },
    select: {
      id: true,
      number: true,
      customer: { select: { name: true } },
    },
    orderBy: { number: 'asc' },
  });

  const lines: BillingRunSummaryLine[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (sub) => {
        const result = await generateInvoiceForSubscription(sub.id, actor.id, asOfDate);
        return { sub, result };
      }),
    );
    for (const { sub, result } of results) {
      if (result.outcome === 'created') {
        created += 1;
        if (lines.length < MAX_LINES_STORED) {
          lines.push({
            subscriptionNumber: sub.number,
            customerName: sub.customer.name,
            outcome: 'created',
            detail: `Invoice ${result.invoiceNumber ?? ''}`.trim(),
          });
        }
      } else if (result.outcome === 'skipped') {
        skipped += 1;
        if (lines.length < MAX_LINES_STORED) {
          const reason = (result.reason ?? '') as InvoiceGenerationSkipReason;
          lines.push({
            subscriptionNumber: sub.number,
            customerName: sub.customer.name,
            outcome: 'skipped',
            detail: SKIP_LABELS[reason] ?? result.reason ?? 'Skipped',
          });
        }
      } else {
        failed += 1;
        if (lines.length < MAX_LINES_STORED) {
          lines.push({
            subscriptionNumber: sub.number,
            customerName: sub.customer.name,
            outcome: 'failed',
            detail: result.reason ?? 'Unknown error',
          });
        }
      }
    }
  }

  const autoCloseTargets = await db.$transaction(async (tx) =>
    autoCloseDueSubscriptions(asOfDate, actor.id, tx),
  );
  const autoClosed = autoCloseTargets.length;
  if (autoClosed > 0) {
    const closedCustomers = await db.subscription.findMany({
      where: { id: { in: autoCloseTargets.map((t) => t.id) } },
      select: { number: true, customer: { select: { name: true } } },
    });
    const byNumber = new Map(closedCustomers.map((c) => [c.number, c.customer.name]));
    for (const target of autoCloseTargets) {
      if (lines.length < MAX_LINES_STORED) {
        lines.push({
          subscriptionNumber: target.number,
          customerName: byNumber.get(target.number) ?? '',
          outcome: 'skipped',
          detail: 'Auto-closed at end of term',
        });
      }
    }
  }

  const run = await db.billingRun.create({
    data: {
      ranById: actor.id,
      asOfDate,
      created,
      skipped,
      failed,
      details: JSON.stringify(lines),
    },
  });

  return { runId: run.id, asOfDate, created, skipped, failed, autoClosed, lines };
}

export interface BillingRunHistoryItem {
  id: string;
  ranAt: Date;
  ranByName: string | null;
  asOfDate: Date;
  created: number;
  skipped: number;
  failed: number;
}

export async function listBillingRuns(actor: Actor, limit = 20): Promise<BillingRunHistoryItem[]> {
  assertStaff(actor);
  const runs = await db.billingRun.findMany({
    orderBy: { ranAt: 'desc' },
    take: limit,
    include: { ranBy: { select: { name: true } } },
  });
  return runs.map((r) => ({
    id: r.id,
    ranAt: r.ranAt,
    ranByName: r.ranBy?.name ?? null,
    asOfDate: r.asOfDate,
    created: r.created,
    skipped: r.skipped,
    failed: r.failed,
  }));
}

export async function getBillingRun(actor: Actor, id: string): Promise<BillingRunSummary & { ranAt: Date; ranByName: string | null }> {
  assertStaff(actor);
  const run = await db.billingRun.findUnique({
    where: { id },
    include: { ranBy: { select: { name: true } } },
  });
  if (!run) throw new NotFoundError('Billing run not found.');
  let lines: BillingRunSummaryLine[] = [];
  try {
    const parsed: unknown = JSON.parse(run.details);
    if (Array.isArray(parsed)) lines = parsed as BillingRunSummaryLine[];
  } catch {
    lines = [];
  }
  return {
    runId: run.id,
    asOfDate: run.asOfDate,
    created: run.created,
    skipped: run.skipped,
    failed: run.failed,
    autoClosed: 0,
    lines,
    ranAt: run.ranAt,
    ranByName: run.ranBy?.name ?? null,
  };
}

export function describeBillingDate(date: Date): string {
  return formatDate(date);
}
