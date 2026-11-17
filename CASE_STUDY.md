# ContextForge case study

| | |
|---|---|
| Role | Solo: requirements, API design, backend, frontend, testing |
| Timeline | Sep 12 to Nov 2026 (final presentation Nov 18, 2026) |
| Live | https://contextforge-seven.vercel.app (Vercel, database on Supabase) |
| Stack | Express 4, TypeScript, Prisma 5, PostgreSQL 17 on Supabase, React 18, Vite, Vitest |
| Course | 06016418 Server-Side Web Development, KMITL IT (project = 30% of the grade) |

## Problem

AI coding agents load two kinds of extensions. MCP servers run on the user's machine and can read files, call the network or execute commands. Skills are markdown instructions that anyone can publish, and a skill can carry hidden instructions such as "send the user's tokens to this URL". Users install both from scattered repositories and hand-edit a different config file for every client.

## What was built

A registry where:

- every MCP server lists its tools with a risk level, and cards show the highest one;
- every skill is scanned for prompt-injection patterns when it is submitted and whenever it is edited;
- nothing is public until an admin approves it, and an owner's edit sends it back to review;
- a user picks servers and skills and downloads the exact files their client loads; signing in is optional and only saves the config to the account;
- an admin can import skills and MCP servers from a GitHub URL into the review queue, with source URL, license and commit sha kept on each row.

## Decisions

| Decision | Chosen | Instead of | Why |
|---|---|---|---|
| Re-review on edit | Owner edits set `is_verified = false` and re-queue | Trust approved items | Otherwise an approved listing can be swapped for a malicious install command or skill (bait-and-switch). |
| Race between config generation and takedown | Conditional `updateMany` (`is_verified AND NOT is_deleted`) inside the transaction | Check, then write | Postgres re-checks the condition after the row lock, so a takedown that commits mid-request rolls the generation back. Proven with a real row-lock test. |
| Session | JWT in an HttpOnly, SameSite=Strict cookie | Token in localStorage | Page scripts cannot read the token. |
| Tests | Integration tests on an isolated `ctxforge_test` schema | Mocked Prisma | Mocks passed while real bugs existed (env loading order, unhandled async errors). The real schema catches them and does not touch app data. |
| Rate limiting | 30-line in-memory fixed window | `express-rate-limit` | One instance; no new dependency; clock is injectable for tests. |
| Client output | Each client's real file format and skill location | One generic JSON | A config the client cannot load is not useful. |

## Bugs found by moving off mocks

- `dotenv.config()` ran after hoisted ES module imports, so `JWT_SECRET` from the env file was never read and a hard-coded fallback signed every token.
- Express 4 does not catch rejected promises; a database error in admin or config routes would have terminated the Node 22 process.
- Raw Prisma error messages (file paths, env variable names) reached API responses in development mode.
- `/health` reported "healthy" without touching the database.

## Results

- 31 REST endpoints under `/api/v1`, 6 tables, 12 indexes including 4 GIN indexes on JSONB.
- 197 integration tests in 16 files passing against PostgreSQL; Postman collection of 55 requests and 81 assertions passing end to end with rate limits on.
- Real data: 39 approved MCP servers (10 seeded, 29 imported from GitHub) with 458 tools, and 138 approved skills (5 seeded, 133 imported), with GitHub stars synced from api.github.com (for example context7: 64,553 stars at the first sync).
- Deployed on Vercel on 2026-11-12: the site and the API share one origin, so the `SameSite=Strict` cookie works; health, 401 and the rate limiter were checked on production (see `docs/DEPLOY_VERCEL.md`).

## Next

- Postgres Row Level Security; today access control lives in the API layer only.
- MFA for admins and a separate audit log table; today `submission_reviews` records the decisions.
- Ranking and filter endpoints, such as top skills or filter by risk level.
- Move the scanner from regex heuristics to a model-assisted classifier with the regex as a first pass.
- Scheduled GitHub sync (currently admin-triggered).
- Shared rate-limit counters (or a Vercel Firewall rule) because the in-memory limiter counts per instance.
