import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getInvoice } from '@/services/invoice.service';
import { deletePaymentAction } from '@/actions/invoices';
import { PageHeader } from '@/components/ui/page-header';
import { InvoiceActions } from '@/app/(app)/invoices/invoice-actions';
import { PaymentForm } from '@/app/(app)/invoices/payment-form';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Money } from '@/components/ui/money';
import { InvoiceBadge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { formatDate, formatDateTime, todayUtc, toDateInput } from '@/lib/dates';
import { formatBps } from '@/lib/money';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums';
import { notFound } from 'next/navigation';
import { NotFoundError } from '@/lib/errors';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Invoice' };
export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const { id } = await params;
  const sp = await searchParams;
  let invoice;
  try {
    invoice = await getInvoice(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const notice = str(sp, 'created') ? 'Invoice generated.' : undefined;

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={`Subscription ${invoice.subscriptionNumber} · ${invoice.planName}`}
        actions={<InvoiceActions invoiceId={invoice.id} status={invoice.status} />}
      />
      {notice ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        <Meta label="Status">
          <InvoiceBadge status={invoice.status} overdue={invoice.overdue} />
        </Meta>
        <Meta label="Customer">
          <Link href={`/customers/${invoice.customerId}`} className="text-accent-text hover:underline">
            {invoice.customerName}
          </Link>
        </Meta>
        <Meta label="Issued">{formatDate(invoice.issueDate)}</Meta>
        <Meta label="Due">{formatDate(invoice.dueDate)}</Meta>
        <Meta label="Period">
          {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
        </Meta>
        <Meta label="Sent">{invoice.sentAt ? formatDateTime(invoice.sentAt) : 'Not sent'}</Meta>
      </div>

      <Table className="mb-6">
        <THead>
          <TH>Description</TH>
          <TH align="right">Qty</TH>
          <TH align="right">Unit price</TH>
          <TH align="right">Amount</TH>
          <TH align="right">Discount</TH>
          <TH>Tax</TH>
          <TH align="right">Tax amount</TH>
          <TH align="right">Line total</TH>
        </THead>
        <tbody>
          {invoice.lines.map((line) => (
            <TR key={line.id}>
              <TD className="font-medium text-zinc-900">{line.description}</TD>
              <TD align="right" className="tabular-nums">
                {line.quantity}
              </TD>
              <TD align="right">
                <Money minor={line.unitPrice} />
              </TD>
              <TD align="right">
                <Money minor={line.amount} />
              </TD>
              <TD align="right">
                {line.discountAmount > 0 ? (
                  <Money minor={-line.discountAmount} className="text-amber-700" />
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </TD>
              <TD className="text-zinc-600">
                {line.taxName ? `${line.taxName} (${formatBps(line.taxRateBps)})` : '—'}
              </TD>
              <TD align="right">
                <Money minor={line.taxAmount} muted />
              </TD>
              <TD align="right">
                <Money minor={line.lineTotal} />
              </TD>
            </TR>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 bg-zinc-50 text-sm">
            <td colSpan={3} className="px-3 py-2 text-right text-xs font-medium text-zinc-600">
              Subtotal
            </td>
            <td className="px-3 py-2 text-right font-medium tabular-nums">
              <Money minor={invoice.subtotal} />
            </td>
            <td className="px-3 py-2 text-right font-medium tabular-nums">
              {invoice.discountTotal > 0 ? <Money minor={-invoice.discountTotal} /> : <span className="text-zinc-400">—</span>}
            </td>
            <td />
            <td className="px-3 py-2 text-right font-medium tabular-nums">
              <Money minor={invoice.taxTotal} />
            </td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums">
              <Money minor={invoice.total} />
            </td>
          </tr>
          {invoice.discountTotal > 0 ? (
            <tr className="bg-zinc-50 text-xs text-zinc-600">
              <td colSpan={8} className="px-3 pb-2 text-right">
                Discount applied: {invoice.discountName}
              </td>
            </tr>
          ) : null}
          <tr className="bg-white text-sm">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-medium text-zinc-600">
              Paid
            </td>
            <td colSpan={2} className="px-3 py-2 text-right font-medium tabular-nums">
              <Money minor={invoice.paidTotal} />
            </td>
            <td />
          </tr>
          <tr className="bg-white text-sm">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-zinc-800">
              Outstanding
            </td>
            <td colSpan={2} className="px-3 py-2 text-right font-semibold tabular-nums">
              <Money minor={invoice.outstanding} />
            </td>
            <td />
          </tr>
        </tfoot>
      </Table>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Payments</h2>
        {invoice.payments.length === 0 ? (
          <p className="card-panel px-4 py-6 text-xs text-zinc-500">No payments recorded yet.</p>
        ) : (
          <Table className="mb-4">
            <THead>
              <TH>Date</TH>
              <TH>Method</TH>
              <TH>Note</TH>
              <TH>Recorded by</TH>
              <TH align="right">Amount</TH>
              <TH></TH>
            </THead>
            <tbody>
              {invoice.payments.map((p) => (
                <TR key={p.id}>
                  <TD className="text-zinc-600">{formatDate(p.paidAt)}</TD>
                  <TD className="text-zinc-600">{PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}</TD>
                  <TD className="text-zinc-600">{p.note ?? '—'}</TD>
                  <TD className="text-zinc-600">{p.createdByName ?? '—'}</TD>
                  <TD align="right">
                    <Money minor={p.amount} />
                  </TD>
                  <TD align="right">
                    <ConfirmButton
                      label="Delete"
                      size="sm"
                      variant="ghost"
                      confirmTitle="Delete payment"
                      confirmMessage="Remove this payment record? The invoice totals will be recalculated."
                      onConfirm={deletePaymentAction.bind(null, p.id, invoice.id)}
                    />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        {invoice.status === 'CONFIRMED' && invoice.outstanding > 0 ? (
          <div className="card-panel p-4">
            <h3 className="mb-3 text-xs font-semibold text-zinc-800">Record a payment</h3>
            <PaymentForm invoiceId={invoice.id} outstanding={invoice.outstanding} today={toDateInput(todayUtc())} />
          </div>
        ) : invoice.status === 'PAID' ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            This invoice is fully paid.
          </p>
        ) : null}
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
