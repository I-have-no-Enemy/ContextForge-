// Imports skills or MCP servers from a GitHub URL into the review queue (same code path as POST /admin/import/github).
// Usage: npm run import:github -- <url> --kind skill|mcp [--limit 20] [--min-stars 100] [--apply] [--as admin@contextforge.dev]
// Without --apply nothing is written (dry run). GITHUB_PAT raises the quota from 60 to 5,000 requests an hour.
import '../src/loadEnv.js';
import { prisma } from '../src/config/prisma.js';
import { ImportInputError, importFromGithub } from '../src/services/githubImport.service.js';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = args.find((a) => a.startsWith('https://'));
const kind = flag('kind');
const apply = args.includes('--apply');
const submitterEmail = flag('as') ?? 'admin@contextforge.dev';

if (!url || (kind !== 'skill' && kind !== 'mcp')) {
  console.error('Usage: npm run import:github -- <https://github.com/...> --kind skill|mcp [--limit N] [--min-stars N] [--apply] [--as email]');
  process.exit(2);
}

try {
  const submitter = await prisma.user.findUnique({ where: { email: submitterEmail }, select: { user_id: true } });
  if (!submitter) throw new Error(`No account with email ${submitterEmail}; pass --as with an existing admin or developer email.`);

  const s = await importFromGithub({ url, kind, limit: flag('limit') ? Number(flag('limit')) : 20, minStars: flag('min-stars') ? Number(flag('min-stars')) : 0, dryRun: !apply, submittedBy: submitter.user_id });
  for (const c of s.created) console.log(`${apply ? 'queued ' : 'would  '} ${c.name}  [${c.license ?? 'no license'}]${c.tools !== undefined ? `  ${c.tools} tools` : ''}${c.flagged_by_scan ? '  SCANNER FLAGGED' : ''}`);
  for (const k of s.skipped) console.log(`skipped  ${k.name}: ${k.reason}`);
  for (const f of s.failed) console.log(`failed   ${f.name}: ${f.reason}`);
  console.log(
    `${apply ? 'created' : 'would create'} ${s.created.length}, skipped ${s.skipped.length}, failed ${s.failed.length}; ` +
      `${s.api_calls} GitHub calls, ${s.rate_remaining ?? 'unknown'} left this hour${s.partial ? `\nSTOPPED EARLY: ${s.stopped_reason}` : ''}`
  );
  process.exitCode = s.failed.length ? 1 : 0;
} catch (err) {
  console.error(err instanceof ImportInputError ? err.message : err instanceof Error ? err.message : err);
  process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
