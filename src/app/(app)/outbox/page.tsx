import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listOutbox } from '@/services/outbox.service';
import { parseListParams, str, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar, FilterText } from '@/components/ui/filter-bar';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Outbox' };
export const dynamic = 'force-dynamic';

export default async function OutboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'createdAt', defaultDir: 'desc' });
  const filters = { q: str(params, 'q') };
  const { items, meta } = await listOutbox(actor, listParams, filters);
  const query = { q: str(params, 'q') };

  return (
    <div>
      <PageHeader
        title="Outbox"
        description="Development mailer: every outbound email is stored here instead of being sent."
      />

      <FilterBar action="/outbox" resetHref="/outbox">
        <FilterText label="Search" name="q" value={filters.q} placeholder="Recipient or subject" />
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          title="Outbox is empty"
          description="Invoices sent, password resets and welcome messages will appear here."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Sent at</TH>
              <TH>To</TH>
              <TH>Subject</TH>
              <TH>Related to</TH>
            </THead>
            <tbody>
              {items.map((e) => (
                <TR key={e.id}>
                  <TD className="text-zinc-600">{formatDateTime(e.createdAt)}</TD>
                  <TD className="text-zinc-700">{e.toEmail}</TD>
                  <TD>
                    <Link href={`/outbox/${e.id}`} className="font-medium text-accent-text hover:underline">
                      {e.subject}
                    </Link>
                  </TD>
                  <TD className="text-2xs uppercase tracking-wide text-zinc-500">{e.entityType ?? '—'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/outbox" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
