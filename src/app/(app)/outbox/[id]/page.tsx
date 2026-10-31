import { requireUser } from '@/lib/auth';
import { getOutboxEmail } from '@/services/outbox.service';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/dates';
import { notFound } from 'next/navigation';
import { NotFoundError } from '@/lib/errors';

export const metadata = { title: 'Outbox message' };
export const dynamic = 'force-dynamic';

export default async function OutboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser('ADMIN', 'STAFF');
  const { id } = await params;
  let email;
  try {
    email = await getOutboxEmail(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return (
    <div>
      <PageHeader title={email.subject} description={`To ${email.toEmail} · ${formatDateTime(email.createdAt)}`} />
      <article className="card-panel max-w-2xl p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-800">{email.body}</pre>
      </article>
    </div>
  );
}
