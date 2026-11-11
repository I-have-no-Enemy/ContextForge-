// Static checks for deliverables that unit tests do not cover. Exit 1 on any failure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const failures = [];
const check = (ok, msg) => (ok ? console.log(`ok   ${msg}`) : failures.push(msg));

// docs/API.md lists every route in the Core Endpoints table
const rows = read('docs/API.md').split('\n').filter((l) => /^\| \d+ \| (GET|POST|PUT|PATCH|DELETE) \|/.test(l));
check(rows.length >= 29, `docs/API.md has ${rows.length} endpoint rows (>= 29)`);

// Postman files parse and the collection has requests
const collection = JSON.parse(read('docs/postman/ContextForge.postman_collection.json'));
JSON.parse(read('docs/postman/local.postman_environment.json'));
const requests = collection.item.flatMap((f) => f.item ?? []);
check(requests.length >= 40, `Postman collection has ${requests.length} requests (>= 40)`);

// No demo credentials shipped in the UI
check(!/Fill (Developer|Admin)|Password123!/.test(read('frontend/src/components/AuthDialog.tsx')), 'AuthDialog has no demo credentials');

// Hero media from Google Flow: present and inside the 3 MB page budget
import { statSync } from 'node:fs';
const media = ['frontend/public/media/hero.mp4', 'frontend/public/media/hero-poster.webp'].map((p) => {
  try {
    return statSync(join(root, p)).size;
  } catch {
    return -1;
  }
});
check(media.every((s) => s > 0), 'hero video and poster exist');
check(media.reduce((a, b) => a + Math.max(b, 0), 0) <= 3 * 1024 * 1024, `hero media ${(media.reduce((a, b) => a + Math.max(b, 0), 0) / 1024).toFixed(0)} KB (<= 3 MB)`);

if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
