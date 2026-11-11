import { Prisma, ReviewItemType, ReviewStatus, ToolRiskLevel } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { SecurityScanner } from './scanner.service.js';

/**
 * Imports AI skills (SKILL.md) and MCP servers from public GitHub repositories (spec: contextforge-import-fixes).
 *
 * Trust model: everything fetched is untrusted text (OWASP LLM01). It is parsed, scanned, stored as
 * data and queued for an admin; it is never executed here. The only hosts this module talks to are
 * api.github.com and raw.githubusercontent.com (OWASP A10), and a stored install_command must pass a
 * strict allowlist because users copy it into a client that does execute it (OWASP A03, LLM05).
 */

export type ImportKind = 'skill' | 'mcp';

export interface ImportOptions {
  url: string;
  kind: ImportKind;
  submittedBy: string;
  /** Maximum number of NEW listings to create in this call. */
  limit?: number;
  dryRun?: boolean;
  db?: Pick<typeof prisma, 'aiSkill' | 'mcpServer' | '$transaction'>;
  fetchImpl?: typeof fetch;
  token?: string;
  timeoutMs?: number;
}

export interface ImportedItem {
  kind: ImportKind;
  name: string;
  source_url: string;
  license: string | null;
  flagged_by_scan?: boolean;
  tools?: number;
}

export interface ImportSummary {
  source: string;
  kind: ImportKind;
  dry_run: boolean;
  created: ImportedItem[];
  skipped: Array<{ name: string; reason: string }>;
  failed: Array<{ name: string; reason: string }>;
  /** true when the run stopped early (GitHub rate limit); running it again continues, because import is idempotent. */
  partial: boolean;
  stopped_reason?: string;
  api_calls: number;
  rate_remaining: number | null;
}

export class ImportInputError extends Error {}
class RateLimited extends Error {}

const SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;
const MAX_FILE_CHARS = 100_000;
const MAX_LIMIT = 100;
const SKILLS_PER_REPO = 40;

// ---------------------------------------------------------------- URL parsing

export type Source =
  | { type: 'topic'; topic: string }
  | { type: 'repo'; owner: string; repo: string; ref?: string; path?: string };

/** Accepts only https://github.com/topics/<topic> and https://github.com/<owner>/<repo>[/tree/<ref>/<path>]. */
export function parseSource(raw: string): Source | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.username || u.password || u.port) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts[0] === 'topics') {
    return parts[1] && /^[a-z0-9][a-z0-9-]{0,49}$/.test(parts[1]) ? { type: 'topic', topic: parts[1] } : null;
  }
  const [owner, rawRepo, kind, ref, ...rest] = parts;
  const repo = rawRepo?.replace(/\.git$/, '');
  if (!owner || !repo || !SEGMENT.test(owner) || !SEGMENT.test(repo) || owner === '..' || repo === '..') return null;
  if (!kind) return { type: 'repo', owner, repo };
  if (kind !== 'tree' || !ref || !SEGMENT.test(ref) || ref === '..') return null;
  if (rest.some((p) => !/^[A-Za-z0-9_.@ -]{1,100}$/.test(p) || p === '..')) return null;
  return { type: 'repo', owner, repo, ref, path: rest.join('/') || undefined };
}

// ---------------------------------------------------------------- GitHub client

interface RepoInfo {
  owner: string;
  repo: string;
  html_url: string;
  default_branch: string;
  license: string | null;
  stars: number;
  description: string | null;
}

function makeClient(fetchImpl: typeof fetch, token: string | undefined, timeoutMs: number) {
  const state = { calls: 0, remaining: null as number | null };
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'contextforge-import',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const note = (res: Response) => {
    state.calls += 1;
    const rem = res.headers.get('x-ratelimit-remaining');
    if (rem !== null) state.remaining = Number(rem);
  };
  const exhausted = (res: Response) =>
    (res.status === 403 || res.status === 429) && (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429);

  /** `path` must start with "/" and is appended to api.github.com; no caller can choose the host. */
  async function api<T>(path: string): Promise<T | null> {
    const res = await fetchImpl(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    note(res);
    if (exhausted(res)) throw new RateLimited('GitHub rate limit reached');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    return (await res.json()) as T;
  }

  /** Raw files do not count against the REST quota. Returns null when the file does not exist. */
  async function raw(owner: string, repo: string, ref: string, path: string): Promise<string | null> {
    const segs = path.split('/');
    if (segs.some((s) => s === '..' || s === '')) throw new Error('invalid path');
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${segs.map(encodeURIComponent).join('/')}`;
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'contextforge-import' }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 429) throw new RateLimited('GitHub rate limit reached');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`raw.githubusercontent.com responded ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_FILE_CHARS) throw new Error(`file larger than ${MAX_FILE_CHARS} characters`);
    return text;
  }

  const toInfo = (j: any): RepoInfo => ({
    owner: j.owner?.login,
    repo: j.name,
    html_url: j.html_url,
    default_branch: j.default_branch || 'main',
    license: j.license?.spdx_id && j.license.spdx_id !== 'NOASSERTION' ? String(j.license.spdx_id) : null,
    stars: Number(j.stargazers_count) || 0,
    description: j.description ?? null,
  });

  return {
    state,
    api,
    raw,
    async repoInfo(owner: string, repo: string): Promise<RepoInfo | null> {
      const j = await api<any>(`/repos/${owner}/${repo}`);
      return j ? toInfo(j) : null;
    },
    /** One request returns stars, license and branch for every hit, sorted by stars. */
    async searchTopic(topic: string, perPage: number): Promise<RepoInfo[]> {
      const j = await api<{ items: any[] }>(
        `/search/repositories?q=${encodeURIComponent(`topic:${topic}`)}&sort=stars&order=desc&per_page=${perPage}`
      );
      return (j?.items ?? []).map(toInfo).filter((i) => i.owner && i.repo && SEGMENT.test(i.owner) && SEGMENT.test(i.repo));
    },
    /** Commit sha plus the files of a repo at that commit, so later fetches are pinned to one snapshot. */
    async snapshot(info: RepoInfo, ref?: string): Promise<{ sha: string; paths: string[] } | null> {
      const commit = await api<any>(`/repos/${info.owner}/${info.repo}/commits/${encodeURIComponent(ref ?? info.default_branch)}`);
      if (!commit?.sha || !commit?.commit?.tree?.sha) return null;
      const tree = await api<any>(`/repos/${info.owner}/${info.repo}/git/trees/${commit.commit.tree.sha}?recursive=1`);
      const paths: string[] = (tree?.tree ?? []).filter((t: any) => t.type === 'blob').map((t: any) => String(t.path));
      return { sha: String(commit.sha), paths };
    },
  };
}
type Client = ReturnType<typeof makeClient>;

// ---------------------------------------------------------------- parsing helpers

const clean = (s: string) => s.replace(/\*\*|`|\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();

/** `Some Skill_v2` -> `some-skill_v2`; must satisfy the same rule as hand-submitted names. */
export function normalizeName(raw: string): string | null {
  const n = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 100);
  return n.length >= 3 ? n : null;
}

export function parseSkillMd(text: string, fallbackName: string): { name: string; description: string } {
  const fm: Record<string, string> = {};
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let body = text;
  if (m) {
    body = text.slice(m[0].length);
    const lines = m[1].split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const kv = lines[i].match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (!kv) continue;
      let value = kv[2].trim();
      if (/^[>|][-+]?$/.test(value) || value === '') {
        const folded: string[] = [];
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) folded.push(lines[++i].trim());
        value = folded.join(' ');
      }
      fm[kv[1].toLowerCase()] = value.replace(/^["']|["']$/g, '');
    }
  }
  const firstParagraph = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('```'));
  return {
    name: fm.name || fallbackName,
    description: (fm.description || (firstParagraph ? clean(firstParagraph) : '')).slice(0, 500),
  };
}

const SAFE_INSTALL = /^(npx|uvx|docker run)( [A-Za-z0-9@._/:=+,~-]+)+$/;

/** An install command is stored only when it is a plain npx / uvx / docker run line with no shell syntax. */
export function safeInstallCommand(cmd: string): string | null {
  // A second line would be a second command, so it is rejected before whitespace is normalised.
  if (/[\r\n]/.test(cmd.trim())) return null;
  const one = cmd.replace(/\\\s*$/, '').replace(/\s+/g, ' ').trim();
  return one.length <= 255 && SAFE_INSTALL.test(one) ? one : null;
}

export interface ParsedReadme {
  install_command: string | null;
  env: string[];
  tools: Array<{ name: string; description: string }>;
}

export function parseMcpReadme(readme: string): ParsedReadme {
  // --- install command: the first safe candidate in document order
  const found: Array<{ at: number; cmd: string }> = [];
  for (const m of readme.matchAll(/"command"\s*:\s*"(npx|uvx|docker)"\s*,\s*"args"\s*:\s*\[([^\]]*)\]/g)) {
    const args = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((a) => a[1]);
    found.push({ at: m.index ?? 0, cmd: `${m[1]} ${args.join(' ')}` });
  }
  for (const m of readme.matchAll(/(?:^|[\s`$])((?:npx|uvx)\s+[^\n`]+|docker\s+run\s+[^\n`]+)/g)) {
    found.push({ at: m.index ?? 0, cmd: m[1] });
  }
  found.sort((a, b) => a.at - b.at);
  let install: string | null = null;
  for (const f of found) {
    install = safeInstallCommand(f.cmd);
    if (install) break;
  }

  // --- env var names, from `-e NAME` flags and "env": { "NAME": ... } blocks
  const env = new Set<string>();
  for (const m of (install ?? '').matchAll(/(?:^|\s)-e ([A-Z][A-Z0-9_]+)/g)) env.add(m[1]);
  for (const block of readme.matchAll(/"env"\s*:\s*\{([^}]*)\}/g)) {
    for (const k of block[1].matchAll(/"([A-Z][A-Z0-9_]{2,})"\s*:/g)) env.add(k[1]);
  }

  return { install_command: install, env: [...env].slice(0, 10), tools: extractTools(readme) };
}

function extractTools(readme: string): Array<{ name: string; description: string }> {
  const tools: Array<{ name: string; description: string }> = [];
  const seen = new Set<string>();
  const add = (name: string, description: string) => {
    if (!/^[A-Za-z][\w.-]{1,63}$/.test(name) || seen.has(name) || tools.length >= 40) return null;
    seen.add(name);
    const tool = { name, description: clean(description).slice(0, 300) };
    tools.push(tool);
    return tool;
  };

  let inSection = false;
  let sectionLevel = 0;
  let last: { name: string; description: string } | null = null;
  for (const line of readme.split(/\r?\n/)) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const title = h[2].trim();
      if (/^(available |list of )?tools?( list)?\b/i.test(title) && !/toolset/i.test(title)) {
        inSection = true;
        sectionLevel = level;
      } else if (inSection && level <= sectionLevel) {
        inSection = false;
      } else if (inSection) {
        const named = title.match(/^`([A-Za-z][\w.-]{1,63})`$/);
        if (named) last = add(named[1], '');
      }
      continue;
    }
    if (/^\*\*\s*tools?\s*\*\*\s*:?\s*$/i.test(line.trim()) || /^tools?:\s*$/i.test(line.trim())) {
      inSection = true;
      sectionLevel = 7;
      continue;
    }
    if (!inSection) continue;

    const bullet = line.match(/^\s*[-*]\s+(?:\*\*|`)([A-Za-z][\w.-]{1,63})(?:\*\*|`)\s*(?:[-–—:]\s*)?(.*)$/);
    if (bullet && !/^\s{2,}/.test(line)) {
      last = add(bullet[1], bullet[2]);
      continue;
    }
    const row = line.match(/^\|\s*`?([A-Za-z][\w.-]{1,63})`?\s*\|\s*(.+?)\s*\|/);
    if (row && !/^(tool|name)$/i.test(row[1])) {
      last = add(row[1], row[2]);
      continue;
    }
    const nested = line.match(/^\s{2,}[-*]\s+(.*)$/);
    if (nested && last && !last.description) last.description = clean(nested[1]).slice(0, 300);
  }
  return tools;
}

/**
 * Keyword guess at what a tool can touch. It is a starting point, not a verdict: the review note says
 * so, and an unknown tool is assumed to reach the network rather than to be harmless.
 */
export function classifyRisk(name: string, description: string): ToolRiskLevel {
  const text = `${name} ${description}`.toLowerCase().replace(/[_-]/g, ' ');
  if (/\b(delete|remove|drop|destroy|truncate|kill|reset|overwrite|wipe|exec|execute|eval|shell|command|migration|migrate|write|edit|move|rename|push|merge|deploy|install|upload)\b/.test(text)) return ToolRiskLevel.destructive;
  if (/\b(file|files|directory|directories|folder|path|disk|filesystem)\b/.test(text)) return ToolRiskLevel.filesystem;
  return ToolRiskLevel.network;
}

// ---------------------------------------------------------------- orchestration

export async function importFromGithub(opts: ImportOptions): Promise<ImportSummary> {
  const {
    url, kind, submittedBy, dryRun = false, db = prisma, fetchImpl = fetch,
    token = process.env.GITHUB_PAT, timeoutMs = 10_000,
  } = opts;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(opts.limit ?? 20)));

  const source = parseSource(url);
  if (!source) throw new ImportInputError('Only https://github.com/<owner>/<repo> or https://github.com/topics/<topic> URLs are accepted.');

  const client = makeClient(fetchImpl, token, timeoutMs);
  const summary: ImportSummary = {
    source: url, kind, dry_run: dryRun, created: [], skipped: [], failed: [], partial: false,
    api_calls: 0, rate_remaining: null,
  };
  const ctx: Ctx = { client, db, submittedBy, dryRun, limit, summary };

  try {
    if (kind === 'skill') await importSkills(ctx, source);
    else await importMcp(ctx, source);
  } catch (err) {
    if (err instanceof RateLimited) {
      summary.partial = true;
      summary.stopped_reason = 'GitHub rate limit reached; run the import again later or set GITHUB_PAT for a higher quota.';
    } else {
      throw err;
    }
  }
  summary.api_calls = client.state.calls;
  summary.rate_remaining = client.state.remaining;
  console.info('[ContextForge GitHub Import]', JSON.stringify({ source: url, kind, dryRun, created: summary.created.length, skipped: summary.skipped.length, failed: summary.failed.length, partial: summary.partial, api_calls: summary.api_calls }));
  return summary;
}

interface Ctx {
  client: Client;
  db: NonNullable<ImportOptions['db']>;
  submittedBy: string;
  dryRun: boolean;
  limit: number;
  summary: ImportSummary;
}
const full = (c: Ctx) => c.summary.created.length >= c.limit;

async function reposFor(c: Ctx, s: Source, maxRepos: number): Promise<Array<{ info: RepoInfo; ref?: string; path?: string }>> {
  if (s.type === 'topic') return (await c.client.searchTopic(s.topic, maxRepos)).map((info) => ({ info }));
  const info = await c.client.repoInfo(s.owner, s.repo);
  return info ? [{ info, ref: s.ref, path: s.path }] : [];
}

async function importSkills(c: Ctx, s: Source) {
  for (const { info, ref, path } of await reposFor(c, s, 15)) {
    if (full(c)) break;
    const snap = await c.client.snapshot(info, ref);
    if (!snap) {
      c.summary.skipped.push({ name: `${info.owner}/${info.repo}`, reason: 'repository or branch not found' });
      continue;
    }
    const prefix = path ? `${path}/` : '';
    const files = snap.paths
      .filter((p) => /(^|\/)skill\.md$/i.test(p) && !/(^|\/)(node_modules|\.git)\//.test(p) && p.startsWith(prefix))
      .slice(0, SKILLS_PER_REPO);
    if (files.length === 0) c.summary.skipped.push({ name: `${info.owner}/${info.repo}`, reason: 'no SKILL.md found' });

    for (const file of files) {
      if (full(c)) break;
      const label = `${info.owner}/${info.repo}/${file}`;
      try {
        const text = await c.client.raw(info.owner, info.repo, snap.sha, file);
        if (!text) {
          c.summary.skipped.push({ name: label, reason: 'file not readable' });
          continue;
        }
        const dir = file.split('/').slice(-2, -1)[0] || info.repo;
        const parsed = parseSkillMd(text, dir);
        const sourceUrl = `${info.html_url}/blob/${snap.sha}/${file}`.slice(0, 512);
        await saveSkill(c, info, snap.sha, sourceUrl, parsed, text, label);
      } catch (err) {
        if (err instanceof RateLimited) throw err;
        c.summary.failed.push({ name: label, reason: err instanceof Error ? err.message : String(err) });
      }
    }
  }
}

async function freeName(
  exists: (name: string) => Promise<{ source_url: string | null } | null>,
  base: string,
  owner: string,
  sourceUrl: string
): Promise<{ name: string } | { skip: string }> {
  for (const candidate of [base, normalizeName(`${base}-${owner}`)]) {
    if (!candidate) continue;
    const hit = await exists(candidate);
    if (!hit) return { name: candidate };
    if (hit.source_url === sourceUrl) return { skip: 'already imported' };
  }
  return { skip: 'name already used by another listing' };
}

async function saveSkill(c: Ctx, info: RepoInfo, sha: string, sourceUrl: string, parsed: { name: string; description: string }, content: string, label: string) {
  const base = normalizeName(parsed.name);
  if (!base) {
    c.summary.skipped.push({ name: label, reason: 'skill name is empty or shorter than 3 characters' });
    return;
  }
  const picked = await freeName((name) => c.db.aiSkill.findUnique({ where: { name }, select: { source_url: true } }), base, info.owner.toLowerCase(), sourceUrl);
  if ('skip' in picked) {
    c.summary.skipped.push({ name: base, reason: picked.skip });
    return;
  }
  const scan = SecurityScanner.scanSkillContent(content);
  const item: ImportedItem = { kind: 'skill', name: picked.name, source_url: sourceUrl, license: info.license, flagged_by_scan: scan.prompt_injection_detected };
  if (c.dryRun) {
    c.summary.created.push(item);
    return;
  }
  try {
    await c.db.$transaction(async (tx) => {
      const skill = await tx.aiSkill.create({
        data: {
          name: picked.name,
          description: parsed.description || null,
          skill_content: content,
          tags: ['github', info.owner.toLowerCase()],
          scan_flags: scan as unknown as Prisma.InputJsonValue,
          is_verified: false,
          submitted_by: c.submittedBy,
          source_url: sourceUrl,
          source_license: info.license,
          source_ref: sha.slice(0, 40),
        },
      });
      await tx.submissionReview.create({
        data: {
          item_type: ReviewItemType.skill,
          item_id: skill.skill_id,
          reviewer_id: c.submittedBy,
          status: ReviewStatus.pending,
          flagged_by_scan: scan.prompt_injection_detected,
          review_notes:
            `Imported from ${sourceUrl} (license: ${info.license ?? 'none declared'}). ` +
            (scan.prompt_injection_detected ? `SECURITY SCAN ALERT: ${scan.flags.join('; ')}` : 'Automated heuristic scan passed cleanly with zero injection flags.'),
        },
      });
    });
    c.summary.created.push(item);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      c.summary.skipped.push({ name: picked.name, reason: 'name already used by another listing' });
      return;
    }
    throw err;
  }
}

interface McpCandidate {
  info: RepoInfo;
  readme: string;
  sourceUrl: string;
  sourceRef: string;
  nameHint: string;
}

async function importMcp(c: Ctx, s: Source) {
  for await (const cand of mcpCandidates(c, s)) {
    if (full(c)) break;
    try {
      await saveMcp(c, cand);
    } catch (err) {
      if (err instanceof RateLimited) throw err;
      c.summary.failed.push({ name: cand.nameHint, reason: err instanceof Error ? err.message : String(err) });
    }
  }
}

async function* mcpCandidates(c: Ctx, s: Source): AsyncGenerator<McpCandidate> {
  const readmeOf = async (info: RepoInfo, ref: string, path = 'README.md') => (await c.client.raw(info.owner, info.repo, ref, path)) ?? '';

  if (s.type === 'topic') {
    for (const info of await c.client.searchTopic(s.topic, Math.min(50, c.limit * 3))) {
      yield { info, readme: await readmeOf(info, info.default_branch), sourceUrl: info.html_url, sourceRef: info.default_branch, nameHint: info.repo };
    }
    return;
  }

  const info = await c.client.repoInfo(s.owner, s.repo);
  if (!info) return;

  // An "awesome" list: its README links to many repositories; each linked repo becomes a candidate.
  if (/awesome/i.test(info.repo)) {
    const list = await readmeOf(info, info.default_branch);
    const seen = new Set<string>([`${info.owner}/${info.repo}`.toLowerCase()]);
    for (const m of list.matchAll(/\]\(https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?\)/g)) {
      const key = `${m[1]}/${m[2]}`.toLowerCase();
      if (seen.has(key) || !SEGMENT.test(m[1]) || !SEGMENT.test(m[2])) continue;
      seen.add(key);
      if (seen.size > c.limit * 4) break;
      const cand = await c.client.repoInfo(m[1], m[2]);
      if (!cand) continue;
      yield { info: cand, readme: await readmeOf(cand, cand.default_branch), sourceUrl: cand.html_url, sourceRef: cand.default_branch, nameHint: cand.repo };
    }
    return;
  }

  const snap = await c.client.snapshot(info, s.ref);
  if (!snap) return;
  // A monorepo of servers (modelcontextprotocol/servers): one README per src/<name>/.
  const dirs = snap.paths.map((p) => p.match(/^((?:src\/)[^/]+)\/README\.md$/)?.[1]).filter((d): d is string => !!d);
  if (dirs.length >= 3) {
    for (const dir of dirs) {
      yield { info, readme: await readmeOf(info, snap.sha, `${dir}/README.md`), sourceUrl: `${info.html_url}/tree/${snap.sha}/${dir}`.slice(0, 512), sourceRef: snap.sha, nameHint: dir.split('/')[1] };
    }
    return;
  }
  yield { info, readme: await readmeOf(info, snap.sha), sourceUrl: info.html_url, sourceRef: snap.sha, nameHint: info.repo };
}

async function saveMcp(c: Ctx, cand: McpCandidate) {
  const { info } = cand;
  const parsed = parseMcpReadme(cand.readme);
  if (!parsed.install_command) {
    c.summary.skipped.push({ name: cand.nameHint, reason: 'no npx, uvx or docker run command found in the README' });
    return;
  }
  if (parsed.tools.length === 0) {
    c.summary.skipped.push({ name: cand.nameHint, reason: 'no tool list found in the README, so the risk level would be a guess' });
    return;
  }
  const base = normalizeName(cand.nameHint);
  if (!base) {
    c.summary.skipped.push({ name: cand.nameHint, reason: 'server name is empty or shorter than 3 characters' });
    return;
  }
  const picked = await freeName((name) => c.db.mcpServer.findUnique({ where: { name }, select: { source_url: true } }), base, info.owner.toLowerCase(), cand.sourceUrl);
  if ('skip' in picked) {
    c.summary.skipped.push({ name: base, reason: picked.skip });
    return;
  }
  const tools = parsed.tools.map((t) => ({ name: t.name, description: t.description || null, risk_level: classifyRisk(t.name, t.description) }));
  const item: ImportedItem = { kind: 'mcp', name: picked.name, source_url: cand.sourceUrl, license: info.license, tools: tools.length };
  if (c.dryRun) {
    c.summary.created.push(item);
    return;
  }
  try {
    await c.db.$transaction(async (tx) => {
      const server = await tx.mcpServer.create({
        data: {
          name: picked.name,
          description: (info.description || '').slice(0, 1000) || null,
          repository_url: info.html_url.slice(0, 255),
          install_command: parsed.install_command!,
          required_env_vars: parsed.env,
          is_verified: false,
          submitted_by: c.submittedBy,
          github_stars: info.stars,
          github_last_synced_at: new Date(),
          source_url: cand.sourceUrl,
          source_license: info.license,
          source_ref: cand.sourceRef.slice(0, 40),
          tools: { create: tools },
        },
      });
      await tx.submissionReview.create({
        data: {
          item_type: ReviewItemType.server,
          item_id: server.server_id,
          reviewer_id: c.submittedBy,
          status: ReviewStatus.pending,
          flagged_by_scan: false,
          review_notes:
            `Imported from ${cand.sourceUrl} (license: ${info.license ?? 'none declared'}). ` +
            `The install command and ${tools.length} tools were read from the README. ` +
            'Tool risk levels are a keyword guess and are unconfirmed: check them before approving.',
        },
      });
    });
    c.summary.created.push(item);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      c.summary.skipped.push({ name: picked.name, reason: 'name already used by another listing' });
      return;
    }
    throw err;
  }
}
