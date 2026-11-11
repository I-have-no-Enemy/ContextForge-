import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every API test talks to a real PostgreSQL schema (src/test/testDb.ts).
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // One shared database: run files one after another so TRUNCATE in one file cannot hit another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
