import { Sidebar } from '@/components/layout/sidebar';
import { requireUser } from '@/lib/auth';
import { ForbiddenError } from '@/lib/errors';
import { redirect } from 'next/navigation';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireUser('CUSTOMER');
  } catch (error: unknown) {
    // Staff and admins belong in the staff app, not the customer portal.
    if (error instanceof ForbiddenError) {
      redirect('/dashboard');
    }
    throw error;
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-zinc-50">
        <div className="mx-auto max-w-5xl px-6 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
