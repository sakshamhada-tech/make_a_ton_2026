import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { PlanForm } from '@/app/(app)/plans/plan-form';
import { todayUtc, toDateInput } from '@/lib/dates';

export const metadata = { title: 'New plan' };

export default async function NewPlanPage() {
  await requireUser('ADMIN');
  return (
    <div>
      <PageHeader title="New plan" description="Plans define the recurring price, period and subscription rules." />
      <PlanForm initial={{ availableFrom: toDateInput(todayUtc()), availableTo: '' }} />
    </div>
  );
}
