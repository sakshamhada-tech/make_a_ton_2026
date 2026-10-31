import { db } from '@/lib/db';

/**
 * Dev mailer: every outbound message is written to the Outbox table
 * and surfaced on the internal /outbox page. No SMTP is involved.
 */
export interface OutboxInput {
  to: string;
  subject: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

export async function sendMail(input: OutboxInput): Promise<void> {
  await db.outboxEmail.create({
    data: {
      toEmail: input.to,
      subject: input.subject,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
}
