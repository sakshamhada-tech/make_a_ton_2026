import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listCustomers } from '@/services/customer.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { StatusBadge } from '@/components/ui/badge';
import { FilterBar, FilterText } from '@/components/ui/filter-bar';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'name', defaultDir: 'asc' });
  const filters = { q: str(params, 'q') };
  const { items, meta } = await listCustomers(actor, listParams, filters);
  const query = { q: str(params, 'q'), sort: listParams.sort, dir: listParams.dir };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Billing accounts with portal access."
        actions={
          <ButtonLink href="/customers/new" variant="primary">
            New customer
          </ButtonLink>
        }
      />

      <FilterBar action="/customers" resetHref="/customers">
        <FilterText label="Search" name="q" value={filters.q} placeholder="Name or email" />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="Create a customer before recording subscriptions."
          action={<ButtonLink href="/customers/new" variant="primary">New customer</ButtonLink>}
        />
      ) : (
        <>
          <Table>
            <THead>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Name" field="name" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/customers" query={query} />
              </th>
              <TH>Email</TH>
              <TH>Location</TH>
              <TH>Portal</TH>
              <TH align="right">Subscriptions</TH>
              <TH align="right">Outstanding</TH>
            </THead>
            <tbody>
              {items.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/customers/${c.id}`} className="font-medium text-accent-text hover:underline">
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{c.email}</TD>
                  <TD className="text-zinc-600">
                    {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                  </TD>
                  <TD>
                    <StatusBadge label={c.hasPortalLogin ? 'Enabled' : 'None'} tone={c.hasPortalLogin ? 'emerald' : 'zinc'} />
                  </TD>
                  <TD align="right" className="tabular-nums text-zinc-600">
                    {c.subscriptionCount}
                  </TD>
                  <TD align="right">
                    {c.outstandingMinor > 0 ? <Money minor={c.outstandingMinor} /> : <span className="text-zinc-400">—</span>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/customers" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
