import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listInvoices } from '@/services/invoice.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { InvoiceBadge } from '@/components/ui/badge';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { formatDate } from '@/lib/dates';
import { INVOICE_STATUS_LABELS } from '@/lib/enums';

export const metadata = { title: 'My invoices' };
export const dynamic = 'force-dynamic';

export default async function PortalInvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('CUSTOMER');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'issueDate', defaultDir: 'desc' });
  const filters = {
    status: str(params, 'status'),
    overdue: str(params, 'overdue'),
  };
  const { items, meta } = await listInvoices(actor, listParams, filters);
  const query = { status: str(params, 'status'), overdue: str(params, 'overdue') };

  return (
    <div>
      <PageHeader title="My invoices" description="View, print and check payment status." />

      <FilterBar action="/portal/invoices" resetHref="/portal/invoices">
        <FilterSelect
          label="Status"
          name="status"
          value={str(params, 'status')}
          options={Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          label="Payment"
          name="overdue"
          value={str(params, 'overdue')}
          options={[{ value: 'overdue', label: 'Overdue only' }]}
        />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description={filters.overdue === 'overdue' ? 'No overdue invoices.' : 'Invoices appear here after billing.'}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Invoice</TH>
              <TH>Subscription</TH>
              <TH>Issued</TH>
              <TH>Due</TH>
              <TH>Status</TH>
              <TH align="right">Total</TH>
              <TH align="right">Outstanding</TH>
            </THead>
            <tbody>
              {items.map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    <Link href={`/portal/invoices/${inv.id}`} className="font-medium text-accent-text hover:underline">
                      {inv.number}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{inv.subscriptionNumber}</TD>
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
            <Pagination meta={meta} basePath="/portal/invoices" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
