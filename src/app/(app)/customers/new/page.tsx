import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { CustomerForm } from '@/app/(app)/customers/customer-form';

export const metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  await requireUser('ADMIN', 'STAFF');
  return (
    <div>
      <PageHeader title="New customer" description="Customers receive invoices and can be given portal access." />
      <CustomerForm />
    </div>
  );
}
