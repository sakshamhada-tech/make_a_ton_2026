import { requireUser } from '@/lib/auth';
import { getPlan } from '@/services/plan.service';
import { PageHeader } from '@/components/ui/page-header';
import { PlanForm } from '@/app/(app)/plans/plan-form';
import { Money } from '@/components/ui/money';
import { StatusBadge } from '@/components/ui/badge';
import { formatDate, toDateInput } from '@/lib/dates';
import { PERIOD_LABELS, type BillingPeriod } from '@/lib/enums';
import { notFound } from 'next/navigation';
import { NotFoundError } from '@/lib/errors';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Plan' };
export const dynamic = 'force-dynamic';

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const { id } = await params;
  const sp = await searchParams;
  let plan;
  try {
    plan = await getPlan(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const canEdit = actor.role === 'ADMIN';
  const notice = str(sp, 'saved') ? 'Plan saved.' : str(sp, 'created') ? 'Plan created.' : undefined;

  return (
    <div>
      <PageHeader
        title={plan.name}
        description={`${PERIOD_LABELS[plan.period as BillingPeriod] ?? plan.period} plan · ${plan.subscriptionCount} subscriptions`}
        actions={<StatusBadge label={plan.isActive ? 'Active' : 'Inactive'} tone={plan.isActive ? 'emerald' : 'zinc'} />}
      />
      {notice ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mb-6 grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Price</p>
          <p className="mt-1 text-sm font-semibold">
            <Money minor={plan.price} /> / {PERIOD_LABELS[plan.period as BillingPeriod]?.toLowerCase()}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Minimum quantity</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">{plan.minQuantity}</p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Available</p>
          <p className="mt-1 text-sm">
            {formatDate(plan.availableFrom)}
            {plan.availableTo ? ` – ${formatDate(plan.availableTo)}` : ' – open'}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-2xs uppercase tracking-wide text-zinc-500">Rules</p>
          <p className="mt-1 text-2xs text-zinc-600">
            {[
              plan.autoClose ? 'auto-close' : null,
              plan.allowEarlyClose ? 'early close' : null,
              plan.allowPause ? 'pause' : null,
              plan.allowRenew ? 'renewal' : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'no optional rules'}
          </p>
        </div>
      </div>

      {canEdit ? (
        <PlanForm
          planId={plan.id}
          initial={{
            name: plan.name,
            price: (plan.price / 100).toFixed(2),
            period: plan.period,
            minQuantity: String(plan.minQuantity),
            availableFrom: toDateInput(plan.availableFrom),
            availableTo: toDateInput(plan.availableTo),
            autoClose: plan.autoClose,
            allowEarlyClose: plan.allowEarlyClose,
            allowPause: plan.allowPause,
            allowRenew: plan.allowRenew,
            isActive: plan.isActive,
          }}
        />
      ) : (
        <p className="card-panel px-4 py-6 text-xs text-zinc-500">Plan editing is limited to administrators.</p>
      )}
    </div>
  );
}
