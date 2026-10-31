/**
 * Applies the SQLite schema for Brightloop Billing (see scripts/ddl.ts).
 * Run via `npm run db:migrate`.
 */
import { applyMigration, resolveDbUrl, rootDir } from './ddl';

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(`${rootDir}/.env`);
  } catch {
    // No .env file present; fall back to defaults below.
  }
}

const fileUrl = resolveDbUrl();

applyMigration(fileUrl)
  .then(async () => {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: fileUrl });
    const count = await client.execute(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'`);
    console.log(`Migration applied to ${fileUrl} (${String(count.rows[0]?.n)} tables).`);
    client.close();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
