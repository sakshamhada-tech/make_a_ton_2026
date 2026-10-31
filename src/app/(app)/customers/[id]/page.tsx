import { requireUser } from '@/lib/auth';
import { getCustomer } from '@/services/customer.service';
import { listSubscriptions } from '@/services/subscription.service';
import { listInvoices } from '@/services/invoice.service';
import { PageHeader } from '@/components/ui/page-header';
import { CustomerForm } from '@/app/(app)/customers/customer-form';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Money } from '@/components/ui/money';
import { SubscriptionBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NotFoundError } from '@/lib/errors';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Customer' };
export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const { id } = await params;
  const sp = await searchParams;
  let customer;
  try {
    customer = await getCustomer(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const [subs, invoices] = await Promise.all([
    listSubscriptions(actor, { page: 1, pageSize: 10, sort: 'createdAt', dir: 'desc' }, { customerId: id }),
    listInvoices(actor, { page: 1, pageSize: 10, sort: 'issueDate', dir: 'desc' }, { customerId: id }),
  ]);
  const notice = str(sp, 'saved') ? 'Customer saved.' : str(sp, 'created') ? 'Customer created.' : undefined;

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={[customer.city, customer.state, customer.country].filter(Boolean).join(', ')}
      />
      {notice ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Email</p>
          <p className="mt-1 truncate text-sm">{customer.email}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Phone</p>
          <p className="mt-1 text-sm">{customer.phone ?? '—'}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">GSTIN</p>
          <p className="mt-1 text-sm">{customer.gstin ?? '—'}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Portal login</p>
          <p className="mt-1 text-sm">{customer.user ? 'Enabled' : 'Not enabled'}</p>
        </div>
      </div>

      <CustomerForm
        customerId={customer.id}
        initial={{
          name: customer.name,
          email: customer.email,
          phone: customer.phone ?? '',
          address: customer.address ?? '',
          city: customer.city ?? '',
          state: customer.state ?? '',
          country: customer.country,
          postalCode: customer.postalCode ?? '',
          gstin: customer.gstin ?? '',
        }}
      />

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Recent subscriptions</h2>
        {subs.items.length === 0 ? (
          <p className="card-panel px-4 py-6 text-xs text-zinc-500">No subscriptions yet.</p>
        ) : (
          <Table>
            <THead>
              <TH>Number</TH>
              <TH>Status</TH>
              <TH>Plan</TH>
              <TH align="right">Total</TH>
              <TH>Start</TH>
            </THead>
            <tbody>
              {subs.items.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/subscriptions/${s.id}`} className="font-medium text-accent-text hover:underline">
                      {s.number}
                    </Link>
                  </TD>
                  <TD>
                    <SubscriptionBadge status={s.status} paused={s.paused} />
                  </TD>
                  <TD className="text-zinc-600">{s.planName}</TD>
                  <TD align="right">
                    <Money minor={s.total} />
                  </TD>
                  <TD className="text-zinc-600">{formatDate(s.startDate)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Recent invoices</h2>
        {invoices.items.length === 0 ? (
          <p className="card-panel px-4 py-6 text-xs text-zinc-500">No invoices yet.</p>
        ) : (
          <Table>
            <THead>
              <TH>Number</TH>
              <TH>Status</TH>
              <TH>Issued</TH>
              <TH align="right">Total</TH>
              <TH align="right">Outstanding</TH>
            </THead>
            <tbody>
              {invoices.items.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <Link href={`/invoices/${i.id}`} className="font-medium text-accent-text hover:underline">
                      {i.number}
                    </Link>
                  </TD>
                  <TD className="text-zinc-600">{i.statusLabel}</TD>
                  <TD className="text-zinc-600">{formatDate(i.issueDate)}</TD>
                  <TD align="right">
                    <Money minor={i.total} />
                  </TD>
                  <TD align="right">
                    <Money minor={i.outstanding} muted={i.outstanding === 0} />
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
