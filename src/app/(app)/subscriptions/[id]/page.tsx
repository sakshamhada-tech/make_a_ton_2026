import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getSubscription } from '@/services/subscription.service';
import { listProducts } from '@/services/product.service';
import { removeSubscriptionLineAction } from '@/actions/subscriptions';
import { generateInvoiceAction } from '@/actions/subscriptions';
import { PageHeader } from '@/components/ui/page-header';
import { SubscriptionStepper } from '@/components/subscription/stepper';
import {
  AddLineForm,
  SubscriptionActions,
  SubscriptionEditForm,
} from '@/app/(app)/subscriptions/subscription-actions';
import { ActionButton } from '@/components/ui/action-button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Money } from '@/components/ui/money';
import { InvoiceBadge } from '@/components/ui/badge';
import { formatDate, formatDateTime, toDateInput } from '@/lib/dates';
import { formatBps } from '@/lib/money';
import { PERIOD_LABELS, type BillingPeriod } from '@/lib/enums';
import { notFound } from 'next/navigation';
import { NotFoundError } from '@/lib/errors';
import { str, type SearchParams } from '@/lib/http';
import { db } from '@/lib/db';

export const metadata = { title: 'Subscription' };
export const dynamic = 'force-dynamic';

export default async function SubscriptionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const { id } = await params;
  const sp = await searchParams;
  let sub;
  try {
    sub = await getSubscription(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const isDraft = sub.status === 'DRAFT';
  const canGenerateInvoice =
    (sub.status === 'ACTIVE' || sub.status === 'CONFIRMED') && sub.nextBillingDate !== null;

  const products = isDraft
    ? await listProducts(actor, { page: 1, pageSize: 100, sort: 'name', dir: 'asc' }, { status: 'active' })
    : { items: [] };
  const productDetails = await Promise.all(
    products.items.map(async (p) => {
      const [variants, taxes] = await Promise.all([
        db.variantOption.findMany({ where: { productId: p.id } }),
        db.tax.findMany({ where: { isActive: true } }),
      ]);
      return {
        id: p.id,
        name: p.name,
        variants: variants.map((v) => ({ id: v.id, label: `${v.attribute}: ${v.value}` })),
        taxes: taxes.map((t) => ({ id: t.id, label: `${t.name} (${formatBps(t.rateBps)})` })),
      };
    }),
  );

  const notices: string[] = [];
  if (str(sp, 'created')) notices.push('Subscription created as draft.');
  if (str(sp, 'saved')) notices.push('Subscription updated.');
  if (str(sp, 'lineAdded')) notices.push('Product line added.');

  return (
    <div>
      <PageHeader
        title={sub.number}
        description={`${sub.planName} × ${sub.quantity} · ${PERIOD_LABELS[sub.planPeriod as BillingPeriod] ?? sub.planPeriod}`}
        actions={
          <SubscriptionActions
            subscriptionId={sub.id}
            status={sub.status}
            allowedTransitions={sub.allowedTransitions}
            planFlags={sub.planFlags}
            endDate={toDateInput(sub.endDate)}
            paused={sub.pausedAt !== null}
          />
        }
      />

      {notices.map((n) => (
        <p key={n} className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {n}
        </p>
      ))}

      <div className="card-panel mb-6 px-4 py-3">
        <SubscriptionStepper status={sub.status} paused={sub.pausedAt !== null} />
      </div>

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        <Meta label="Customer">
          <Link href={`/customers/${sub.customerId}`} className="text-accent-text hover:underline">
            {sub.customerName}
          </Link>
        </Meta>
        <Meta label="Start">{formatDate(sub.startDate)}</Meta>
        <Meta label="Expiry">{formatDate(sub.endDate)}</Meta>
        <Meta label="Next billing">{sub.status === 'ACTIVE' ? formatDate(sub.nextBillingDate) : '—'}</Meta>
        <Meta label="Payment terms">{sub.paymentTerms}</Meta>
        <Meta label="Quote expires">{sub.quoteExpiresAt ? formatDate(sub.quoteExpiresAt) : '—'}</Meta>
      </div>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Lines</h2>
          {isDraft ? <p className="text-2xs text-zinc-500">Draft: lines and totals can be edited.</p> : null}
        </div>
        <Table>
          <THead>
            <TH>Description</TH>
            <TH align="right">Qty</TH>
            <TH align="right">Unit price</TH>
            <TH>Tax</TH>
            <TH align="right">Amount</TH>
            <TH align="right">Tax amount</TH>
            {isDraft ? <TH></TH> : null}
          </THead>
          <tbody>
            {sub.lines.map((line) => (
              <TR key={line.id}>
                <TD>
                  <span className="font-medium text-zinc-900">{line.description}</span>
                  <span className="ml-2 text-2xs uppercase tracking-wide text-zinc-400">{line.kind.toLowerCase()}</span>
                </TD>
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
                <TD align="right">
                  <Money minor={line.taxAmount} muted />
                </TD>
                {isDraft ? (
                  <TD align="right">
                    {line.kind === 'PRODUCT' ? (
                      <ConfirmButton
                        label="Remove"
                        size="sm"
                        variant="ghost"
                        confirmTitle="Remove line"
                        confirmMessage={`Remove “${line.description}” from this draft?`}
                        onConfirm={removeSubscriptionLineAction.bind(null, sub.id, line.id)}
                      />
                    ) : null}
                  </TD>
                ) : null}
              </TR>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50 text-sm">
              <td colSpan={4} className="px-3 py-2 text-right text-xs font-medium text-zinc-600">
                Subtotal
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                <Money minor={sub.subtotal} />
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                <Money minor={sub.taxTotal} />
              </td>
              {isDraft ? <td /> : null}
            </tr>
            <tr className="bg-zinc-50 text-sm">
              <td colSpan={4} className="px-3 py-2 text-right text-xs font-medium text-zinc-600">
                Period total (before discount)
              </td>
              <td colSpan={2} className="px-3 py-2 text-right font-semibold tabular-nums">
                <Money minor={sub.total} />
              </td>
              {isDraft ? <td /> : null}
            </tr>
          </tfoot>
        </Table>
        <p className="mt-1.5 text-2xs text-zinc-500">
          Discounts, where eligible, are applied on generated invoices.
        </p>
      </section>

      {isDraft ? (
        <section className="card-panel mb-6 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Edit draft</h2>
          <SubscriptionEditForm
            subscriptionId={sub.id}
            initial={{
              paymentTerms: sub.paymentTerms,
              startDate: toDateInput(sub.startDate),
              endDate: toDateInput(sub.endDate),
              quantity: String(sub.quantity),
            }}
          />
          <h3 className="mb-2 mt-5 text-xs font-semibold text-zinc-700">Add product line</h3>
          <AddLineForm subscriptionId={sub.id} products={productDetails} />
        </section>
      ) : null}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Invoices</h2>
          {canGenerateInvoice ? (
            <ActionButton
              label="Generate invoice"
              variant="primary"
              size="sm"
              action={generateInvoiceAction.bind(null, sub.id)}
            />
          ) : null}
        </div>
        {sub.invoices.length === 0 ? (
          <p className="card-panel px-4 py-6 text-xs text-zinc-500">
            No invoices yet. Invoices are generated by billing runs or the “Generate invoice” action.
          </p>
        ) : (
          <Table>
            <THead>
              <TH>Number</TH>
              <TH>Status</TH>
              <TH>Period</TH>
              <TH>Due</TH>
              <TH align="right">Total</TH>
              <TH align="right">Paid</TH>
              <TH>Sent</TH>
            </THead>
            <tbody>
              {sub.invoices.map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-accent-text hover:underline">
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
                  <TD align="right">
                    <Money minor={inv.paidTotal} muted />
                  </TD>
                  <TD className="text-2xs text-zinc-500">{inv.sentAt ? formatDateTime(inv.sentAt) : 'Not sent'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Status history</h2>
        <ol className="card-panel divide-y divide-zinc-100">
          {sub.history.map((h) => (
            <li key={h.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-xs">
              <div>
                <span className="font-medium text-zinc-800">
                  {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created as ${h.toStatus.toLowerCase()}`}
                </span>
                {h.note ? <span className="ml-2 text-zinc-500">— {h.note}</span> : null}
              </div>
              <div className="shrink-0 text-right text-zinc-500">
                <span>{h.userName ?? 'System'}</span>
                <span className="ml-2">{formatDateTime(h.createdAt)}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-2xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm text-zinc-800">{children}</p>
    </div>
  );
}
