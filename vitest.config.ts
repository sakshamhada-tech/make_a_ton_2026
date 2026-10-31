import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    env: {
      DATABASE_URL: 'file:./test.db',
      SESSION_COOKIE_SECURE: 'false',
    },
    // One shared SQLite file: run test files sequentially.
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
