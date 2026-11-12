// Static checks for the Vercel deployment files. No network, no database. Run: node scripts/check-vercel.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
let failed = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? '  [' + detail + ']' : ''}`);
  if (!ok) failed += 1;
};

let cfg = {};
try {
  cfg = JSON.parse(read('vercel.json'));
  check(true, 'vercel.json is valid JSON');
} catch (e) {
  check(false, 'vercel.json is valid JSON', e.message);
}

// 1. routing: the API lives in one function, the site is the static build
const rewrite = (cfg.rewrites || []).find((r) => r.source === '/api/(.*)');
check(rewrite && rewrite.destination === '/api', 'rewrite /api/(.*) -> /api (one function, original URL kept)');
check(cfg.outputDirectory === 'frontend/dist', 'static output is frontend/dist (the Vite build)', String(cfg.outputDirectory));
check(/prisma:generate/.test(cfg.buildCommand || '') && /npm run build/.test(cfg.buildCommand || ''), 'build runs prisma generate before the workspace builds');
check(cfg.installCommand === 'npm ci', 'install uses the lockfile (npm ci)');

// 2. every configured function points at a real file, and the entry keeps the body for Express
for (const file of Object.keys(cfg.functions || {})) check(exists(file), `function file exists: ${file}`);
const entry = exists('api/index.js') ? read('api/index.js') : '';
check(/bodyParser:\s*false/.test(entry) && /leaveBodyToExpress/.test(entry), 'api/index.js leaves the request body to Express');
check(/webRoot:\s*null/.test(entry), 'api/index.js serves the API only (the CDN serves the site)');
check(/getJwtSecret\(\)/.test(entry), 'api/index.js fails fast on a missing JWT secret');
check(Number(cfg.functions?.['api/index.js']?.maxDuration) >= 30, 'maxDuration allows a GitHub import (>= 30 s)', String(cfg.functions?.['api/index.js']?.maxDuration));

// 3. security headers on the static site must match what helmet gives the API (script-src 'self', no inline scripts)
const siteHeaders = (cfg.headers || []).find((h) => /\(\?!api\//.test(h.source || ''));
const csp = (siteHeaders?.headers || []).find((h) => h.key === 'Content-Security-Policy')?.value || '';
check(/script-src 'self'(;|$)/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), "CSP keeps script-src 'self' with no unsafe-inline");
check(/object-src 'none'/.test(csp) && /frame-ancestors 'self'/.test(csp), 'CSP blocks plugins and foreign framing');
check((siteHeaders?.headers || []).some((h) => h.key === 'X-Content-Type-Options' && h.value === 'nosniff'), 'nosniff header set');
check(!exists('frontend/index.html') || !/<script(?![^>]*\bsrc=)[^>]*>/i.test(read('frontend/index.html')), 'index.html has no inline script (CSP would block it)');

// 4. Prisma engine for the Linux functions
check(/binaryTargets\s*=\s*\[[^\]]*"rhel-openssl-3\.0\.x"/.test(read('backend/prisma/schema.prisma')), 'schema.prisma targets rhel-openssl-3.0.x');

// 5. upload filter must not drop anything the build needs
const ignore = read('.vercelignore').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const needed = ['backend', 'frontend', 'api', 'package.json', 'package-lock.json', 'vercel.json', 'backend/prisma', 'backend/src', 'frontend/src', 'frontend/public', 'backend/tsconfig.json'];
check(needed.every((n) => !ignore.includes(n) && !ignore.includes(n + '/')), '.vercelignore keeps everything the build needs');

// 6. no secrets in the deployment files
const blob = [read('vercel.json'), entry, read('.vercelignore')].join('\n');
check(!/(postgres(ql)?:\/\/[^\s"']*:[^\s"']+@|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{30,})/.test(blob), 'no credentials in vercel.json, api/index.js or .vercelignore');

// 7. environment variables the docs promise are really read by the code
const envDoc = exists('docs/DEPLOY_VERCEL.md') ? read('docs/DEPLOY_VERCEL.md') : '';
for (const name of ['DATABASE_URL', 'JWT_SECRET', 'TRUST_PROXY']) {
  check(envDoc.includes(name), `docs/DEPLOY_VERCEL.md names ${name}`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
