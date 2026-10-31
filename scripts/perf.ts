/**
 * Measures server-render times for the heaviest pages against the seeded
 * database (5,000 subscriptions / ~16,000 invoices). Run with `npm run perf`
 * while `next start` (or `next dev`) is listening on PORT (default 3000).
 *
 * It authenticates with a real server session (same cookie the browser uses)
 * and prints a table of cold/warm timings against the 2,000 ms budget.
 */
import { db } from '../src/lib/db';
import { createSession, SESSION_COOKIE } from '../src/lib/auth';

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

interface Result {
  path: string;
  status: number;
  ms: number;
}

async function timeFetch(path: string, cookie: string): Promise<Result> {
  const started = performance.now();
  const response = await fetch(`${BASE}${path}`, {
    headers: { cookie },
    redirect: 'manual',
  });
  await response.arrayBuffer();
  return { path, status: response.status, ms: Math.round(performance.now() - started) };
}

async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@brightloop.example';
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    throw new Error(`No admin user ${adminEmail} — run npm run setup first.`);
  }
  const token = await createSession(admin.id);
  const cookie = `${SESSION_COOKIE}=${token}`;

  console.log(`Brightloop perf check against ${BASE}`);
  console.log(`Session for ${adminEmail}\n`);

  const pages = [
    '/dashboard',
    '/subscriptions',
    '/subscriptions?status=active&sort=createdAt&dir=desc&page=2',
    '/invoices',
    '/invoices?status=overdue',
    '/payments',
    '/billing',
    '/outbox',
    '/api/export/subscriptions?status=active',
  ];

  const cold: Result[] = [];
  for (const path of pages) {
    cold.push(await timeFetch(path, cookie));
  }
  // Second pass: warm caches.
  const warm: Result[] = [];
  for (const path of pages) {
    warm.push(await timeFetch(path, cookie));
  }

  console.log('path'.padEnd(64), 'status'.padEnd(7), 'cold'.padEnd(9), 'warm');
  for (const [i, r] of cold.entries()) {
    const w = warm[i];
    console.log(
      r.path.padEnd(64),
      String(r.status).padEnd(7),
      `${r.ms} ms`.padEnd(9),
      `${w.ms} ms`,
    );
    if (r.status !== 200 || w.ms > 2000) {
      console.error(`  FAIL: ${r.path} status=${r.status} warm=${w.ms}ms (budget 2000ms)`);
      process.exitCode = 1;
    }
  }
  console.log('\nBudget: every page under 2,000 ms server render.');
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
