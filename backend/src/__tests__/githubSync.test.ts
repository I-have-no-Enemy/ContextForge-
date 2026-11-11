import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../config/prisma.js';
import { syncGithubMetrics, parseGithubRepo } from '../services/githubSync.service.js';
import { makeServer, makeUser, resetDb } from '../test/factories.js';

// The database is real. Only GitHub's HTTP API is replaced: tests must not depend on
// api.github.com availability or spend its rate limit.
function githubResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: init.headers });
}

beforeEach(resetDb);

describe('parseGithubRepo (OWASP A10 SSRF guard)', () => {
  it('accepts only https://github.com/<owner>/<repo>', () => {
    expect(parseGithubRepo('https://github.com/modelcontextprotocol/servers')).toEqual({ owner: 'modelcontextprotocol', repo: 'servers' });
    expect(parseGithubRepo('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseGithubRepo('https://github.com/a/b/tree/main/src/filesystem')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseGithubRepo('http://169.254.169.254/latest')).toBeNull();
    expect(parseGithubRepo('https://github.com.evil.io/a/b')).toBeNull();
    expect(parseGithubRepo('https://gitlab.com/a/b')).toBeNull();
    expect(parseGithubRepo(null)).toBeNull();
  });
});

describe('syncGithubMetrics against the database (spec US5)', () => {
  it('writes stars, contributors (Link header last page) and the sync time', async () => {
    const owner = await makeUser();
    const s = await makeServer(owner, { repo: 'https://github.com/o/r' });
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('/contributors')
        ? githubResponse([{}], { headers: { link: '<https://api.github.com/repositories/1/contributors?per_page=1&anon=1&page=42>; rel="last"' } })
        : githubResponse({ stargazers_count: 1234 })
    );

    const summary = await syncGithubMetrics({ fetchImpl: fetchImpl as any, token: 'pat' });

    expect(summary).toMatchObject({ checked: 1, updated: 1, failed: [], skipped: 0 });
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: s.server_id } });
    expect(row).toMatchObject({ github_stars: 1234, github_contributors: 42 });
    expect(row.github_last_synced_at).toBeInstanceOf(Date);
    expect((fetchImpl.mock.calls[0] as any[])[1].headers.Authorization).toBe('Bearer pat');
  });

  it('AC9: a network error keeps the cached counts and never throws', async () => {
    const owner = await makeUser();
    const s = await makeServer(owner, { repo: 'https://github.com/o/r' });
    await prisma.mcpServer.update({ where: { server_id: s.server_id }, data: { github_stars: 77 } });

    const summary = await syncGithubMetrics({ fetchImpl: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')) });

    expect(summary.failed).toEqual([{ server_id: s.server_id, name: s.name, reason: 'ETIMEDOUT' }]);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: s.server_id } })).github_stars).toBe(77);
  });

  it('AC9: stops at the rate limit and skips the rest without touching them', async () => {
    const owner = await makeUser();
    for (const n of ['a', 'b', 'c']) await makeServer(owner, { name: `rl-${n}`, repo: `https://github.com/o/${n}` });
    const fetchImpl = vi.fn().mockResolvedValue(
      githubResponse({ message: 'API rate limit exceeded' }, { status: 403, headers: { 'x-ratelimit-remaining': '0' } })
    );

    const summary = await syncGithubMetrics({ fetchImpl });

    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].reason).toBe('GitHub rate limit reached');
    expect(summary.skipped).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await prisma.mcpServer.count({ where: { github_last_synced_at: { not: null } } })).toBe(0);
  });

  it('skips deleted servers and non-GitHub URLs', async () => {
    const owner = await makeUser();
    await makeServer(owner, { repo: 'https://example.com/x' });
    await makeServer(owner, { repo: 'https://github.com/o/gone', deleted: true });
    const fetchImpl = vi.fn();
    const summary = await syncGithubMetrics({ fetchImpl });
    expect(summary).toMatchObject({ checked: 1, updated: 0, skipped: 1 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
