import Link from 'next/link';
import { Download } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listPayments } from '@/services/payment.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { FilterBar, FilterDate, FilterSelect, FilterText } from '@/components/ui/filter-bar';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums';

export const metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'paidAt', defaultDir: 'desc' });
  const filters = {
    q: str(params, 'q'),
    method: str(params, 'method'),
    from: str(params, 'from') ? new Date(`${str(params, 'from')}T00:00:00.000Z`) : null,
    to: str(params, 'to') ? new Date(`${str(params, 'to')}T00:00:00.000Z`) : null,
  };
  const { items, meta } = await listPayments(actor, listParams, filters);
  const query = { q: str(params, 'q'), method: str(params, 'method'), from: str(params, 'from'), to: str(params, 'to') };
  const total = items.reduce((sum, p) => sum + p.amount, 0);
  const exportQuery = new URLSearchParams({
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(str(params, 'from') ? { from: str(params, 'from') as string } : {}),
    ...(str(params, 'to') ? { to: str(params, 'to') as string } : {}),
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        description="All recorded payments across invoices."
        actions={
          <a
            href={`/api/export/payments?${exportQuery.toString()}`}
            className="inline-flex h-9 items-center gap-1.5 rounded border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        }
      />

      <FilterBar action="/payments" resetHref="/payments">
        <FilterText label="Search" name="q" value={str(params, 'q')} placeholder="Invoice or customer" />
        <FilterSelect
          label="Method"
          name="method"
          value={str(params, 'method')}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m as PaymentMethod] }))}
        />
        <FilterDate label="From" name="from" value={str(params, 'from')} />
        <FilterDate label="To" name="to" value={str(params, 'to')} />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState title="No payments found" description="Record payments from an invoice page." />
      ) : (
        <>
          <div className="mb-3 text-xs text-zinc-600">
            {meta.total} payments on this page ·{' '}
            <span className="font-medium tabular-nums">{formatMoney(total)}</span> shown
          </div>
          <Table>
            <THead>
              <TH>Date</TH>
              <TH>Invoice</TH>
              <TH>Customer</TH>
              <TH>Method</TH>
              <TH>Note</TH>
              <TH>Recorded by</TH>
              <TH align="right">Amount</TH>
            </THead>
            <tbody>
              {items.map((p) => (
                <TR key={p.id}>
                  <TD className="text-zinc-600">{formatDate(p.paidAt)}</TD>
                  <TD>
                    <Link href={`/invoices/${p.invoiceId}`} className="font-medium text-accent-text hover:underline">
                      {p.invoiceNumber}
                    </Link>
                  </TD>
                  <TD className="text-zinc-700">{p.customerName}</TD>
                  <TD className="text-zinc-600">{p.methodLabel}</TD>
                  <TD className="text-zinc-600">{p.note ?? '—'}</TD>
                  <TD className="text-zinc-600">{p.createdByName ?? '—'}</TD>
                  <TD align="right">
                    <Money minor={p.amount} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/payments" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
