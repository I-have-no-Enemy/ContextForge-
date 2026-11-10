import { describe, it, expect, vi } from 'vitest';
import { syncGithubMetrics, parseGithubRepo } from '../services/githubSync.service.js';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: init.headers });
}

function fakeDb(servers: any[]) {
  return {
    mcpServer: {
      findMany: vi.fn().mockResolvedValue(servers),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('GitHub metrics sync (spec US5)', () => {
  it('accepts only https://github.com/<owner>/<repo> URLs (OWASP A10 SSRF guard)', () => {
    expect(parseGithubRepo('https://github.com/modelcontextprotocol/servers')).toEqual({ owner: 'modelcontextprotocol', repo: 'servers' });
    expect(parseGithubRepo('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseGithubRepo('https://github.com/a/b/tree/main/src')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseGithubRepo('http://169.254.169.254/latest')).toBeNull();
    expect(parseGithubRepo('https://github.com.evil.io/a/b')).toBeNull();
    expect(parseGithubRepo('https://gitlab.com/a/b')).toBeNull();
    expect(parseGithubRepo(null)).toBeNull();
  });

  it('updates stars and contributors (from the Link header last page) and timestamps the sync', async () => {
    const db = fakeDb([{ server_id: 's1', name: 'pg', repository_url: 'https://github.com/o/r' }]);
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('/contributors')
        ? jsonResponse([{}], { headers: { link: '<https://api.github.com/repositories/1/contributors?per_page=1&anon=1&page=42>; rel="last"' } })
        : jsonResponse({ stargazers_count: 1234 })
    );

    const summary = await syncGithubMetrics({ db, fetchImpl: fetchImpl as any, token: 'pat' });

    expect(summary).toMatchObject({ checked: 1, updated: 1, failed: [], skipped: 0 });
    const data = db.mcpServer.update.mock.calls[0][0].data;
    expect(data.github_stars).toBe(1234);
    expect(data.github_contributors).toBe(42);
    expect(data.github_last_synced_at).toBeInstanceOf(Date);
    expect((fetchImpl.mock.calls[0] as any[])[1].headers.Authorization).toBe('Bearer pat');
  });

  it('AC9: a network error keeps cached counts and never throws', async () => {
    const db = fakeDb([{ server_id: 's1', name: 'pg', repository_url: 'https://github.com/o/r' }]);
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    const summary = await syncGithubMetrics({ db, fetchImpl, token: undefined });

    expect(summary.updated).toBe(0);
    expect(summary.failed).toEqual([{ server_id: 's1', name: 'pg', reason: 'ETIMEDOUT' }]);
    expect(db.mcpServer.update).not.toHaveBeenCalled();
  });

  it('AC9: stops at the rate limit and skips the rest without touching their counts', async () => {
    const db = fakeDb([
      { server_id: 's1', name: 'a', repository_url: 'https://github.com/o/a' },
      { server_id: 's2', name: 'b', repository_url: 'https://github.com/o/b' },
      { server_id: 's3', name: 'c', repository_url: 'https://github.com/o/c' },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ message: 'API rate limit exceeded' }, { status: 403, headers: { 'x-ratelimit-remaining': '0' } })
    );

    const summary = await syncGithubMetrics({ db, fetchImpl });

    expect(summary.failed).toEqual([{ server_id: 's1', name: 'a', reason: 'GitHub rate limit reached' }]);
    expect(summary.skipped).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(db.mcpServer.update).not.toHaveBeenCalled();
  });

  it('counts servers without a GitHub URL as skipped, not failed', async () => {
    const db = fakeDb([{ server_id: 's1', name: 'local', repository_url: 'https://example.com/x' }]);
    const summary = await syncGithubMetrics({ db, fetchImpl: vi.fn() });
    expect(summary).toMatchObject({ checked: 1, updated: 0, failed: [], skipped: 1 });
  });
});
