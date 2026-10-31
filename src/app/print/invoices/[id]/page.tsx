import { requireUser } from '@/lib/auth';
import { getInvoice } from '@/services/invoice.service';
import { formatDate } from '@/lib/dates';
import { formatBps, formatMoney } from '@/lib/money';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums';
import { PrintButton } from '@/components/print-button';
import { notFound } from 'next/navigation';
import { NotFoundError } from '@/lib/errors';

export const metadata = { title: 'Print invoice' };
export const dynamic = 'force-dynamic';

/** PDF-ready invoice view: minimal chrome, print stylesheet applied. */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser('ADMIN', 'STAFF', 'CUSTOMER');
  const { id } = await params;
  let invoice;
  try {
    invoice = await getInvoice(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="no-print mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs text-zinc-600">Print-ready view for invoice {invoice.number}.</p>
        <div className="flex gap-2">
          <PrintButton />
          <a
            href={`/invoices/${invoice.id}`}
            className="inline-flex h-8 items-center rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Back to invoice
          </a>
        </div>
      </div>

      <article className="mx-auto max-w-3xl bg-white px-10 py-10 shadow-sm print:max-w-none print:shadow-none">
        <header className="flex items-start justify-between border-b border-zinc-200 pb-6">
          <div>
            <p className="text-lg font-bold text-zinc-900">Brightloop Software</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Brightloop Software Pvt Ltd
              <br />
              4th Floor, Prestige Atrium, Bengaluru 560001
              <br />
              Karnataka, India · GSTIN 29AABCB1429P1ZX
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-zinc-900">Invoice</p>
            <p className="mt-1 text-sm font-medium text-zinc-700">{invoice.number}</p>
            <p className="mt-2 text-xs text-zinc-600">Issued: {formatDate(invoice.issueDate)}</p>
            <p className="text-xs text-zinc-600">Due: {formatDate(invoice.dueDate)}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{invoice.statusLabel}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wide text-zinc-500">Bill to</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{invoice.customerName}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
              {invoice.customerAddress ? (
                <>
                  {invoice.customerAddress}
                  <br />
                </>
              ) : null}
              {[invoice.customerCity, invoice.customerState, invoice.customerPostalCode].filter(Boolean).join(', ')}
              <br />
              {invoice.customerCountry}
              <br />
              {invoice.customerGstin ? <>GSTIN: {invoice.customerGstin}</> : null}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-600">
            <p>
              Subscription: <span className="font-medium text-zinc-800">{invoice.subscriptionNumber}</span>
            </p>
            <p>
              Plan: <span className="font-medium text-zinc-800">{invoice.planName}</span>
            </p>
            <p className="mt-1">
              Billing period: {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
            </p>
            <p>Payment terms: {invoice.paymentTerms}</p>
          </div>
        </section>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-zinc-300 text-left text-2xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-2 font-semibold">Description</th>
              <th className="py-2 px-2 text-right font-semibold">Qty</th>
              <th className="py-2 px-2 text-right font-semibold">Unit</th>
              <th className="py-2 px-2 text-right font-semibold">Amount</th>
              <th className="py-2 px-2 text-right font-semibold">Discount</th>
              <th className="py-2 px-2 text-right font-semibold">Tax</th>
              <th className="py-2 pl-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-zinc-100 align-top">
                <td className="py-2 pr-2 text-zinc-800">{line.description}</td>
                <td className="py-2 px-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatMoney(line.amount)}</td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {line.discountAmount > 0 ? `-${formatMoney(line.discountAmount)}` : '—'}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {line.taxRateBps > 0 ? `${formatBps(line.taxRateBps)} (${formatMoney(line.taxAmount)})` : '—'}
                </td>
                <td className="py-2 pl-2 text-right font-medium tabular-nums">{formatMoney(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 flex justify-end">
          <dl className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-zinc-600">Subtotal</dt>
              <dd className="tabular-nums text-zinc-900">{formatMoney(invoice.subtotal)}</dd>
            </div>
            {invoice.discountTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-zinc-600">Discount {invoice.discountName ? `(${invoice.discountName})` : ''}</dt>
                <dd className="tabular-nums text-zinc-900">−{formatMoney(invoice.discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-zinc-600">Tax</dt>
              <dd className="tabular-nums text-zinc-900">{formatMoney(invoice.taxTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-1.5 text-sm font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(invoice.total)}</dd>
            </div>
            <div className="flex justify-between text-zinc-600">
              <dt>Paid</dt>
              <dd className="tabular-nums">{formatMoney(invoice.paidTotal)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Outstanding</dt>
              <dd className="tabular-nums">{formatMoney(invoice.outstanding)}</dd>
            </div>
          </dl>
        </section>

        {invoice.payments.length > 0 ? (
          <section className="mt-8 border-t border-zinc-200 pt-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-zinc-500">Payments received</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-700">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex justify-between tabular-nums">
                  <span>
                    {formatDate(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                  </span>
                  <span>{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="mt-10 border-t border-zinc-200 pt-4 text-2xs text-zinc-500">
          <p>
            This invoice was generated by Brightloop Billing for subscription {invoice.subscriptionNumber}.{' '}
            {invoice.sentAt ? `Sent on ${formatDate(invoice.sentAt)}.` : ''}
          </p>
        </footer>
      </article>
    </div>
  );
}
