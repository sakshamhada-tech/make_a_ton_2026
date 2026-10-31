import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listSubscriptions } from '@/services/subscription.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { SubscriptionBadge } from '@/components/ui/badge';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { formatDate } from '@/lib/dates';
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUSES } from '@/lib/enums';

export const metadata = { title: 'My subscriptions' };
export const dynamic = 'force-dynamic';

export default async function PortalSubscriptionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('CUSTOMER');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'createdAt', defaultDir: 'desc' });
  const filters = { status: str(params, 'status') };
  const { items, meta } = await listSubscriptions(actor, listParams, filters);
  const query = { status: str(params, 'status') };

  return (
    <div>
      <PageHeader title="My subscriptions" description="Only your subscriptions are shown here." />

      <FilterBar action="/portal/subscriptions" resetHref="/portal/subscriptions">
        <FilterSelect
          label="Status"
          name="status"
          value={str(params, 'status')}
          options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))}
        />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState title="No subscriptions found" description="Adjust the filter or contact Brightloop." />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Number</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>Start</TH>
              <TH>Expiry</TH>
              <TH>Next billing</TH>
              <TH align="right">Amount</TH>
            </THead>
            <tbody>
              {items.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/portal/subscriptions/${s.id}`} className="font-medium text-accent-text hover:underline">
                      {s.number}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{s.planName}</TD>
                  <TD>
                    <SubscriptionBadge status={s.status} paused={s.paused} />
                  </TD>
                  <TD className="text-zinc-600">{formatDate(s.startDate)}</TD>
                  <TD className="text-zinc-600">{formatDate(s.endDate)}</TD>
                  <TD className="text-zinc-600">{s.status === 'ACTIVE' ? formatDate(s.nextBillingDate) : '—'}</TD>
                  <TD align="right">
                    <Money minor={s.total} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/portal/subscriptions" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
