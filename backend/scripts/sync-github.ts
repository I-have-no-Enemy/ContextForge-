// Runs the GitHub metrics sync once from the command line (same code path as POST /admin/sync/github).
// Usage: npm run sync:github   (uses GITHUB_PAT when set: 5,000 req/h instead of 60)
import '../src/loadEnv.js';
import { prisma } from '../src/config/prisma.js';
import { syncGithubMetrics } from '../src/services/githubSync.service.js';

const summary = await syncGithubMetrics();
for (const f of summary.failed) console.log(`failed: ${f.name} (${f.reason})`);
console.log(`checked ${summary.checked}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed.length}`);
await prisma.$disconnect();
process.exitCode = summary.failed.length ? 1 : 0;
