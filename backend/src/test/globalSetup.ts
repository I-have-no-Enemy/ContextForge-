import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { TEST_SCHEMA, testDatabaseUrl } from './testDb.js';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Recreates the isolated test schema once per `vitest run`, then pushes the Prisma schema into it. */
export default async function setup() {
  const url = testDatabaseUrl();
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    // Explicit and scoped: only the test schema is dropped.
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);
  } finally {
    await prisma.$disconnect();
  }

  execSync('npx prisma db push --skip-generate', {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
