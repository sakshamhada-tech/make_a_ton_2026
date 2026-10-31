import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDashboardData, type DashboardFilters } from '@/services/report.service';
import { listPlansForSelection } from '@/services/plan.service';
import { listAllCustomers } from '@/services/customer.service';
import { PageHeader } from '@/components/ui/page-header';
import { Money } from '@/components/ui/money';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { BarChart } from '@/components/charts/bar-chart';
import { PlanBars } from '@/components/charts/plan-bars';
import { FilterBar, FilterDate, FilterSelect } from '@/components/ui/filter-bar';
import { formatDate, parseDateInput, todayUtc } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { str, type SearchParams } from '@/lib/http';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const params = await searchParams;
  const filters: DashboardFilters = {
    from: parseDateInput(str(params, 'from') ?? ''),
    to: parseDateInput(str(params, 'to') ?? ''),
    planId: str(params, 'planId'),
    customerId: str(params, 'customerId'),
  };
  const [data, plans, customers] = await Promise.all([
    getDashboardData(actor, filters),
    listPlansForSelection(actor, todayUtc()),
    listAllCustomers(actor),
  ]);

  return (
    <div>
      <PageHeader title="Dashboard" description="Recurring revenue, collections and overdue invoices." />

      <FilterBar action="/dashboard" resetHref="/dashboard">
        <FilterDate label="From" name="from" value={str(params, 'from')} />
        <FilterDate label="To" name="to" value={str(params, 'to')} />
        <FilterSelect
          label="Plan"
          name="planId"
          value={str(params, 'planId')}
          options={plans.map((p) => ({ value: p.id, label: p.name }))}
        />
        <FilterSelect
          label="Customer"
          name="customerId"
          value={str(params, 'customerId')}
          options={customers.map((c) => ({ value: c.id, label: c.name }))}
        />
      </FilterBar>

      <div className="grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label="Active subscriptions"
          value={String(data.activeSubscriptions)}
          sub={`${data.pausedSubscriptions} paused`}
        />
        <Metric label="MRR" value={formatMoney(data.mrrMinor)} sub="Normalised monthly recurring" />
        <Metric
          label="Revenue collected"
          value={formatMoney(data.revenueCollectedMinor)}
          sub="Payments in selected range"
        />
        <Metric
          label="Outstanding"
          value={formatMoney(data.outstandingMinor)}
          sub="Confirmed, unpaid invoices"
        />
        <Metric
          label="Overdue"
          value={String(data.overdueCount)}
          sub={`${formatMoney(data.overdueInvoiceValueMinor)} past due`}
          alert={data.overdueCount > 0}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="card-panel p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Collected revenue by month</h2>
          <p className="mb-3 text-xs text-zinc-500">Payments received, last 12 months.</p>
          <BarChart
            data={data.revenueByMonth.slice(-12).map((m) => ({ label: m.label, valueMinor: m.amountMinor }))}
          />
        </section>
        <section className="card-panel p-4">
          <h2 className="text-sm font-semibold text-zinc-900">MRR by plan</h2>
          <p className="mb-3 text-xs text-zinc-500">Active subscriptions, paused excluded.</p>
          <PlanBars data={data.subsByPlan} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Overdue invoices</h2>
            <Link href="/invoices?overdue=overdue" className="text-xs text-accent-text hover:underline">
              View all
            </Link>
          </div>
          {data.overdue.length === 0 ? (
            <p className="card-panel px-4 py-8 text-center text-xs text-zinc-500">No overdue invoices.</p>
          ) : (
            <Table>
              <THead>
                <TH>Invoice</TH>
                <TH>Customer</TH>
                <TH>Due</TH>
                <TH align="right">Outstanding</TH>
              </THead>
              <tbody>
                {data.overdue.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link href={`/invoices/${row.id}`} className="font-medium text-accent-text hover:underline">
                        {row.number}
                      </Link>
                      <span className="ml-2 text-2xs text-zinc-500">{row.daysOverdue}d late</span>
                    </TD>
                    <TD className="text-zinc-700">{row.customerName}</TD>
                    <TD className="text-zinc-600">{formatDate(row.dueDate)}</TD>
                    <TD align="right">
                      <Money minor={row.outstanding} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Recent payments</h2>
            <Link href="/payments" className="text-xs text-accent-text hover:underline">
              View all
            </Link>
          </div>
          {data.recentPayments.length === 0 ? (
            <p className="card-panel px-4 py-8 text-center text-xs text-zinc-500">No payments in this range.</p>
          ) : (
            <Table>
              <THead>
                <TH>Date</TH>
                <TH>Invoice</TH>
                <TH>Customer</TH>
                <TH>Method</TH>
                <TH align="right">Amount</TH>
              </THead>
              <tbody>
                {data.recentPayments.map((p) => (
                  <TR key={p.id}>
                    <TD className="text-zinc-600">{formatDate(p.paidAt)}</TD>
                    <TD>
                      <Link href={`/invoices/${p.invoiceId}`} className="font-medium text-accent-text hover:underline">
                        {p.invoiceNumber}
                      </Link>
                    </TD>
                    <TD className="text-zinc-700">{p.customerName}</TD>
                    <TD className="text-zinc-600">
                      {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                    </TD>
                    <TD align="right">
                      <Money minor={p.amount} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>

      <p className="mt-6 text-2xs text-zinc-500">
        {data.newSubscriptionsInRange} subscriptions created in the selected range · Today is{' '}
        {formatDate(todayUtc())}.
      </p>
    </div>
  );
}

function Metric({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="bg-white px-4 py-4">
      <p className="text-2xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${alert ? 'text-red-700' : 'text-zinc-900'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-2xs text-zinc-500">{sub}</p>
    </div>
  );
}
