# ContextForge

Registry for MCP servers and AI skills (`SKILL.md`) that shows what each tool can touch, scans skills for prompt injection, puts every submission through admin review, and generates ready-to-use config files for Claude Desktop, Cursor, Cline and Antigravity.

Course project for 06016418 Server-Side Web Development, KMITL IT.

## What it does

- **Browse without an account.** Verified servers and skills, searchable, paginated. Each server shows its highest-risk tool (`read_only`, `network`, `filesystem`, `destructive`).
- **Submit as a developer.** New servers and skills start unverified. Skills are scanned for prompt-injection patterns (OWASP LLM01) on create and on every edit.
- **Review as an admin.** Scanner hits go to the top of the queue. Approve, reject with a note, or take an item down; every decision is logged.
- **Edits go back to review.** When an owner edits an approved item it leaves the public registry until an admin approves it again.
- **Generate configs.** Pick servers and skills, choose a client, and get the client's real config file plus skill files in the format that client loads. Snapshots never change afterwards.
- **GitHub metrics.** Stars and contributors are synced from the GitHub API on demand.
- **Import from GitHub.** An admin pastes a repository, folder or topic URL; skills (`SKILL.md`) and MCP servers (README) are read through the GitHub API into the review queue with their source and license, and nothing is published until an admin approves it.

## Stack

Express 4 + TypeScript, Prisma 5, PostgreSQL 17 (Supabase), zod, JWT in an HttpOnly cookie, bcrypt (cost 12). React 18 + Vite frontend. Vitest + Supertest integration tests against a real PostgreSQL schema.

## Run it

```bash
npm install
cp .env.example .env      # set DATABASE_URL (Supabase session pooler URI) and JWT_SECRET (32+ chars)
npm run db:check --workspace=backend
npm run seed --workspace=backend          # WIPES the tables, loads 10 real MCP servers and 5 skills
npm run sync:github --workspace=backend   # real GitHub stars and contributors
npm run dev                               # API http://localhost:5000, web http://localhost:3000
```

The seed generates account passwords into `backend/prisma/seed-accounts.local.json` (gitignored) unless `SEED_ADMIN_PASSWORD` and `SEED_MAINTAINER_PASSWORD` are set. Move them into a password manager and delete the file; on Windows the project keeps them in Credential Manager as `ContextForge/<email>`, and `pwsh scripts/get-password.ps1 [email]` copies one to the clipboard.

## Scripts (backend workspace)

| Command | What it does |
|---|---|
| `npm test` | 111 integration tests against the isolated `ctxforge_test` schema (never touches `public`) |
| `npm run e2e` | Seeds the test schema, starts the API with rate limits on, runs the Postman collection with newman |
| `npm run dev:testdb` | Real API on the seeded test schema, for trying the UI without changing real data |
| `npm run db:check` | Connectivity and required-index check; prints no secrets |
| `npm run seed` | Resets and seeds the schema in `DATABASE_URL` |
| `npm run sync:github` | One-off GitHub metrics sync |
| `npm run import:github -- <url> --kind skill\|mcp [--limit N] [--apply]` | Import from a GitHub URL; dry run unless `--apply` |

Root: `node scripts/check-docs.mjs` (doc checks), `node scripts/build-postman.mjs` (regenerates the Postman files).

## Documentation

- [`docs/API.md`](docs/API.md): 31 endpoints with method, path, description, role and status codes; data model; error codes; OWASP mapping
- [`docs/postman/`](docs/postman): Postman collection and environment
- [`docs/DEMO.md`](docs/DEMO.md): presentation script
- [`CASE_STUDY.md`](CASE_STUDY.md): problem, decisions, results
- [`specs/001-mcp-skills-registry/spec.md`](specs/001-mcp-skills-registry/spec.md): feature specification
- [`DESIGN.md`](DESIGN.md), [`UX.md`](UX.md): design system and UX notes
- [`DEV_LOG.md`](DEV_LOG.md): development log

## License

MIT
