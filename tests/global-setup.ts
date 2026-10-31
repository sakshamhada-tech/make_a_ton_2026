import fs from 'node:fs';
import path from 'node:path';
import { applyMigration, resolveDbUrl } from '../scripts/ddl';

export default async function globalSetup(): Promise<void> {
  const fileUrl = resolveDbUrl('file:./test.db');
  const file = fileUrl.replace('file:', '');
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await applyMigration(fileUrl);
}
