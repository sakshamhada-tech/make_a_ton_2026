import { requireUser } from '@/lib/auth';
import { listPlansForSelection } from '@/services/plan.service';
import { listProducts } from '@/services/product.service';
import { listAllCustomers } from '@/services/customer.service';
import { listActiveTemplates } from '@/services/template.service';
import { taxesForProduct } from '@/services/tax.service';
import { db } from '@/lib/db';
import { addBillingPeriod, todayUtc, toDateInput } from '@/lib/dates';
import { PageHeader } from '@/components/ui/page-header';
import { SubscriptionForm, type FormProduct } from '@/app/(app)/subscriptions/subscription-form';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'New subscription' };
export const dynamic = 'force-dynamic';

export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const sp = await searchParams;
  const today = todayUtc();
  const [plans, products, customers, templates] = await Promise.all([
    listPlansForSelection(actor, today),
    listProducts(actor, { page: 1, pageSize: 100, sort: 'name', dir: 'asc' }, { status: 'active' }),
    listAllCustomers(actor),
    listActiveTemplates(actor),
  ]);

  const formProducts: FormProduct[] = await Promise.all(
    products.items.map(async (p) => {
      const [variants, taxes] = await Promise.all([
        db.variantOption.findMany({
          where: { productId: p.id },
          orderBy: [{ attribute: 'asc' }, { value: 'asc' }],
        }),
        taxesForProduct(p.id),
      ]);
      return {
        id: p.id,
        name: p.name,
        salesPrice: p.salesPrice,
        variants: variants.map((v) => ({
          id: v.id,
          label: `${v.attribute}: ${v.value}`,
          priceExtra: v.priceExtra,
        })),
        taxes: taxes.map((t) => ({ id: t.id, label: t.label })),
      };
    }),
  );

  const selectedTemplateId = str(sp, 'templateId');

  return (
    <div>
      <PageHeader
        title="New subscription"
        description="Subscriptions start as drafts and advance through the status flow."
      />
      <SubscriptionForm
        customers={customers}
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          period: p.period,
          minQuantity: p.minQuantity,
        }))}
        products={formProducts}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          planName: t.planName,
          planId: t.planId,
          validityDays: t.validityDays,
          lines: t.lines
            .filter((l) => l.productId !== null)
            .map((l) => ({
              productId: l.productId as string,
              variantOptionId: l.variantOptionId,
              quantity: l.quantity,
            })),
        }))}
        initialTemplateId={selectedTemplateId}
        defaults={{
          startDate: toDateInput(today),
          endDate: toDateInput(addBillingPeriod(today, 'YEARLY')),
        }}
      />
    </div>
  );
}
