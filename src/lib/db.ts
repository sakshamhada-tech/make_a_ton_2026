import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import path from 'node:path';

/**
 * Prisma client singleton.
 *
 * Uses the Rust-free query compiler (WASM, bundled with @prisma/client) plus
 * the libsql driver adapter, so no engine binaries need to be downloaded.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Load .env when running outside Next.js (seed, scripts, tests).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present; fall back to defaults below.
  }
}

function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  if (!url.startsWith('file:')) return url;
  const rel = url.slice('file:'.length);
  // Prisma convention: DATABASE_URL is relative to the prisma/ directory.
  return `file:${path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), 'prisma', rel)}`;
}

function createPrisma(): PrismaClient {
  const adapter = new PrismaLibSQL({ url: resolveDbUrl() });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
