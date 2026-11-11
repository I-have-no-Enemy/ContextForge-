/**
 * Runs the real API on :5000 against the isolated ctxforge_test schema, freshly seeded and
 * GitHub-synced, so the UI can be exercised end to end without touching data in `public`.
 *
 *   npm run dev:testdb      (then `npm run dev:frontend` in another terminal)
 *
 * Account passwords are generated per run, apply only to the test schema, and are printed once.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import recreateTestSchema from '../src/test/globalSetup.js';
import { testDatabaseUrl } from '../src/test/testDb.js';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');
const shell = process.platform === 'win32';
const passwords = { admin: randomBytes(9).toString('base64url'), maintainer: randomBytes(9).toString('base64url') };
const env = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl(),
  NODE_ENV: 'e2e',
  PORT: process.env.PORT ?? '5000',
  SEED_ADMIN_PASSWORD: passwords.admin,
  SEED_MAINTAINER_PASSWORD: passwords.maintainer,
};

async function main() {
  await recreateTestSchema();
  if (spawnSync('npx', ['tsx', 'prisma/seed.ts'], { cwd: backend, env, stdio: 'inherit', shell }).status !== 0) throw new Error('seed failed');
  spawnSync('npx', ['tsx', 'scripts/sync-github.ts'], { cwd: backend, env, stdio: 'ignore', shell });
  console.log(`\nTest-schema accounts (this run only):\n  admin@contextforge.dev       ${passwords.admin}\n  maintainer@contextforge.dev  ${passwords.maintainer}\n`);
  spawn('npx', ['tsx', 'src/server.ts'], { cwd: backend, env, stdio: 'inherit', shell });
}

main().catch((e) => {
  console.error(`dev:testdb failed: ${e.message}`);
  process.exit(1);
});
