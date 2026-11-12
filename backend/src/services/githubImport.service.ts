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
  /** For topic and awesome-list sources: ignore repositories with fewer GitHub stars than this. */
  minStars?: number;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  token?: string;
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
const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const REQUEST_TIMEOUT_MS = 10_000;
class RateLimited extends Error {}

const SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;
const MAX_FILE_CHARS = 100_000;
const MAX_README_CHARS = 300_000; // READMEs are cut, not rejected: only the install command and tool list are read
const MAX_LIMIT = 100;
const SKILLS_PER_REPO = 40;
const BULK_DIR_SIZE = 50;
const BULK_DIR_KEEP = 3;

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

/** The few fields read from GitHub's JSON; everything else is ignored. */
interface GhRepo { owner?: { login?: string }; name?: string; html_url?: string; default_branch?: string; license?: { spdx_id?: string } | null; stargazers_count?: number; description?: string | null }
interface GhCommit { sha?: string; commit?: { tree?: { sha?: string } } }
interface GhTree { tree?: Array<{ type?: string; path?: string }> }

function makeClient(fetchImpl: typeof fetch, token: string | undefined) {
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
    const res = await fetchImpl(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    note(res);
    if (exhausted(res)) throw new RateLimited('GitHub rate limit reached');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    return (await res.json()) as T;
  }

  /** Raw files do not count against the REST quota. Returns null when the file does not exist. */
  async function raw(owner: string, repo: string, ref: string, path: string, truncate = false): Promise<string | null> {
    const segs = path.split('/');
    if (segs.some((s) => s === '..' || s === '')) throw new Error('invalid path');
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${segs.map(encodeURIComponent).join('/')}`;
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'contextforge-import' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.status === 429) throw new RateLimited('GitHub rate limit reached');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`raw.githubusercontent.com responded ${res.status}`);
    const text = await res.text();
    if (truncate) return text.slice(0, MAX_README_CHARS);
    if (text.length > MAX_FILE_CHARS) throw new Error(`file larger than ${MAX_FILE_CHARS} characters`);
    return text;
  }

  const toInfo = (j: GhRepo): RepoInfo => ({
    owner: j.owner?.login ?? '',
    repo: j.name ?? '',
    html_url: j.html_url ?? '',
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
      const j = await api<GhRepo>(`/repos/${owner}/${repo}`);
      return j ? toInfo(j) : null;
    },
    /** One request returns stars, license and branch for every hit, sorted by stars. */
    async searchTopic(topic: string, perPage: number): Promise<RepoInfo[]> {
      const j = await api<{ items?: GhRepo[] }>(
        `/search/repositories?q=${encodeURIComponent(`topic:${topic}`)}&sort=stars&order=desc&per_page=${perPage}`
      );
      return (j?.items ?? []).map(toInfo).filter((i) => i.owner && i.repo && SEGMENT.test(i.owner) && SEGMENT.test(i.repo));
    },
    /** Commit sha plus the files of a repo at that commit, so later fetches are pinned to one snapshot. */
    async snapshot(info: RepoInfo, ref?: string): Promise<{ sha: string; paths: string[] } | null> {
      const commit = await api<GhCommit>(`/repos/${info.owner}/${info.repo}/commits/${encodeURIComponent(ref ?? info.default_branch)}`);
      if (!commit?.sha || !commit?.commit?.tree?.sha) return null;
      const tree = await api<GhTree>(`/repos/${info.owner}/${info.repo}/git/trees/${commit.commit.tree.sha}?recursive=1`);
      const paths: string[] = (tree?.tree ?? []).filter((t) => t.type === 'blob' && t.path).map((t) => String(t.path));
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

/** The package or image an install command runs, without flags or a version tag; used to spot the same server listed twice. */
export function packageKey(cmd: string): string | null {
  const t = cmd.split(' ');
  const key = t[0] === 'docker' ? t[t.length - 1] : t.slice(1).find((x) => !x.startsWith('-'));
  const bare = key?.replace(/(?<=\w)@[\w.-]+$/, '');
  return bare && bare.length >= 4 ? bare : null;
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

const MAX_TOOLS = 150;

/**
 * A README bullet is a tool only if it looks like one. These are the shapes that were mistaken for tools in
 * real imports: environment variables and file formats (ALL_CAPS), script files (`loudness.py`), parameter
 * documentation (`(string, required): ...`, `Optional boolean ...`), and category headings whose description is
 * the actual tool name (`ECS` -> `RunCommand`).
 */
export function isLikelyTool(name: string, description: string): boolean {
  const desc = description.trim();
  if (/^[A-Z0-9_]{2,}$/.test(name)) return false;
  if (/\.(py|js|ts|mjs|cjs|json|ya?ml|sh|md|txt|csv)$/i.test(name)) return false;
  if (/^\(\s*(string|number|boolean|integer|array|object|optional|required)\b/i.test(desc)) return false;
  if (/^(optional|required|set to|if true|if false|default)\b/i.test(desc)) return false;
  if (/^[A-Z][A-Za-z]{1,11}$/.test(name) && /^[A-Za-z][A-Za-z0-9_]{3,}$/.test(desc)) return false;
  return true;
}

function extractTools(readme: string): Array<{ name: string; description: string }> {
  const tools: Array<{ name: string; description: string }> = [];
  const seen = new Set<string>();
  const add = (name: string, description: string) => {
    if (!/^[A-Za-z][\w.-]{1,63}$/.test(name) || seen.has(name) || tools.length >= MAX_TOOLS || !isLikelyTool(name, description)) return null;
    seen.add(name);
    const tool = { name, description: clean(description).slice(0, 300) };
    tools.push(tool);
    return tool;
  };

  let inSection = false;
  let sectionLevel = 0;
  let last: { name: string; description: string } | null = null;
  const lines = readme.split(/\r?\n/);
  for (const [idx, line] of lines.entries()) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const title = h[2].trim();
      // "## Tools", "## 🛠️ Available MCP Tools", "### Tool reference": up to two qualifier words, then tools
      const heading = title.replace(/^[^A-Za-z`]+/, '').replace(/[:#\s]+$/, '');
      if (/^(?:[A-Za-z-]+ ){0,2}tools?(?: (?:list|reference|overview|available))?$/i.test(heading)) {
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
    // A row followed by the |---| separator is the table's header ("Category | Tools"), not a tool.
    const isHeader = /^\s*\|?\s*:?-{2,}/.test(lines[idx + 1] ?? '');
    if (row && !isHeader && !/^(tool|name)$/i.test(row[1])) {
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
  // Camel case and separators become spaces first: "wipeLogs" -> "wipe logs", "RunCommand" -> "run command".
  const words = (t: string) => t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/[_-]/g, ' ');
  const nameText = words(name);
  const text = words(`${name} ${description}`);
  // A verb in the tool's NAME is the strongest signal, and stems are fine there ("uninstall", "purge", "evaluate").
  const inName = /\b(delet|remov|drop|destroy|truncat|kill|reset|overwrit|wip|purg|clear|exec|eval|shell|command|migrat|mutat|writ|edit|mov|renam|push|merg|deploy|install|uninstall|upload|terminat|restart|reboot|revok)/;
  // In the DESCRIPTION only whole verbs and phrases count: a stem would turn "Editor", "merged" or "evaluate and rank" into destructive.
  const inDescription =
    /\b(delete[sd]?|deleting|remove[sd]?|removing|drops?|dropped|destroy(s|ed)?|truncate[sd]?|kill(s|ed)?|wipe[sd]?|purge[sd]?|erase[sd]?|overwrit(e|es|ten|ing)|(un)?install(s|ed|ing)?|terminate[sd]?|shell|writes?|writing|modif(y|ies)|clears?|cleared)\b|\bruns? (\w+ ){0,2}(commands?|scripts?)\b|\bexecut(e|es|ing) (\w+ )?(code|commands?|scripts?|javascript|sql)\b|\b(code|command|script|shell) execution\b|\bevaluat(e|es|ing) (javascript|code)\b/;
  if (inName.test(nameText) || inDescription.test(text)) return ToolRiskLevel.destructive;
  if (/\b(file|files|directory|directories|folder|path|disk|filesystem)\b/.test(text)) return ToolRiskLevel.filesystem;
  return ToolRiskLevel.network;
}

// ---------------------------------------------------------------- orchestration

export async function importFromGithub(opts: ImportOptions): Promise<ImportSummary> {
  const {
    url, kind, submittedBy, dryRun = false, fetchImpl = fetch,
    token = process.env.GITHUB_PAT,
  } = opts;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(opts.limit ?? 20)));

  const source = parseSource(url);
  if (!source) throw new ImportInputError('Only https://github.com/<owner>/<repo> or https://github.com/topics/<topic> URLs are accepted.');

  const client = makeClient(fetchImpl, token);
  const summary: ImportSummary = {
    source: url, kind, dry_run: dryRun, created: [], skipped: [], failed: [], partial: false,
    api_calls: 0, rate_remaining: null,
  };
  const minStars = Math.max(0, Math.floor(opts.minStars ?? 0));
  // Ranking a whole awesome list by stars costs one request per linked repository; only worth it with a token.
  const ctx: Ctx = { client, submittedBy, dryRun, limit, summary, minStars, belowMin: 0, pool: token ? 1200 : limit * 4 };

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
  if (ctx.belowMin > 0) summary.skipped.push({ name: `${ctx.belowMin} repositories`, reason: `below the minimum of ${minStars} stars` });
  summary.api_calls = client.state.calls;
  summary.rate_remaining = client.state.remaining;
  console.info('[ContextForge GitHub Import]', JSON.stringify({ source: url, kind, dryRun, created: summary.created.length, skipped: summary.skipped.length, failed: summary.failed.length, partial: summary.partial, api_calls: summary.api_calls }));
  return summary;
}

interface Ctx {
  client: Client;
  submittedBy: string;
  dryRun: boolean;
  limit: number;
  summary: ImportSummary;
  minStars: number;
  belowMin: number;
  pool: number;
}
const full = (c: Ctx) => c.summary.created.length >= c.limit;

async function reposFor(c: Ctx, s: Source, maxRepos: number): Promise<Array<{ info: RepoInfo; ref?: string; path?: string }>> {
  if (s.type === 'topic') return (await c.client.searchTopic(s.topic, maxRepos)).map((info) => ({ info }));
  const info = await c.client.repoInfo(s.owner, s.repo);
  return info ? [{ info, ref: s.ref, path: s.path }] : [];
}

/**
 * Headline skills sit near the top of a repository, so shallow paths go first. A folder holding more than
 * BULK_DIR_SIZE skills is generated from a template (hundreds of near-identical "x-automation" skills), so it
 * contributes only BULK_DIR_KEEP of them and cannot crowd out the curated ones.
 */
export function pickSkillFiles(paths: string[]): string[] {
  const parent = (p: string) => p.split('/').slice(0, -2).join('/');
  const sizes = new Map<string, number>();
  for (const p of paths) sizes.set(parent(p), (sizes.get(parent(p)) ?? 0) + 1);
  const taken = new Map<string, number>();
  return [...paths]
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
    .filter((p) => {
      const dir = parent(p);
      if ((sizes.get(dir) ?? 0) <= BULK_DIR_SIZE) return true;
      taken.set(dir, (taken.get(dir) ?? 0) + 1);
      return taken.get(dir)! <= BULK_DIR_KEEP;
    })
    .slice(0, SKILLS_PER_REPO);
}

async function importSkills(c: Ctx, s: Source) {
  for (const { info, ref, path } of await reposFor(c, s, 30)) {
    if (full(c)) break;
    if (s.type === 'topic' && info.stars < c.minStars) {
      c.belowMin++;
      continue;
    }
    const snap = await c.client.snapshot(info, ref);
    if (!snap) {
      c.summary.skipped.push({ name: `${info.owner}/${info.repo}`, reason: 'repository or branch not found' });
      continue;
    }
    const prefix = path ? `${path}/` : '';
    const files = pickSkillFiles(
      snap.paths.filter((p) => /(^|\/)skill\.md$/i.test(p) && !/(^|\/)(node_modules|\.git)\//.test(p) && p.startsWith(prefix))
    );
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
        c.summary.failed.push({ name: label, reason: errMessage(err) });
      }
    }
  }
}

async function freeName(
  exists: (name: string) => Promise<{ source_url: string | null; repository_url?: string | null } | null>,
  base: string,
  owner: string,
  sourceUrl: string,
  repoPath?: string
): Promise<{ name: string } | { skip: string }> {
  for (const candidate of [base, normalizeName(`${base}-${owner}`)]) {
    if (!candidate) continue;
    const hit = await exists(candidate);
    if (!hit) return { name: candidate };
    if (hit.source_url === sourceUrl) return { skip: 'already imported' };
    // Same name and the existing listing already points into this repository: it is the same server.
    if (repoPath && hit.repository_url?.toLowerCase().includes(repoPath.toLowerCase())) return { skip: 'already listed (same name and repository)' };
  }
  return { skip: 'name already used by another listing' };
}

async function saveSkill(c: Ctx, info: RepoInfo, sha: string, sourceUrl: string, parsed: { name: string; description: string }, content: string, label: string) {
  const base = normalizeName(parsed.name);
  if (!base) {
    c.summary.skipped.push({ name: label, reason: 'skill name is empty or shorter than 3 characters' });
    return;
  }
  // The same file mirrored in another repository is one skill, not two.
  const same = await prisma.aiSkill.findFirst({ where: { skill_content: content, is_deleted: false }, select: { name: true, source_url: true } });
  if (same && same.source_url !== sourceUrl) {
    c.summary.skipped.push({ name: base, reason: `identical content to the existing listing "${same.name}"` });
    return;
  }
  // The same text under another name (a fork, a bundled copy) is the same skill. Short descriptions are too generic to compare.
  if (parsed.description.length >= 40) {
    const twin = await prisma.aiSkill.findFirst({
      where: { is_deleted: false, description: { equals: parsed.description, mode: 'insensitive' } },
      select: { name: true, source_url: true },
    });
    if (twin && twin.source_url !== sourceUrl) {
      c.summary.skipped.push({ name: base, reason: `same description as the existing listing "${twin.name}"` });
      return;
    }
  }
  const picked = await freeName((name) => prisma.aiSkill.findUnique({ where: { name }, select: { source_url: true } }), base, info.owner.toLowerCase(), sourceUrl);
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
    await prisma.$transaction(async (tx) => {
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
      c.summary.failed.push({ name: cand.nameHint, reason: errMessage(err) });
    }
  }
}

async function* mcpCandidates(c: Ctx, s: Source): AsyncGenerator<McpCandidate> {
  const readmeOf = async (info: RepoInfo, ref: string, path = 'README.md') => {
    try {
      return (await c.client.raw(info.owner, info.repo, ref, path, true)) ?? '';
    } catch (err) {
      if (err instanceof RateLimited) throw err;
      c.summary.failed.push({ name: `${info.owner}/${info.repo}`, reason: `README unreadable: ${errMessage(err)}` });
      return null;
    }
  };

  if (s.type === 'topic') {
    for (const info of await c.client.searchTopic(s.topic, Math.min(100, Math.max(50, c.limit * 3)))) {
      if (info.stars < c.minStars) {
        c.belowMin++;
        continue;
      }
      const readme = await readmeOf(info, info.default_branch);
      if (readme !== null) yield { info, readme, sourceUrl: info.html_url, sourceRef: info.default_branch, nameHint: info.repo };
    }
    return;
  }

  const info = await c.client.repoInfo(s.owner, s.repo);
  if (!info) return;

  // An "awesome" list: its README links to many repositories; each linked repo becomes a candidate.
  if (/awesome/i.test(info.repo)) {
    const list = (await readmeOf(info, info.default_branch)) ?? '';
    const seen = new Set<string>([`${info.owner}/${info.repo}`.toLowerCase()]);
    // Look the linked repositories up first, then take the most-starred ones: list order is by category, not popularity.
    const ranked: RepoInfo[] = [];
    for (const m of list.matchAll(/\]\(https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?\)/g)) {
      const key = `${m[1]}/${m[2]}`.toLowerCase();
      if (seen.has(key) || !SEGMENT.test(m[1]) || !SEGMENT.test(m[2])) continue;
      seen.add(key);
      if (seen.size > c.pool) break;
      const cand = await c.client.repoInfo(m[1], m[2]);
      if (cand) ranked.push(cand);
    }
    ranked.sort((a, b) => b.stars - a.stars);
    for (const cand of ranked) {
      if (cand.stars < c.minStars) {
        c.belowMin++;
        continue;
      }
      const readme = await readmeOf(cand, cand.default_branch);
      if (readme !== null) yield { info: cand, readme, sourceUrl: cand.html_url, sourceRef: cand.default_branch, nameHint: cand.repo };
    }
    return;
  }

  const snap = await c.client.snapshot(info, s.ref);
  if (!snap) return;
  // A monorepo of servers (modelcontextprotocol/servers): one README per src/<name>/.
  const dirs = snap.paths.map((p) => p.match(/^((?:src\/)[^/]+)\/README\.md$/)?.[1]).filter((d): d is string => !!d);
  if (dirs.length >= 3) {
    for (const dir of dirs) {
      const readme = await readmeOf(info, snap.sha, `${dir}/README.md`);
      if (readme !== null) yield { info, readme, sourceUrl: `${info.html_url}/tree/${snap.sha}/${dir}`.slice(0, 512), sourceRef: snap.sha, nameHint: dir.split('/')[1] };
    }
    return;
  }
  const readme = await readmeOf(info, snap.sha);
  if (readme !== null) yield { info, readme, sourceUrl: info.html_url, sourceRef: snap.sha, nameHint: info.repo };
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
  // The same package under another name is the same server: skip it rather than list it twice.
  const key = packageKey(parsed.install_command);
  if (key) {
    const same = await prisma.mcpServer.findMany({ where: { is_deleted: false, install_command: { contains: key } }, select: { name: true, source_url: true }, take: 5 });
    const other = same.find((r) => r.source_url !== cand.sourceUrl);
    if (other) {
      c.summary.skipped.push({ name: cand.nameHint, reason: `same package as the existing listing "${other.name}"` });
      return;
    }
  }
  const base = normalizeName(cand.nameHint);
  if (!base) {
    c.summary.skipped.push({ name: cand.nameHint, reason: 'server name is empty or shorter than 3 characters' });
    return;
  }
  const picked = await freeName(
    (name) => prisma.mcpServer.findUnique({ where: { name }, select: { source_url: true, repository_url: true } }),
    base,
    info.owner.toLowerCase(),
    cand.sourceUrl,
    `github.com/${info.owner}/${info.repo}`
  );
  if ('skip' in picked) {
    c.summary.skipped.push({ name: base, reason: picked.skip });
    return;
  }
  const tools = parsed.tools.map((t) => ({ name: t.name, description: t.description || null, risk_level: classifyRisk(t.name, t.description) }));
  // README text is untrusted and tool descriptions are read by agents (OWASP LLM01): scan what is about to be stored.
  const scan = SecurityScanner.scanSkillContent([info.description ?? '', ...parsed.tools.map((t) => `${t.name}: ${t.description}`)].join('\n'));
  const item: ImportedItem = { kind: 'mcp', name: picked.name, source_url: cand.sourceUrl, license: info.license, tools: tools.length, flagged_by_scan: scan.prompt_injection_detected };
  if (c.dryRun) {
    c.summary.created.push(item);
    return;
  }
  try {
    await prisma.$transaction(async (tx) => {
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
          flagged_by_scan: scan.prompt_injection_detected,
          review_notes:
            `Imported from ${cand.sourceUrl} (license: ${info.license ?? 'none declared'}). ` +
            `The install command and ${tools.length} tools were read from the README. ` +
            'Tool risk levels are a keyword guess and are unconfirmed: check them before approving. ' +
            (scan.prompt_injection_detected ? `SECURITY SCAN ALERT: ${scan.flags.join('; ')}` : 'Automated heuristic scan of the description and tool text found no injection flags.'),
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
