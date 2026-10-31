import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Money } from '@/components/ui/money';
import { SubscriptionBadge, InvoiceBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';
import type { SubscriptionStatus, InvoiceStatus } from '@/lib/enums';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: 'Portal overview' };
export const dynamic = 'force-dynamic';

export default async function PortalOverviewPage() {
  const actor = await requireUser('CUSTOMER');
  const customerId = actor.customerId ?? '__none__';
  const [customer, activeSubs, upcoming, recentInvoices, outstandingAgg] = await Promise.all([
    db.customer.findUnique({ where: { id: customerId } }),
    db.subscription.count({ where: { customerId, status: 'ACTIVE' } }),
    db.subscription.findMany({
      where: { customerId, status: 'ACTIVE' },
      orderBy: { nextBillingDate: 'asc' },
      take: 5,
      include: { plan: { select: { name: true } } },
    }),
    db.invoice.findMany({
      where: { customerId },
      orderBy: { issueDate: 'desc' },
      take: 5,
      include: { subscription: { select: { number: true } } },
    }),
    db.invoice.aggregate({
      where: { customerId, status: 'CONFIRMED' },
      _sum: { total: true, paidTotal: true },
    }),
  ]);

  const outstanding = (outstandingAgg._sum.total ?? 0) - (outstandingAgg._sum.paidTotal ?? 0);

  return (
    <div>
      <PageHeader
        title={customer ? customer.name : 'Overview'}
        description="Your subscriptions and invoices with Brightloop Software."
      />

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Active subscriptions</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{activeSubs}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Outstanding balance</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${outstanding > 0 ? 'text-red-700' : ''}`}>
            <Money minor={outstanding} />
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Billing contact</p>
          <p className="mt-1 truncate text-sm">{customer?.email ?? actor.email}</p>
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Upcoming billing</h2>
          <Link href="/portal/subscriptions" className="text-xs text-accent-text hover:underline">
            All subscriptions
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState title="No active subscriptions" description="Contact Brightloop to set up a subscription." />
        ) : (
          <Table>
            <THead>
              <TH>Subscription</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>Next billing</TH>
              <TH align="right">Amount</TH>
            </THead>
            <tbody>
              {upcoming.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/portal/subscriptions/${s.id}`} className="font-medium text-accent-text hover:underline">
                      {s.number}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{s.plan.name}</TD>
                  <TD>
                    <SubscriptionBadge status={s.status as SubscriptionStatus} paused={s.pausedAt !== null} />
                  </TD>
                  <TD className="text-zinc-600">{formatDate(s.nextBillingDate)}</TD>
                  <TD align="right">
                    <Money minor={s.total} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Recent invoices</h2>
          <Link href="/portal/invoices" className="text-xs text-accent-text hover:underline">
            All invoices
          </Link>
        </div>
        {recentInvoices.length === 0 ? (
          <EmptyState title="No invoices yet" description="Invoices appear here once your subscription is billed." />
        ) : (
          <Table>
            <THead>
              <TH>Invoice</TH>
              <TH>Subscription</TH>
              <TH>Issued</TH>
              <TH>Status</TH>
              <TH align="right">Total</TH>
            </THead>
            <tbody>
              {recentInvoices.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <Link href={`/portal/invoices/${i.id}`} className="font-medium text-accent-text hover:underline">
                      {i.number}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{i.subscription.number}</TD>
                  <TD className="text-zinc-600">{formatDate(i.issueDate)}</TD>
                  <TD>
                    <InvoiceBadge status={i.status as InvoiceStatus} />
                  </TD>
                  <TD align="right">
                    <Money minor={i.total} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
