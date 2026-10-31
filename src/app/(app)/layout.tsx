import { Sidebar } from '@/components/layout/sidebar';
import { requireUser } from '@/lib/auth';

export default async function StaffShellLayout({ children }: { children: React.ReactNode }) {
  // requireUser redirects customers to the portal and blocks anonymous users.
  await requireUser('ADMIN', 'STAFF');
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
