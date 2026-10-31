import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { ProductForm } from '@/app/(app)/products/product-form';

export const metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requireUser('ADMIN');
  return (
    <div>
      <PageHeader title="New product" description="Products are billable catalog items with unit prices." />
      <ProductForm />
    </div>
  );
}
