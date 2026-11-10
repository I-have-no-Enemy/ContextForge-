import { prisma } from '../config/prisma.js';

export interface SyncSummary {
  checked: number;
  updated: number;
  skipped: number;
  failed: Array<{ server_id: string; name: string; reason: string }>;
}

interface SyncOptions {
  db?: Pick<typeof prisma, 'mcpServer'>;
  fetchImpl?: typeof fetch;
  token?: string;
  timeoutMs?: number;
}

const SEGMENT = /^[A-Za-z0-9_.-]+$/;

/**
 * Accepts only https://github.com/<owner>/<repo>[/...]. Anything else returns null,
 * so a stored repository_url can never steer the server at an internal host (OWASP A10).
 */
export function parseGithubRepo(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return null;
  const [owner, rawRepo] = parsed.pathname.split('/').filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/, '');
  if (!owner || !repo || !SEGMENT.test(owner) || !SEGMENT.test(repo)) return null;
  return { owner, repo };
}

class RateLimited extends Error {}

/**
 * Refreshes github_stars / github_contributors for every live server with a GitHub URL (spec US5).
 * Never throws: failures are reported per server and cached counts are left untouched.
 * Calls run sequentially and outside any DB transaction.
 */
export async function syncGithubMetrics({
  db = prisma,
  fetchImpl = fetch,
  token = process.env.GITHUB_PAT,
  timeoutMs = 8000,
}: SyncOptions = {}): Promise<SyncSummary> {
  const servers = await db.mcpServer.findMany({
    where: { is_deleted: false, repository_url: { not: null } },
    select: { server_id: true, name: true, repository_url: true },
  });

  const summary: SyncSummary = { checked: servers.length, updated: 0, skipped: 0, failed: [] };
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'contextforge-sync',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const getJson = async (url: string) => {
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
      throw new RateLimited('GitHub rate limit reached');
    }
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    return res;
  };

  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    const repo = parseGithubRepo(server.repository_url);
    if (!repo) {
      summary.skipped += 1;
      continue;
    }

    const base = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;
    try {
      const info = (await (await getJson(base)).json()) as { stargazers_count?: number };
      const contribRes = await getJson(`${base}/contributors?per_page=1&anon=1`);
      const lastPage = contribRes.headers.get('link')?.match(/[?&]page=(\d+)>; rel="last"/)?.[1];
      const contributors = lastPage ? Number(lastPage) : ((await contribRes.json()) as unknown[]).length;

      await db.mcpServer.update({
        where: { server_id: server.server_id },
        data: {
          github_stars: info.stargazers_count ?? 0,
          github_contributors: contributors,
          github_last_synced_at: new Date(),
        },
      });
      summary.updated += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      summary.failed.push({ server_id: server.server_id, name: server.name, reason });
      if (err instanceof RateLimited) {
        summary.skipped += servers.length - i - 1;
        break;
      }
    }
  }

  console.info('[ContextForge GitHub Sync]', JSON.stringify({ ...summary, failed: summary.failed.length }));
  return summary;
}
