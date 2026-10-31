import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db';

/**
 * Sequential document numbers: SUB-000123 / INV-000123.
 * The counter row is incremented inside a transaction so concurrent
 * generators cannot receive the same number.
 */
export async function nextDocumentNumber(
  prefix: 'SUB' | 'INV',
  client?: Prisma.TransactionClient | PrismaClient,
): Promise<string> {
  const key = `next_${prefix}`;
  const run = async (tx: Prisma.TransactionClient) => {
    await tx.counter.upsert({
      where: { key },
      update: { value: { increment: 1 } },
      create: { key, value: 1 },
    });
    return tx.counter.findUniqueOrThrow({ where: { key } });
  };
  const counter = client ? await run(client) : await db.$transaction(run);
  return `${prefix}-${String(counter.value).padStart(6, '0')}`;
}
