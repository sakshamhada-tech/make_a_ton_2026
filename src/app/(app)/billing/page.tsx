import { requireUser } from '@/lib/auth';
import { listBillingRuns, getBillingRun } from '@/services/billing.service';
import { str, type SearchParams } from '@/lib/http';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page-header';
import { BillingRunForm } from '@/app/(app)/billing/billing-run-form';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDate, formatDateTime, todayUtc } from '@/lib/dates';

export const metadata = { title: 'Run billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const sp = await searchParams;
  const selectedRunId = str(sp, 'run');
  const [runs, selectedRun, dueCount, activeCount] = await Promise.all([
    listBillingRuns(actor),
    selectedRunId ? getBillingRun(actor, selectedRunId).catch(() => null) : Promise.resolve(null),
    db.subscription.count({
      where: {
        status: 'ACTIVE',
        pausedAt: null,
        nextBillingDate: { not: null, lte: todayUtc() },
      },
    }),
    db.subscription.count({ where: { status: 'ACTIVE' } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Run billing"
        description="Generate invoices for active subscriptions due on or before a chosen date. Re-running never bills the same period twice."
      />

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Active subscriptions</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{activeCount}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Due now</p>
          <p className={`mt-1 text-lg font-semibold tabular-nums ${dueCount > 0 ? 'text-accent-text' : ''}`}>
            {dueCount}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Auto-close</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Plans flagged for auto-close are closed when the end date passes.
          </p>
        </div>
      </div>

      <section className="card-panel mb-8 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">New billing run</h2>
        <BillingRunForm today={formatDateInput(todayUtc())} />
      </section>

      {selectedRun ? (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">
            Run details · {formatDateTime(selectedRun.ranAt)} by {selectedRun.ranByName ?? 'system'}
          </h2>
          <p className="mb-2 text-xs text-zinc-600">
            {selectedRun.created} created · {selectedRun.skipped} skipped · {selectedRun.failed} failed
          </p>
          {selectedRun.lines.length === 0 ? (
            <p className="card-panel px-4 py-6 text-xs text-zinc-500">No detail lines stored for this run.</p>
          ) : (
            <Table>
              <THead>
                <TH>Subscription</TH>
                <TH>Customer</TH>
                <TH>Outcome</TH>
                <TH>Detail</TH>
              </THead>
              <tbody>
                {selectedRun.lines.map((line, i) => (
                  <TR key={i}>
                    <TD className="font-medium text-zinc-900">{line.subscriptionNumber}</TD>
                    <TD className="text-zinc-600">{line.customerName}</TD>
                    <TD>
                      <span
                        className={`text-xs font-medium ${
                          line.outcome === 'created' ? 'text-emerald-700' : line.outcome === 'failed' ? 'text-red-600' : 'text-zinc-500'
                        }`}
                      >
                        {line.outcome}
                      </span>
                    </TD>
                    <TD className="text-zinc-600">{line.detail}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="card-panel px-4 py-8 text-center text-xs text-zinc-500">No billing runs yet.</p>
        ) : (
          <Table>
            <THead>
              <TH>Run</TH>
              <TH>Ran at</TH>
              <TH>By</TH>
              <TH>As of</TH>
              <TH align="right">Created</TH>
              <TH align="right">Skipped</TH>
              <TH align="right">Failed</TH>
            </THead>
            <tbody>
              {runs.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <a href={`/billing?run=${r.id}`} className="font-medium text-accent-text hover:underline">
                      {r.id.slice(-8)}
                    </a>
                  </TD>
                  <TD className="text-zinc-600">{formatDateTime(r.ranAt)}</TD>
                  <TD className="text-zinc-600">{r.ranByName ?? '—'}</TD>
                  <TD className="text-zinc-600">{formatDate(r.asOfDate)}</TD>
                  <TD align="right" className="tabular-nums text-emerald-700">
                    {r.created}
                  </TD>
                  <TD align="right" className="tabular-nums text-zinc-600">
                    {r.skipped}
                  </TD>
                  <TD align="right" className={`tabular-nums ${r.failed > 0 ? 'text-red-600' : 'text-zinc-600'}`}>
                    {r.failed}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}
