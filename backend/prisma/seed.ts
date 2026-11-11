/**
 * Seeds ContextForge with real, installable MCP servers and working skills.
 *
 * - Every server is a published package with its real install command and source repository.
 *   GitHub stars/contributors start at 0 and are filled by POST /admin/sync/github.
 * - Account passwords come from SEED_ADMIN_PASSWORD / SEED_MAINTAINER_PASSWORD, or are generated
 *   and written to prisma/seed-accounts.local.json (gitignored). They are never printed.
 * - WIPES all six tables of the schema in DATABASE_URL first.
 */
import '../src/loadEnv.js';
import { Prisma, PrismaClient, ToolRiskLevel, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BCRYPT_ROUNDS } from '../src/config/env.js';
import { SecurityScanner } from '../src/services/scanner.service.js';

const prisma = new PrismaClient();
const ALL_CLIENTS = ['claude_desktop', 'cursor', 'cline', 'antigravity'];
const MCP_REPO = 'https://github.com/modelcontextprotocol/servers';

type Tool = { name: string; description: string; risk_level: ToolRiskLevel; input_schema?: Record<string, unknown> };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });
const str = (description: string) => ({ type: 'string', description });

const SERVERS: {
  name: string;
  description: string;
  repository_url: string;
  install_command: string;
  required_env_vars: string[];
  tools: Tool[];
}[] = [
  {
    name: 'filesystem',
    description: 'Read, search and edit files inside the directories you pass as arguments. Access outside them is refused.',
    repository_url: `${MCP_REPO}/tree/main/src/filesystem`,
    install_command: 'npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir',
    required_env_vars: [],
    tools: [
      { name: 'read_text_file', description: 'Read a file as text.', risk_level: 'filesystem', input_schema: obj({ path: str('File path') }, ['path']) },
      { name: 'list_directory', description: 'List entries in a directory.', risk_level: 'filesystem', input_schema: obj({ path: str('Directory') }, ['path']) },
      { name: 'search_files', description: 'Find files matching a pattern.', risk_level: 'filesystem', input_schema: obj({ path: str('Root'), pattern: str('Glob') }, ['path', 'pattern']) },
      { name: 'write_file', description: 'Create or overwrite a file.', risk_level: 'destructive', input_schema: obj({ path: str('File path'), content: str('New content') }, ['path', 'content']) },
      { name: 'edit_file', description: 'Apply line edits to a file.', risk_level: 'destructive' },
      { name: 'move_file', description: 'Move or rename a file.', risk_level: 'destructive' },
    ],
  },
  {
    name: 'memory',
    description: 'Persistent knowledge graph of entities, relations and observations, stored in a local JSON file.',
    repository_url: `${MCP_REPO}/tree/main/src/memory`,
    install_command: 'npx -y @modelcontextprotocol/server-memory',
    required_env_vars: [],
    tools: [
      { name: 'read_graph', description: 'Return the whole graph.', risk_level: 'read_only' },
      { name: 'search_nodes', description: 'Search entities by text.', risk_level: 'read_only', input_schema: obj({ query: str('Search text') }, ['query']) },
      { name: 'create_entities', description: 'Add entities to the graph file.', risk_level: 'filesystem' },
      { name: 'delete_entities', description: 'Remove entities and their relations.', risk_level: 'destructive' },
    ],
  },
  {
    name: 'sequential-thinking',
    description: 'Structured step-by-step reasoning tool that lets the model revise and branch its thoughts.',
    repository_url: `${MCP_REPO}/tree/main/src/sequentialthinking`,
    install_command: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    required_env_vars: [],
    tools: [{ name: 'sequentialthinking', description: 'Record one thinking step.', risk_level: 'read_only' }],
  },
  {
    name: 'fetch',
    description: 'Fetch a URL and return it as markdown for the model to read.',
    repository_url: `${MCP_REPO}/tree/main/src/fetch`,
    install_command: 'uvx mcp-server-fetch',
    required_env_vars: [],
    tools: [{ name: 'fetch', description: 'GET a URL and convert HTML to markdown.', risk_level: 'network', input_schema: obj({ url: str('URL') }, ['url']) }],
  },
  {
    name: 'git',
    description: 'Inspect and change a local Git repository: status, diff, log, commit, branches.',
    repository_url: `${MCP_REPO}/tree/main/src/git`,
    install_command: 'uvx mcp-server-git --repository /path/to/repo',
    required_env_vars: [],
    tools: [
      { name: 'git_status', description: 'Working tree status.', risk_level: 'read_only' },
      { name: 'git_diff', description: 'Diff against a target.', risk_level: 'read_only' },
      { name: 'git_log', description: 'Commit history.', risk_level: 'read_only' },
      { name: 'git_commit', description: 'Record staged changes.', risk_level: 'filesystem' },
      { name: 'git_reset', description: 'Unstage all staged changes.', risk_level: 'filesystem' },
    ],
  },
  {
    name: 'time',
    description: 'Current time and timezone conversion using IANA zone names.',
    repository_url: `${MCP_REPO}/tree/main/src/time`,
    install_command: 'uvx mcp-server-time',
    required_env_vars: [],
    tools: [
      { name: 'get_current_time', description: 'Time in a timezone.', risk_level: 'read_only' },
      { name: 'convert_time', description: 'Convert between timezones.', risk_level: 'read_only' },
    ],
  },
  {
    name: 'github',
    description: "GitHub's official MCP server: repositories, issues, pull requests and code search through the GitHub API.",
    repository_url: 'https://github.com/github/github-mcp-server',
    install_command: 'docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server',
    required_env_vars: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    tools: [
      { name: 'get_file_contents', description: 'Read a file from a repository.', risk_level: 'network' },
      { name: 'search_repositories', description: 'Search repositories.', risk_level: 'network' },
      { name: 'create_issue', description: 'Open an issue.', risk_level: 'network' },
      { name: 'create_pull_request', description: 'Open a pull request.', risk_level: 'network' },
      { name: 'push_files', description: 'Commit files directly to a branch.', risk_level: 'destructive' },
    ],
  },
  {
    name: 'playwright',
    description: "Microsoft's browser automation server. The model drives a real browser through accessibility snapshots.",
    repository_url: 'https://github.com/microsoft/playwright-mcp',
    install_command: 'npx @playwright/mcp@latest',
    required_env_vars: [],
    tools: [
      { name: 'browser_navigate', description: 'Open a URL.', risk_level: 'network' },
      { name: 'browser_click', description: 'Click an element.', risk_level: 'network' },
      { name: 'browser_snapshot', description: 'Accessibility snapshot of the page.', risk_level: 'read_only' },
      { name: 'browser_file_upload', description: 'Upload local files to the page.', risk_level: 'filesystem' },
      { name: 'browser_evaluate', description: 'Run JavaScript in the page.', risk_level: 'destructive' },
    ],
  },
  {
    name: 'context7',
    description: 'Up-to-date, version-specific library documentation pulled into the prompt.',
    repository_url: 'https://github.com/upstash/context7',
    install_command: 'npx -y @upstash/context7-mcp',
    required_env_vars: [],
    tools: [
      { name: 'resolve-library-id', description: 'Find the Context7 id for a library name.', risk_level: 'network' },
      { name: 'query-docs', description: 'Fetch documentation for a library id.', risk_level: 'network' },
    ],
  },
  {
    name: 'supabase',
    description: 'Manage Supabase projects: tables, SQL, migrations, logs and advisors. Start it with --read-only unless you need writes.',
    repository_url: 'https://github.com/supabase-community/supabase-mcp',
    install_command: 'npx -y @supabase/mcp-server-supabase@latest --read-only',
    required_env_vars: ['SUPABASE_ACCESS_TOKEN'],
    tools: [
      { name: 'list_tables', description: 'List tables in schemas.', risk_level: 'network' },
      { name: 'get_advisors', description: 'Security and performance advisors.', risk_level: 'network' },
      { name: 'execute_sql', description: 'Run SQL on the project database.', risk_level: 'destructive' },
      { name: 'apply_migration', description: 'Apply a DDL migration.', risk_level: 'destructive' },
    ],
  },
];

const SKILLS = [
  {
    name: 'tdd-red-green-refactor',
    description: 'Drive every change with a failing test first, in steps small enough to finish in minutes.',
    tags: ['testing', 'workflow'],
    skill_content: `# TDD: red, green, refactor

Use this for any behaviour change in code that has a test runner.

1. **Red.** Write one test for the next small behaviour. Run it. It must fail for the reason you expect; a test that fails on a typo proves nothing.
2. **Green.** Write the least code that makes it pass. Hard-coding is fine at this step.
3. **Refactor.** Remove duplication and rename while the suite stays green. No new behaviour here.
4. Repeat. Commit after each green.

Rules
- One failing test at a time.
- Test behaviour through the public interface, not private helpers.
- Cover a boundary on both sides (7 and 8 characters for "at least 8").
- A bug report becomes a failing test before the fix.
- Never weaken an assertion to make a test pass. Fix the code or ask.`,
  },
  {
    name: 'owasp-api-review',
    description: 'Review a REST endpoint against OWASP Top 10 before it merges, with a concrete test per finding.',
    tags: ['security', 'review', 'api'],
    skill_content: `# OWASP API review

Run this on every new or changed endpoint. For each finding write a failing test first, then fix.

- **A01 Access control.** Who may call it? Does it load the record and compare the owner id from the token, not from the URL or body? Test: user B gets 403 on user A's id.
- **A02 Crypto.** Passwords with bcrypt or argon2. Secrets only from the environment. Tokens expire.
- **A03 Injection.** Parameterised queries only. Validate ids (UUID) and enums before the database.
- **A04 Design.** Can an approved item be edited into something else without re-review? Can a client set fields like role or is_verified (mass assignment)?
- **A05 Misconfiguration.** No stack traces or SQL in responses. Security headers on. CORS limited to known origins.
- **A07 Auth.** Rate-limit login and registration. Same error for unknown user and wrong password.
- **A10 SSRF.** Any server-side fetch of a user-supplied URL is restricted to an allow-list of hosts.

Also check: two concurrent writers (use a conditional update or a transaction), and the same request sent twice.`,
  },
  {
    name: 'conventional-commits',
    description: 'Write commit messages in the Conventional Commits format so history and changelogs stay readable.',
    tags: ['git', 'workflow'],
    skill_content: `# Conventional Commits

Format: \`<type>(<scope>): <summary>\`

- type: feat, fix, docs, refactor, test, perf, build, ci, chore
- scope: the module touched, e.g. auth, configs, ui
- summary: imperative mood, no full stop, under 72 characters

Body (optional): what changed and why, wrapped at 72 characters. Not how; the diff shows how.

Breaking change: add \`!\` after the type and a \`BREAKING CHANGE:\` footer that says what users must do.

Examples
- \`fix(configs): verify selection inside the generation transaction\`
- \`feat(api)!: return 204 on soft delete\`

One logical change per commit. If the summary needs "and", split the commit.`,
  },
  {
    name: 'prisma-migration-safety',
    description: 'Ship Prisma schema changes without locking tables or losing data in production.',
    tags: ['database', 'prisma', 'postgres'],
    skill_content: `# Safe Prisma migrations (PostgreSQL)

Before running \`prisma migrate deploy\` on shared data:

1. Read the generated SQL in \`prisma/migrations/*/migration.sql\`. Never deploy SQL you have not read.
2. Adding a column: make it nullable or give it a default. A NOT NULL column without a default fails on existing rows.
3. Renaming: Prisma emits DROP + ADD and loses data. Write the migration by hand with \`ALTER TABLE ... RENAME COLUMN\`.
4. Indexes on large tables: edit the SQL to \`CREATE INDEX CONCURRENTLY\` and run it outside a transaction.
5. Dropping a column: first deploy code that no longer reads it, then drop it in a later release.
6. \`prisma db push\` is for prototypes. It has no history and can drop data; use migrations once data matters.
7. Take a backup or snapshot before a destructive step, and write down the way back.`,
  },
  {
    name: 'accessible-forms',
    description: 'Build forms that meet WCAG 2.2 AA: labels, errors, keyboard use and focus.',
    tags: ['accessibility', 'frontend', 'forms'],
    skill_content: `# Accessible forms (WCAG 2.2 AA)

- Every input has a visible \`<label for>\`. Placeholder text is not a label.
- Group related controls in \`<fieldset>\` with a \`<legend>\`.
- Errors: set \`aria-invalid="true"\` on the field and link the message with \`aria-describedby\`. Say how to fix it ("Use at least 8 characters with a number"), not only that it failed.
- Announce async results (saved, failed) in an \`aria-live="polite"\` region.
- Everything works with the keyboard: Tab order follows the visual order, Enter submits, Escape closes dialogs and returns focus to the trigger.
- Never remove focus outlines without a visible \`:focus-visible\` style.
- Text contrast at least 4.5:1, and 3:1 for input borders and focus rings.
- Target size at least 24 by 24 CSS pixels (2.5.8).
- Use \`autocomplete\` tokens (email, current-password, new-password).`,
  },
];

async function account(email: string, role: UserRole, envVar: string) {
  const password = process.env[envVar] || randomBytes(15).toString('base64url');
  const user = await prisma.user.create({ data: { email, role, password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS) } });
  return { user, password, generated: !process.env[envVar] };
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  console.log(`Seeding schema "${url.searchParams.get('schema') ?? 'public'}" on a ${['localhost', '127.0.0.1'].includes(url.hostname) ? 'local' : 'remote'} database`);

  await prisma.$transaction([
    prisma.submissionReview.deleteMany(),
    prisma.clientConfig.deleteMany(),
    prisma.toolDefinition.deleteMany(),
    prisma.mcpServer.deleteMany(),
    prisma.aiSkill.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const admin = await account('admin@contextforge.dev', 'admin', 'SEED_ADMIN_PASSWORD');
  const maintainer = await account('maintainer@contextforge.dev', 'developer', 'SEED_MAINTAINER_PASSWORD');

  for (const s of SERVERS) {
    const server = await prisma.mcpServer.create({
      data: {
        name: s.name,
        description: s.description,
        repository_url: s.repository_url,
        install_command: s.install_command,
        required_env_vars: s.required_env_vars,
        is_verified: true,
        submitted_by: maintainer.user.user_id,
        tools: { create: s.tools.map((t) => ({ ...t, input_schema: (t.input_schema ?? {}) as Prisma.InputJsonObject })) },
      },
    });
    await prisma.submissionReview.create({
      data: {
        item_type: 'server',
        item_id: server.server_id,
        reviewer_id: admin.user.user_id,
        status: 'approved',
        review_notes: 'Seed: official package and source repository checked.',
      },
    });
  }

  for (const k of SKILLS) {
    const scan = SecurityScanner.scanSkillContent(k.skill_content);
    if (!scan.isSafe) throw new Error(`Seed skill ${k.name} fails the scanner: ${scan.flags.join(', ')}`);
    const skill = await prisma.aiSkill.create({
      data: { ...k, compatible_clients: ALL_CLIENTS, scan_flags: scan as any, is_verified: true, submitted_by: maintainer.user.user_id },
    });
    await prisma.submissionReview.create({
      data: { item_type: 'skill', item_id: skill.skill_id, reviewer_id: admin.user.user_id, status: 'approved', review_notes: 'Seed: scanner clean, content reviewed.' },
    });
  }

  const generated = [admin, maintainer].filter((a) => a.generated);
  if (generated.length) {
    const file = join(dirname(fileURLToPath(import.meta.url)), 'seed-accounts.local.json');
    writeFileSync(file, JSON.stringify(Object.fromEntries(generated.map((a) => [a.user.email, a.password])), null, 2) + '\n');
    console.log(`Generated passwords for ${generated.map((a) => a.user.email).join(', ')} -> prisma/seed-accounts.local.json (gitignored)`);
  }
  console.log(`Seeded ${SERVERS.length} servers, ${SERVERS.reduce((n, s) => n + s.tools.length, 0)} tools, ${SKILLS.length} skills, 2 accounts.`);
  console.log('Next: sign in as admin and press "Sync GitHub stats" (or POST /api/v1/admin/sync/github) to load real star counts.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
