import Link from 'next/link';
import { Printer } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getInvoice } from '@/services/invoice.service';
import { getInvoicePayments } from '@/services/payment.service';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Money } from '@/components/ui/money';
import { InvoiceBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';
import { formatBps } from '@/lib/money';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums';
import { notFound } from 'next/navigation';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export const metadata = { title: 'Invoice' };
export const dynamic = 'force-dynamic';

export default async function PortalInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser('CUSTOMER');
  const { id } = await params;
  let invoice;
  try {
    invoice = await getInvoice(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }
  const ownPayments = await getInvoicePayments(actor, invoice.id);

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={`Subscription ${invoice.subscriptionNumber} · ${invoice.planName}`}
        actions={
          <a
            href={`/print/invoices/${invoice.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </a>
        }
      />

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-5">
        <Meta label="Status">
          <InvoiceBadge status={invoice.status} overdue={invoice.overdue} />
        </Meta>
        <Meta label="Issued">{formatDate(invoice.issueDate)}</Meta>
        <Meta label="Due">{formatDate(invoice.dueDate)}</Meta>
        <Meta label="Total">
          <Money minor={invoice.total} />
        </Meta>
        <Meta label="Outstanding">
          <Money minor={invoice.outstanding} />
        </Meta>
      </div>

      <Table className="mb-6">
        <THead>
          <TH>Description</TH>
          <TH align="right">Qty</TH>
          <TH align="right">Unit price</TH>
          <TH>Tax</TH>
          <TH align="right">Discount</TH>
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
              <TD className="text-zinc-600">
                {line.taxName ? `${line.taxName} (${formatBps(line.taxRateBps)})` : '—'}
              </TD>
              <TD align="right">
                {line.discountAmount > 0 ? <Money minor={-line.discountAmount} /> : <span className="text-zinc-400">—</span>}
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
            <td className="px-3 py-2 text-right font-semibold tabular-nums">
              <Money minor={invoice.total} />
            </td>
          </tr>
        </tfoot>
      </Table>

      {invoice.discountName ? (
        <p className="mb-4 text-xs text-zinc-600">Discount applied: {invoice.discountName}</p>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Payments</h2>
        {ownPayments.length === 0 ? (
          <p className="card-panel px-4 py-6 text-xs text-zinc-500">
            No payments recorded. Payments are recorded by the Brightloop billing team.
          </p>
        ) : (
          <Table>
            <THead>
              <TH>Date</TH>
              <TH>Method</TH>
              <TH align="right">Amount</TH>
            </THead>
            <tbody>
              {ownPayments.map((p) => (
                <TR key={p.id}>
                  <TD className="text-zinc-600">{formatDate(p.paidAt)}</TD>
                  <TD className="text-zinc-600">{PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}</TD>
                  <TD align="right">
                    <Money minor={p.amount} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-2xs text-zinc-500">
          Questions about this invoice? Reply to the email in your inbox or contact billing@brightloop.example.{' '}
          <Link href="/portal" className="text-accent-text hover:underline">
            Back to overview
          </Link>
        </p>
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
