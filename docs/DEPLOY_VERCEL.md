# Deploying ContextForge on Vercel

One Vercel project serves the React site from the CDN and runs the Express API as a single Vercel Function.
The page and `/api/v1` stay on the same origin, which the `SameSite=strict` session cookie needs.
Render is the other prepared option (`render.yaml`, `docs/DEPLOY.md`); pick one host, not both.

## How it is wired

| Piece | File | What it does |
|---|---|---|
| Build | `vercel.json` | `npm ci`, then `prisma generate`, then `npm run build` (tsc for the backend, Vite for the frontend). The static output is `frontend/dist`. |
| API function | `api/index.js` | Loads the compiled app from `backend/dist` and hands every request to Express. Cold-start check: a missing or short `JWT_SECRET` stops the function with a clear log line. |
| Routing | `vercel.json` `rewrites` | `/api/(.*)` goes to that one function with the original URL, so Express sees `/api/v1/...` exactly as in development. |
| Headers | `vercel.json` `headers` | The static pages get the same Content-Security-Policy that helmet gives the API (`script-src 'self'`, no inline scripts), plus nosniff, frame and referrer headers. `/assets/*` is cached for a year (hashed file names). |
| Prisma | `backend/prisma/schema.prisma` | `binaryTargets` adds `rhel-openssl-3.0.x`, the engine Vercel's Linux functions need. |
| Region | `vercel.json` `regions` | `sin1` (Singapore), next to the Supabase project in `ap-southeast-1`. Hobby plans allow one region. |
| Time limit | `vercel.json` `functions` | `maxDuration` 60 seconds, for the admin GitHub import. |
| Upload filter | `.vercelignore` | Leaves out design files, docs, specs and tests. |

## First deploy

1. Push the branch to GitHub. In Vercel choose Add New, Project, and import the repository. Keep the **Root Directory** at the repository root and the **Framework Preset** at "Other". Build, install and output settings come from `vercel.json`.
2. In Project Settings, General, set **Node.js Version** to 26.x. This matches the Node the project was built and tested on locally (v26.13.0). The Render file still pins 22, which has not been tried with this code.
3. In Settings, Environment Variables, add these for Production (and Preview if you want previews to work):

| Name | Value |
|---|---|
| `DATABASE_URL` | The Supabase **transaction pooler** string (port 6543) with `?pgbouncer=true&connection_limit=1` appended. Copy it from the project's Connect page. Do not paste it into chat or into this repository. |
| `JWT_SECRET` | At least 32 random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TRUST_PROXY` | `1`. Vercel overwrites `X-Forwarded-For` with the real client address, so each visitor gets their own rate-limit bucket. |
| `GITHUB_PAT` | Optional. A read-only token raises the GitHub rate limit for imports and star sync. |

   `CLIENT_URL` is not needed: the browser and the API share one origin, so there is no cross-origin request to allow.
4. Deploy. The first build runs `npm ci` (with dev dependencies, which tsc and Vite need) and the build command from `vercel.json`.

### Database migrations

The live database already has every migration up to `20261111000001_import_provenance`. Run new ones from your own machine, before deploying code that needs them, using Supabase's **session** pooler or direct string (migrations do not work through the transaction pooler):

    npm run db:deploy

Never run `npm run seed` against this database (it needs `--confirm-wipe` and deletes everything).

## Checks after the first deploy

- `https://<project>.vercel.app/api/v1/health` returns `status: healthy` with `database: up`.
- The landing page loads with styles and the hero video; the browser console shows no Content-Security-Policy errors.
- Open `/#/skills/<id>` in a new tab and reload: the page still opens.
- Register, sign in and sign out. The cookie must be set with `Secure` and `SameSite=Strict`.
- Send a JSON `POST` (registering an account is one). A lost request body would show up as a 400 on a correct form.
- As admin, open the Admin page and run one small import (dry run first). It must finish inside 60 seconds.

## Known limits

- **Rate limiter is per instance.** The limiter keeps its counters in memory (see the `ponytail:` note in `rateLimit.middleware.ts`). Vercel may run several instances at once, so the real limit for one visitor can be a multiple of 10 logins a minute. Add a Vercel Firewall rate-limit rule for `/api/v1/auth/login` in the dashboard if that matters; no code change is needed.
- **Cold starts.** The first request after a quiet period loads the Prisma client and connects to the database, and is slower than the next ones.
- **Long imports.** Importing a large GitHub repository can pass the 60-second limit. For big imports use `npm run import:github` from your own machine instead of the Admin page.
- **Plan terms.** Check Vercel's current plan limits and usage terms for your account before relying on the free plan for anything beyond the course presentation.

## What was and was not verified

Verified on the Windows development machine, in a clean clone with `npm ci`, the same build command and a production-mode run of `api/index.js` against the real database: health, list, 404 JSON, JSON `POST` body, signed-out 401, and a file trace (the same tracer Vercel uses, `@vercel/nft`) showing the compiled backend, Prisma and the Linux engine, and express in the bundle. The tracer picks `bcrypt`'s prebuild for the machine it runs on, so on Windows it listed the Windows one; the package ships the Linux prebuilds and `vercel.json` force-includes them. `node scripts/check-vercel.mjs` re-checks the static settings; `node scripts/vercel-smoke.mjs --trace` repeats the run.

**Verified on Vercel itself** (first production deploy of `main` at `3d9616c`, 2026-11-12, project `contextforge`, production URL `https://contextforge-seven.vercel.app`):
- The build on Vercel's Node 26.x image finished (`READY`).
- The rewrite keeps the original URL: an unknown path answers `Endpoint GET /api/v1/nope ... not found` from Express.
- The function runs in `sin1`, loads Express and the Prisma client, and answers JSON.
- The site is served from the CDN with the CSP and security headers from `vercel.json`, and `theme-init.js` loads.

**Still not verified:** the database connection (`DATABASE_URL` was added after this deploy; until then `/api/v1/health` answers 503 with `database: down`), a JSON `POST` and `bcrypt` on Linux (registering an account tests both), the `TRUST_PROXY` effect, and cold-start timing. The checklist above covers each of them.

## How the first deploy was made

The repository belongs to the GitHub organisation `I-have-no-Enemy`, and the Vercel GitHub app is installed on a different account, so the project is not linked to Git. It was created and deployed with the Vercel CLI from this folder (`vercel link`, then `vercel deploy --prod`). On Windows the CLI needs Developer Mode (it creates symlinks). Pushes do not deploy by themselves: run `vercel deploy --prod --scope tawaninms-projects` again, or install the Vercel GitHub app on the organisation and run `vercel git connect`.

## Rolling back

In the Vercel dashboard, open Deployments, pick the last good one and choose Promote to Production (or Instant Rollback). No database change is involved.
