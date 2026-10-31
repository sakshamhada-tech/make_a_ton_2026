import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page-header';
import { ChangePasswordForm } from '@/app/portal/profile/change-password-form';

export const metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function PortalProfilePage() {
  const actor = await requireUser('CUSTOMER');
  const [customer, user] = await Promise.all([
    actor.customerId ? db.customer.findUnique({ where: { id: actor.customerId } }) : Promise.resolve(null),
    db.user.findUnique({ where: { id: actor.id }, select: { email: true, name: true, createdAt: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Profile" description="Account details for your customer portal." />

      <div className="mb-8 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Name</p>
          <p className="mt-1 text-sm">{customer?.name ?? actor.name}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Email</p>
          <p className="mt-1 truncate text-sm">{user?.email ?? actor.email}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Billing address</p>
          <p className="mt-1 text-sm leading-relaxed">
            {customer?.address ? <>{customer.address}<br /></> : null}
            {[customer?.city, customer?.state, customer?.postalCode].filter(Boolean).join(', ') || 'On file with Brightloop'}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">GSTIN</p>
          <p className="mt-1 text-sm">{customer?.gstin ?? '—'}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Change password</h2>
        <div className="card-panel p-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
