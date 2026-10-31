import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getSubscription } from '@/services/subscription.service';
import { PageHeader } from '@/components/ui/page-header';
import { SubscriptionStepper } from '@/components/subscription/stepper';
import { PortalSubscriptionActions } from '@/app/portal/subscriptions/portal-actions';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Money } from '@/components/ui/money';
import { InvoiceBadge } from '@/components/ui/badge';
import { formatDate, toDateInput } from '@/lib/dates';
import { formatBps } from '@/lib/money';
import { notFound } from 'next/navigation';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export const metadata = { title: 'Subscription' };
export const dynamic = 'force-dynamic';

export default async function PortalSubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser('CUSTOMER');
  const { id } = await params;
  let sub;
  try {
    sub = await getSubscription(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) notFound(); // do not reveal other customers' ids
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={sub.number}
        description={`${sub.planName} × ${sub.quantity}`}
        actions={
          sub.status === 'ACTIVE' ? (
            <PortalSubscriptionActions
              subscriptionId={sub.id}
              paused={sub.pausedAt !== null}
              allowPause={sub.planFlags.allowPause}
              allowRenew={sub.planFlags.allowRenew}
              allowEarlyClose={sub.planFlags.allowEarlyClose && toDateInput(sub.endDate) > toDateInput(new Date())}
            />
          ) : undefined
        }
      />

      <div className="card-panel mb-6 px-4 py-3">
        <SubscriptionStepper status={sub.status} paused={sub.pausedAt !== null} />
      </div>

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-5">
        <Meta label="Start">{formatDate(sub.startDate)}</Meta>
        <Meta label="Expiry">{formatDate(sub.endDate)}</Meta>
        <Meta label="Next billing">{sub.status === 'ACTIVE' ? formatDate(sub.nextBillingDate) : '—'}</Meta>
        <Meta label="Payment terms">{sub.paymentTerms}</Meta>
        <Meta label="Period total">
          <Money minor={sub.total} />
        </Meta>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Lines</h2>
        <Table>
          <THead>
            <TH>Description</TH>
            <TH align="right">Qty</TH>
            <TH align="right">Unit price</TH>
            <TH>Tax</TH>
            <TH align="right">Amount</TH>
          </THead>
          <tbody>
            {sub.lines.map((line) => (
              <TR key={line.id}>
                <TD className="font-medium text-zinc-900">{line.description}</TD>
                <TD align="right" className="tabular-nums">
                  {line.quantity}
                </TD>
                <TD align="right">
                  <Money minor={line.unitPrice} />
                </TD>
                <TD className="text-zinc-600">
                  {line.taxName ? `${line.taxName} (${formatBps(line.taxRateBps ?? 0)})` : '—'}
                </TD>
                <TD align="right">
                  <Money minor={line.amount} />
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Invoices</h2>
        {sub.invoices.length === 0 ? (
          <p className="card-panel px-4 py-6 text-xs text-zinc-500">No invoices for this subscription yet.</p>
        ) : (
          <Table>
            <THead>
              <TH>Invoice</TH>
              <TH>Status</TH>
              <TH>Period</TH>
              <TH>Due</TH>
              <TH align="right">Total</TH>
            </THead>
            <tbody>
              {sub.invoices.map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    <Link href={`/portal/invoices/${inv.id}`} className="font-medium text-accent-text hover:underline">
                      {inv.number}
                    </Link>
                  </TD>
                  <TD>
                    <InvoiceBadge
                      status={inv.status as 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED'}
                      overdue={inv.status === 'CONFIRMED' && inv.dueDate.getTime() < Date.now() && inv.paidTotal < inv.total}
                    />
                  </TD>
                  <TD className="text-xs text-zinc-600">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                  </TD>
                  <TD className="text-zinc-600">{formatDate(inv.dueDate)}</TD>
                  <TD align="right">
                    <Money minor={inv.total} />
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

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-2xs uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1 truncate text-sm text-zinc-800">{children}</div>
    </div>
  );
}
