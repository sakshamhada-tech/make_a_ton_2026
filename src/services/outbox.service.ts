import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { assertStaff, type Actor } from '@/lib/rbac';
import { pageMeta, type ListParams } from '@/lib/http';

export interface OutboxListItem {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  entityType: string | null;
  createdAt: Date;
}

export async function listOutbox(actor: Actor, params: ListParams, filters: { q?: string } = {}) {
  assertStaff(actor);
  const where = filters.q
    ? {
        OR: [
          { toEmail: { contains: filters.q } },
          { subject: { contains: filters.q } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    db.outboxEmail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.outboxEmail.count({ where }),
  ]);
  return {
    items: items.map(
      (e): OutboxListItem => ({
        id: e.id,
        toEmail: e.toEmail,
        subject: e.subject,
        body: e.body,
        entityType: e.entityType,
        createdAt: e.createdAt,
      }),
    ),
    meta: pageMeta(params.page, params.pageSize, total),
  };
}

export async function getOutboxEmail(actor: Actor, id: string): Promise<OutboxListItem> {
  assertStaff(actor);
  const e = await db.outboxEmail.findUnique({ where: { id } });
  if (!e) throw new NotFoundError('Message not found.');
  return {
    id: e.id,
    toEmail: e.toEmail,
    subject: e.subject,
    body: e.body,
    entityType: e.entityType,
    createdAt: e.createdAt,
  };
}
