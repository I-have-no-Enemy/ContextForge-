/**
 * End-to-end run of the Postman collection against a real server and a real database,
 * without touching application data: everything happens in the ctxforge_test schema.
 *
 *   npm run e2e
 *
 * 1. recreate ctxforge_test and push the Prisma schema
 * 2. seed it (random passwords, kept in memory only)
 * 3. start the API with rate limits ON on port 5055
 * 4. run newman with the collection, then stop the API
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import recreateTestSchema from '../src/test/globalSetup.js';
import { testDatabaseUrl } from '../src/test/testDb.js';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(backend, '..');
const PORT = 5055;
const adminPassword = randomBytes(15).toString('base64url');
const env = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl(),
  NODE_ENV: 'e2e',
  PORT: String(PORT),
  SEED_ADMIN_PASSWORD: adminPassword,
  SEED_MAINTAINER_PASSWORD: randomBytes(15).toString('base64url'),
};
const shell = process.platform === 'win32';

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/api/v1/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API did not become healthy within 30 s');
}

async function main() {
  console.log('1/4 recreating ctxforge_test schema');
  await recreateTestSchema();

  console.log('2/4 seeding');
  const seed = spawnSync('npx', ['tsx', 'prisma/seed.ts'], { cwd: backend, env, stdio: 'inherit', shell });
  if (seed.status !== 0) throw new Error('seed failed');

  console.log(`3/4 starting API on :${PORT} (rate limits on)`);
  const api = spawn('npx', ['tsx', 'src/server.ts'], { cwd: backend, env, stdio: 'ignore', shell });
  try {
    await waitForHealth();
    console.log('4/4 newman');
    const run = spawnSync(
      'npx',
      [
        '-y',
        'newman@6.2.3',
        'run',
        'docs/postman/ContextForge.postman_collection.json',
        '-e',
        'docs/postman/local.postman_environment.json',
        '--env-var',
        `baseUrl=http://localhost:${PORT}/api/v1`,
        '--env-var',
        `adminPassword=${adminPassword}`,
        '--reporters',
        'cli',
        '--color',
        'off',
      ],
      { cwd: repo, env, stdio: 'inherit', shell }
    );
    process.exitCode = run.status ?? 1;
  } finally {
    if (shell && api.pid) spawnSync('taskkill', ['/pid', String(api.pid), '/T', '/F'], { stdio: 'ignore' });
    else api.kill();
  }
}

main().catch((e) => {
  console.error(`e2e failed: ${e.message}`);
  process.exit(1);
});
