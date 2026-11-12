// Local smoke test of the Vercel function entry (api/index.js) against the compiled backend and the real database.
//   npm run build            (needs backend/dist)
//   node scripts/vercel-smoke.mjs            runs the handler behind a plain HTTP server
//   node scripts/vercel-smoke.mjs --trace    also traces which files the function bundle would need
// --trace needs the same file tracer Vercel uses: npm i --no-save @vercel/nft
// It does NOT run on Vercel, so it cannot prove the platform's own behaviour (rewrites, body helpers, bundle contents).
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let failed = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? '  [' + detail + ']' : ''}`);
  if (!ok) failed += 1;
};

if (!fs.existsSync(path.join(root, 'backend/dist/app.js'))) {
  console.error('backend/dist is missing: run `npm run build` first');
  process.exit(2);
}

// what Vercel provides: production mode, platform env. DATABASE_URL comes from backend/.env here (never printed).
process.env.NODE_ENV = 'production';
process.env.TRUST_PROXY = '1';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.RATE_LIMIT_PER_MIN = '100000';
await import(pathToFileURL(path.join(root, 'backend/dist/loadEnv.js')).href);
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (backend/.env or the environment)');
  process.exit(2);
}

const handler = require(path.join(root, 'api/index.js'));
const server = http.createServer((req, res) => {
  handler(req, res).catch((e) => {
    res.statusCode = 500;
    res.end(String(e && e.message));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (method, url, body, headers = {}) => {
  const r = await fetch(base + url, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, json, text };
};

const health = await call('GET', '/api/v1/health');
check(health.status === 200 && health.json?.data?.status === 'healthy', 'GET /api/v1/health -> 200 healthy', `db=${health.json?.data?.database}`);

const list = await call('GET', '/api/v1/servers?limit=1');
check(list.status === 200 && Array.isArray(list.json?.data), 'GET /api/v1/servers -> 200 with data from the database', `total=${list.json?.pagination?.total}`);

const nope = await call('GET', '/api/v1/nope');
check(nope.status === 404 && nope.json?.error?.code === 'NOT_FOUND', 'unknown API route -> JSON 404');

// a JSON body must reach Express: a well-formed login with wrong credentials is 401; a lost body would be 400 VALIDATION_ERROR
const login = await call('POST', '/api/v1/auth/login', { email: 'smoke-test@example.com', password: 'wrong-password1' });
check(login.status === 401, 'POST /api/v1/auth/login with a JSON body reaches Express (401, not 400)', `status=${login.status}`);

// the same call when the platform already consumed the body into a plain property (second code path of the entry)
const spoofed = await call('GET', '/api/v1/health', null, { 'x-forwarded-for': '203.0.113.9' });
check(spoofed.status === 200, 'request with X-Forwarded-For is served');

// real browsers send cookies: signed-out /auth/me must be a clean 401 JSON
const me = await call('GET', '/api/v1/auth/me');
check(me.status === 401 && me.json?.success === false, 'GET /api/v1/auth/me without a session -> 401 JSON');

server.close();

if (process.argv.includes('--trace')) {
  let nft;
  try {
    nft = await import('@vercel/nft');
  } catch {
    console.log('SKIP trace: run `npm i --no-save @vercel/nft` first');
  }
  if (nft) {
    const { fileList } = await nft.nodeFileTrace([path.join(root, 'api/index.js')], { base: root, processCwd: root });
    const files = [...fileList].map((f) => f.replace(/\\/g, '/'));
    const has = (re) => files.filter((f) => re.test(f));
    console.log(`traced ${files.length} files`);
    check(has(/^backend\/dist\/app\.js$/).length === 1, 'bundle has backend/dist/app.js');
    check(has(/@prisma\/client\/default\.js$/).length > 0 && has(/@prisma\/client\/runtime\/library\.js$/).length > 0, 'bundle has @prisma/client and its runtime');
    const engines = has(/libquery_engine-.*\.so\.node$/);
    check(engines.some((f) => /rhel-openssl-3\.0\.x/.test(f)), 'bundle has the rhel-openssl-3.0.x Prisma engine', engines.map((f) => path.basename(f)).join(', ') || 'none traced');
    // The tracer picks bcrypt's prebuild for the machine it runs on (win32-x64 here, linux on Vercel's build).
    // What can be checked everywhere: the package ships the Linux prebuilds, and vercel.json forces them into the bundle.
    const shipped = path.join(root, 'node_modules/bcrypt/prebuilds/linux-x64');
    check(fs.existsSync(shipped) && fs.readdirSync(shipped).some((f) => /glibc/.test(f)), 'bcrypt ships a linux-x64 glibc prebuild', fs.existsSync(shipped) ? fs.readdirSync(shipped).join(', ') : 'missing');
    const inc = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).functions?.['api/index.js']?.includeFiles || '';
    check(/bcrypt\/prebuilds\/linux-x64/.test(inc), 'vercel.json force-includes the bcrypt linux-x64 prebuild');
    const traced = has(/bcrypt\/prebuilds\/.*\.node$/);
    console.log(`info bcrypt prebuild traced on this host (${process.platform}): ${traced.map((f) => f.split('/').slice(-2).join('/')).join(', ') || 'none'}`);
    check(has(/^node_modules\/express\/index\.js$/).length === 1, 'bundle has express');
  }
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
