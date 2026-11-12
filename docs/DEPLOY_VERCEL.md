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
| `DATABASE_URL` | The Supabase **transaction pooler** string (port 6543), copied from the project's Connect page, with the suffix `?pgbouncer=true&connection_limit=1` **typed on the end by hand**: the Connect page's copy button gives only `...:6543/postgres`. Percent-encode special characters in the password (`@` as `%40`, `/` as `%2F`, `#` as `%23`). Do not paste it into chat or into this repository. Two failures seen on the first deploy: a password with an unencoded `/` or `@` makes Prisma read the user name as the host (`Can't reach database server at postgres.<ref>:5432`); a missing suffix makes some requests fail with `prepared statement "s0" already exists` or `insufficient data left in message` (500 on `/skills`, flaky `/health`). The dedicated IPv4 add-on that the Connect page advertises is not needed; Vercel connects without it. |
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
- With the corrected `DATABASE_URL`: 23 consecutive API requests answered 200 (health 8, skills 8, servers 4, search 2, detail and tools 2); `skills` total 135 and `servers` total 39 with 457 tools match the database; no error lines in the runtime logs.
- A JSON `POST` reaches Express and `bcrypt` runs on Linux: logging in as the existing admin with a wrong password answers 401 `INVALID_CREDENTIALS` in 0.78 s, and a malformed body answers 400 with field details. Signed-out `/auth/me` and `/admin/metrics` answer 401.
- In a real Chromium at 1440 and 375 px: no Content-Security-Policy or console errors, no failed requests, 12 cards, the hero video plays, the "API live" badge shows, and opening an item then reloading its `#/servers/<id>` link still works.

- The rate limiter works behind Vercel's proxy: 12 login attempts with a different spoofed `X-Forwarded-For` each time got 401 ten times and then 429 with `Retry-After`, so Vercel overwrites that header and spoofing does not dodge the limit. (All attempts came from one real address and used a non-existent email.)

**Still not verified:** that two different visitors get separate rate-limit buckets (needs two real client addresses), registering a new account end to end, and cold-start timing (not measured; every request after the final deploy answered 200, including the first one).

## Who can open the site

Production is public. The project's **Vercel Authentication** covers preview deployments only (`ssoProtection` is `preview`), so the production address opens without a Vercel login while previews still ask for one. This was changed on 2026-11-12 after the database connection checks passed; the app has its own sign-in, and registration is open by design. To close the site again, set Vercel Authentication back to "Standard Protection" in Settings, Deployment Protection.

## How the first deploy was made

The repository belongs to the GitHub organisation `I-have-no-Enemy`, and the Vercel GitHub app is installed on a different account, so the project is not linked to Git. It was created and deployed with the Vercel CLI from this folder (`vercel link`, then `vercel deploy --prod`). On Windows the CLI needs Developer Mode (it creates symlinks). Pushes do not deploy by themselves: run `vercel deploy --prod --scope tawaninms-projects` again, or install the Vercel GitHub app on the organisation and run `vercel git connect`.

## Rolling back

In the Vercel dashboard, open Deployments, pick the last good one and choose Promote to Production (or Instant Rollback). No database change is involved.
