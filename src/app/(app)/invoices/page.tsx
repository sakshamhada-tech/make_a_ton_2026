import Link from 'next/link';
import { Download } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listInvoices } from '@/services/invoice.service';
import { listPlansForSelection } from '@/services/plan.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { InvoiceBadge } from '@/components/ui/badge';
import { FilterBar, FilterDate, FilterSelect, FilterText } from '@/components/ui/filter-bar';
import { formatDate, todayUtc } from '@/lib/dates';

export const metadata = { title: 'Invoices' };
export const dynamic = 'force-dynamic';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'issueDate', defaultDir: 'desc' });
  const filters = {
    q: str(params, 'q'),
    status: str(params, 'status'),
    planId: str(params, 'planId'),
    overdue: str(params, 'overdue'),
    from: str(params, 'from') ? new Date(`${str(params, 'from')}T00:00:00.000Z`) : null,
    to: str(params, 'to') ? new Date(`${str(params, 'to')}T00:00:00.000Z`) : null,
  };
  const [{ items, meta }, plans] = await Promise.all([
    listInvoices(actor, listParams, filters),
    listPlansForSelection(actor, todayUtc()),
  ]);
  const query = {
    q: str(params, 'q'),
    status: str(params, 'status'),
    planId: str(params, 'planId'),
    overdue: str(params, 'overdue'),
    from: str(params, 'from'),
    to: str(params, 'to'),
    sort: listParams.sort,
    dir: listParams.dir,
  };
  const exportQuery = new URLSearchParams({
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.planId ? { planId: filters.planId } : {}),
    ...(str(params, 'from') ? { from: str(params, 'from') as string } : {}),
    ...(str(params, 'to') ? { to: str(params, 'to') as string } : {}),
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Generated from subscriptions. Confirm, send, record payments."
        actions={
          <a
            href={`/api/export/invoices?${exportQuery.toString()}`}
            className="inline-flex h-9 items-center gap-1.5 rounded border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        }
      />

      <FilterBar action="/invoices" resetHref="/invoices">
        <FilterText label="Search" name="q" value={str(params, 'q')} placeholder="Invoice or customer" />
        <FilterSelect
          label="Status"
          name="status"
          value={str(params, 'status')}
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'CONFIRMED', label: 'Confirmed' },
            { value: 'PAID', label: 'Paid' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
        <FilterSelect
          label="Plan"
          name="planId"
          value={str(params, 'planId')}
          options={plans.map((p) => ({ value: p.id, label: p.name }))}
        />
        <FilterSelect
          label="Overdue"
          name="overdue"
          value={str(params, 'overdue')}
          options={[{ value: 'overdue', label: 'Overdue only' }]}
        />
        <FilterDate label="Issued from" name="from" value={str(params, 'from')} />
        <FilterDate label="Issued to" name="to" value={str(params, 'to')} />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description={filters.overdue === 'overdue' ? 'No overdue invoices.' : 'Adjust the filters or run billing.'}
          action={
            <Link href="/billing" className="inline-flex h-9 items-center rounded bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-hover">
              Run billing
            </Link>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Number" field="number" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/invoices" query={query} />
              </th>
              <TH>Customer</TH>
              <TH>Subscription</TH>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Issued" field="issueDate" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/invoices" query={query} />
              </th>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Due" field="dueDate" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/invoices" query={query} />
              </th>
              <TH>Status</TH>
              <th scope="col" className="group px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Total" field="total" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/invoices" query={query} align="right" />
              </th>
              <TH align="right">Outstanding</TH>
            </THead>
            <tbody>
              {items.map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-accent-text hover:underline">
                      {inv.number}
                    </Link>
                  </TD>
                  <TD className="text-zinc-700">{inv.customerName}</TD>
                  <TD className="text-zinc-600">
                    <Link href={`/subscriptions/${inv.subscriptionId}`} className="hover:underline">
                      {inv.subscriptionNumber}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{formatDate(inv.issueDate)}</TD>
                  <TD className="text-zinc-600">{formatDate(inv.dueDate)}</TD>
                  <TD>
                    <InvoiceBadge status={inv.status} overdue={inv.overdue} />
                  </TD>
                  <TD align="right">
                    <Money minor={inv.total} />
                  </TD>
                  <TD align="right">
                    {inv.outstanding > 0 ? <Money minor={inv.outstanding} /> : <span className="text-zinc-400">—</span>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/invoices" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
