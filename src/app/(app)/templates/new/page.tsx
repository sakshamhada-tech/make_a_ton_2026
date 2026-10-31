import { requireUser } from '@/lib/auth';
import { listPlansForSelection } from '@/services/plan.service';
import { listProducts } from '@/services/product.service';
import { taxesForProduct } from '@/services/tax.service';
import { db } from '@/lib/db';
import { todayUtc } from '@/lib/dates';
import { PageHeader } from '@/components/ui/page-header';
import { TemplateForm } from '@/app/(app)/templates/template-form';

export const metadata = { title: 'New template' };
export const dynamic = 'force-dynamic';

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const actor = await requireUser('ADMIN');
  const sp = await searchParams;
  const [plans, products] = await Promise.all([
    listPlansForSelection(actor, todayUtc()),
    listProducts(actor, { page: 1, pageSize: 100, sort: 'name', dir: 'asc' }),
  ]);

  const productDetails = await Promise.all(
    products.items.map(async (p) => {
      const [variants, taxes] = await Promise.all([
        db.variantOption.findMany({ where: { productId: p.id }, orderBy: [{ attribute: 'asc' }, { value: 'asc' }] }),
        taxesForProduct(p.id),
      ]);
      return {
        id: p.id,
        name: p.name,
        taxLabel: taxes[0]?.label ?? 'No tax',
        variants: variants.map((v) => ({ id: v.id, label: `${v.attribute}: ${v.value}` })),
      };
    }),
  );

  return (
    <div>
      <PageHeader title="New quote template" description="Templates prefill the subscription form." />
      <TemplateForm plans={plans} products={productDetails} initialPlanId={sp.planId} />
    </div>
  );
}
