import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listTemplates } from '@/services/template.service';
import { parseListParams, type SearchParams } from '@/lib/http';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/dates';

export const metadata = { title: 'Quote templates' };
export const dynamic = 'force-dynamic';

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const listParams = parseListParams(params, { defaultSort: 'createdAt', defaultDir: 'desc' });
  const { items, meta } = await listTemplates(actor, listParams);
  const canEdit = actor.role === 'ADMIN';
  const query = {};

  return (
    <div>
      <PageHeader
        title="Quote templates"
        description="Reusable plan + product presets when creating subscriptions."
        actions={
          canEdit ? (
            <ButtonLink href="/templates/new" variant="primary">
              New template
            </ButtonLink>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Templates prefill plan, product lines and quote validity."
          action={canEdit ? <ButtonLink href="/templates/new" variant="primary">New template</ButtonLink> : undefined}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Name</TH>
              <TH>Plan</TH>
              <TH align="right">Lines</TH>
              <TH align="right">Validity</TH>
              <TH>Status</TH>
              <TH>Created</TH>
            </THead>
            <tbody>
              {items.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium text-zinc-900">
                    <Link href={`/subscriptions/new?templateId=${t.id}`} className="hover:text-accent-text hover:underline">
                      {t.name}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{t.planName}</TD>
                  <TD align="right" className="tabular-nums text-zinc-600">
                    {t.lineCount}
                  </TD>
                  <TD align="right" className="tabular-nums text-zinc-600">
                    {t.validityDays} days
                  </TD>
                  <TD>
                    <StatusBadge label={t.isActive ? 'Active' : 'Inactive'} tone={t.isActive ? 'emerald' : 'zinc'} />
                  </TD>
                  <TD className="text-zinc-600">{formatDate(t.createdAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-3">
            <Pagination meta={meta} basePath="/templates" query={query} />
          </div>
        </>
      )}
    </div>
  );
}
