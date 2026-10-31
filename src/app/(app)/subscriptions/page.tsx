import Link from 'next/link';
import { Download } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listSubscriptions } from '@/services/subscription.service';
import { listPlansForSelection } from '@/services/plan.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { SubscriptionBadge } from '@/components/ui/badge';
import { FilterBar, FilterSelect, FilterText } from '@/components/ui/filter-bar';
import { formatDate, todayUtc } from '@/lib/dates';
import { PERIOD_LABELS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUSES, type BillingPeriod } from '@/lib/enums';

export const metadata = { title: 'Subscriptions' };
export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'createdAt', defaultDir: 'desc' });
  const filters = {
    q: str(params, 'q'),
    status: str(params, 'status'),
    planId: str(params, 'planId'),
    paused: str(params, 'paused'),
  };
  const [{ items, meta }, plans] = await Promise.all([
    listSubscriptions(actor, listParams, filters),
    listPlansForSelection(actor, todayUtc()),
  ]);
  const query = { ...filters, page: undefined, sort: listParams.sort, dir: listParams.dir };
  const notice = str(params, 'deleted') ? 'Draft subscription deleted.' : undefined;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Draft → quotation → confirmed → active → closed."
        actions={
          <>
            <a
              href={`/api/export/subscriptions?${new URLSearchParams({
                ...(filters.q ? { q: filters.q } : {}),
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.planId ? { planId: filters.planId } : {}),
              }).toString()}`}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
            <ButtonLink href="/subscriptions/new" variant="primary">
              New subscription
            </ButtonLink>
          </>
        }
      />
      {notice ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      <FilterBar action="/subscriptions" resetHref="/subscriptions">
        <FilterText label="Search" name="q" value={filters.q} placeholder="Number or customer" />
        <FilterSelect
          label="Status"
          name="status"
          value={filters.status}
          options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))}
        />
        <FilterSelect
          label="Plan"
          name="planId"
          value={filters.planId}
          options={plans.map((p) => ({ value: p.id, label: p.name }))}
        />
        <FilterSelect
          label="Pause"
          name="paused"
          value={filters.paused}
          options={[
            { value: 'paused', label: 'Paused' },
            { value: 'active', label: 'Not paused' },
          ]}
        />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          title="No subscriptions found"
          description="Adjust the filters or create a subscription from a template."
          action={<ButtonLink href="/subscriptions/new" variant="primary">New subscription</ButtonLink>}
        />
      ) : (
        <>
          <Table>
            <THead>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Number" field="number" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/subscriptions" query={query} />
              </th>
              <TH>Customer</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Start" field="startDate" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/subscriptions" query={query} />
              </th>
              <th scope="col" className="group px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Next billing" field="nextBillingDate" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/subscriptions" query={query} />
              </th>
              <th scope="col" className="group px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-zinc-500">
                <SortHeader label="Period total" field="total" currentSort={listParams.sort} currentDir={listParams.dir} basePath="/subscriptions" query={query} align="right" />
              </th>
            </THead>
            <tbody>
              {items.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/subscriptions/${s.id}`} className="font-medium text-accent-text hover:underline">
                      {s.number}
                    </Link>
                  </TD>
                  <TD>
                    <span className="block truncate text-zinc-800">{s.customerName}</span>
                    <span className="block truncate text-2xs text-zinc-500">{s.customerEmail}</span>
                  </TD>
                  <TD className="text-zinc-600">
                    {s.planName}
                    <span className="ml-1 text-2xs text-zinc-400">
                      ×{s.quantity} · {PERIOD_LABELS[s.planPeriod as BillingPeriod]?.toLowerCase()}
                    </span>
                  </TD>
                  <TD>
                    <SubscriptionBadge status={s.status} paused={s.paused} />
                  </TD>
                  <TD className="text-zinc-600">{formatDate(s.startDate)}</TD>
                  <TD className="text-zinc-600">{s.status === 'ACTIVE' ? formatDate(s.nextBillingDate) : '—'}</TD>
                  <TD align="right">
                    <Money minor={s.total} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/subscriptions" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
