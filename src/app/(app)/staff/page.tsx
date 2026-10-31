import { requireUser } from '@/lib/auth';
import { listStaff } from '@/services/auth.service';
import { setStaffActiveAction } from '@/actions/catalog';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { StaffForm } from '@/app/(app)/staff/staff-form';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { formatDate } from '@/lib/dates';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Staff' };
export const dynamic = 'force-dynamic';

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireUser('ADMIN');
  const [staff, sp] = await Promise.all([listStaff(actor), searchParams]);
  const notice = str(sp, 'created') ? 'Staff account created. A welcome message was written to the Outbox.' : undefined;

  return (
    <div>
      <PageHeader title="Staff" description="Internal accounts. Only admins can create or deactivate staff." />
      {notice ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      <section className="card-panel mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">New staff account</h2>
        <StaffForm />
      </section>

      <Table>
        <THead>
          <TH>Name</TH>
          <TH>Email</TH>
          <TH>Role</TH>
          <TH>Status</TH>
          <TH>Created</TH>
          <TH align="right">Actions</TH>
        </THead>
        <tbody>
          {staff.map((s) => (
            <TR key={s.id}>
              <TD className="font-medium text-zinc-900">{s.name}</TD>
              <TD className="text-zinc-600">{s.email}</TD>
              <TD className="text-zinc-600">{s.role === 'ADMIN' ? 'Admin' : 'Staff'}</TD>
              <TD>
                <StatusBadge label={s.isActive ? 'Active' : 'Deactivated'} tone={s.isActive ? 'emerald' : 'zinc'} />
              </TD>
              <TD className="text-zinc-600">{formatDate(s.createdAt)}</TD>
              <TD align="right">
                {s.id === actor.id ? (
                  <span className="text-2xs text-zinc-400">You</span>
                ) : s.isActive ? (
                  <ConfirmButton
                    label="Deactivate"
                    size="sm"
                    confirmTitle="Deactivate account"
                    confirmMessage={`${s.name} will no longer be able to sign in.`}
                    onConfirm={setStaffActiveAction.bind(null, s.id, false)}
                  />
                ) : (
                  <ConfirmButton
                    label="Reactivate"
                    size="sm"
                    variant="secondary"
                    confirmTitle="Reactivate account"
                    confirmMessage={`${s.name} will be able to sign in again.`}
                    onConfirm={setStaffActiveAction.bind(null, s.id, true)}
                  />
                )}
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
