import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listPlans } from '@/services/plan.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { StatusBadge } from '@/components/ui/badge';
import { FilterBar, FilterSelect, FilterText } from '@/components/ui/filter-bar';
import { formatDate } from '@/lib/dates';
import { BILLING_PERIODS, PERIOD_LABELS, type BillingPeriod } from '@/lib/enums';

export const metadata = { title: 'Plans' };
export const dynamic = 'force-dynamic';

export default async function PlansPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'name', defaultDir: 'asc' });
  const filters = { q: str(params, 'q'), period: str(params, 'period'), status: str(params, 'status') };
  const { items, meta } = await listPlans(actor, listParams, filters);
  const canEdit = actor.role === 'ADMIN';
  const query = { ...filters, page: undefined, sort: listParams.sort, dir: listParams.dir };

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Recurring plans with billing periods and subscription rules."
        actions={
          canEdit ? (
            <ButtonLink href="/plans/new" variant="primary">
              New plan
            </ButtonLink>
          ) : undefined
        }
      />

      <FilterBar action="/plans" resetHref="/plans">
        <FilterText label="Search" name="q" value={filters.q} placeholder="Plan name" />
        <FilterSelect
          label="Period"
          name="period"
          value={filters.period}
          options={BILLING_PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p as BillingPeriod] }))}
        />
        <FilterSelect
          label="Status"
          name="status"
          value={filters.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState title="No plans found" description="Adjust the filters or create a plan." />
      ) : (
        <>
          <Table>
            <THead>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Name" field="name" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/plans" query={query} />
              </th>
              <TH>Period</TH>
              <th scope="col" className="group px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Price" field="price" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/plans" query={query} align="right" />
              </th>
              <TH align="right">Min qty</TH>
              <TH>Available</TH>
              <TH>Rules</TH>
              <TH align="right">Subs</TH>
              <TH>Status</TH>
            </THead>
            <tbody>
              {items.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/plans/${p.id}`} className="font-medium text-accent-text hover:underline">
                      {p.name}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{PERIOD_LABELS[p.period as BillingPeriod] ?? p.period}</TD>
                  <TD align="right">
                    <Money minor={p.price} />
                  </TD>
                  <TD align="right" className="tabular-nums text-zinc-600">
                    {p.minQuantity}
                  </TD>
                  <TD className="text-xs text-zinc-600">
                    {formatDate(p.availableFrom)}
                    {p.availableTo ? ` – ${formatDate(p.availableTo)}` : ''}
                  </TD>
                  <TD>
                    <span className="flex flex-wrap gap-1 text-2xs text-zinc-500">
                      {p.autoClose ? <span className="rounded bg-zinc-100 px-1 py-0.5">Auto-close</span> : null}
                      {p.allowEarlyClose ? <span className="rounded bg-zinc-100 px-1 py-0.5">Early close</span> : null}
                      {p.allowPause ? <span className="rounded bg-zinc-100 px-1 py-0.5">Pause</span> : null}
                      {p.allowRenew ? <span className="rounded bg-zinc-100 px-1 py-0.5">Renew</span> : null}
                    </span>
                  </TD>
                  <TD align="right" className="tabular-nums text-zinc-600">
                    {p.subscriptionCount}
                  </TD>
                  <TD>
                    <StatusBadge label={p.isActive ? 'Active' : 'Inactive'} tone={p.isActive ? 'emerald' : 'zinc'} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/plans" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
