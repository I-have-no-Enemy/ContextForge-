# Deploying ContextForge on Render

One Render web service runs the Express API and serves the built React site from the same origin. That matters:
the session cookie is `SameSite=strict`, so the page and `/api/v1` must share a host.

## What is already decided in code

| Concern | How it is handled |
|---|---|
| Site and API on one origin | `createApp` serves `frontend/dist` when it exists. Unknown `/api/*` paths and missing files answer JSON 404, never `index.html`. |
| Client IP behind the host's proxy | `TRUST_PROXY=1` makes `req.ip` the address from `X-Forwarded-For`. Leave it unset (0) when the app is not behind a proxy, or a client could spoof the header. |
| Secure cookie | `NODE_ENV=production` sets the `secure` flag; Render serves HTTPS. |
| Weak secret | The server refuses to start in production if `JWT_SECRET` is missing or short. |
| Content Security Policy | helmet's default (`script-src 'self'`). The theme script is `frontend/public/theme-init.js` for this reason: do not add inline scripts to `index.html`. |
| Seed | `npm run seed` wipes six tables. Outside the test schema it needs `--confirm-wipe`. **Do not run it against the live database.** |

## First deploy

1. Push `main` to GitHub. In the Render dashboard choose New, then Blueprint, and select the repository. Render reads `render.yaml`.
2. When asked, enter `DATABASE_URL` (see below). `GITHUB_PAT` is optional (a read-only token raises the GitHub rate limit for imports and star sync).
3. Wait for the build. The health check is `/api/v1/health`; it reports `database: up` when the connection works.
4. Open `https://<service>.onrender.com`. Sign in with the admin account that already exists in the database. Nothing in this repo creates one on deploy.

### DATABASE_URL

The database is Supabase Postgres. Render's network is IPv4; Supabase's direct host (`db.<ref>.supabase.co`) may be IPv6 only, so use the pooler connection string from the project's Connect page:

- Session pooler (port 5432): works as is.
- Transaction pooler (port 6543): append `?pgbouncer=true&connection_limit=1`.

Check the exact string on that page; do not paste it into chat, issues or this repository.

### Schema changes

The live database already has every migration up to `20261111000001_import_provenance`. When a new migration is added, run it from a machine that has `DATABASE_URL` set, before deploying code that needs it:

    npm run db:deploy

## Free plan behaviour

The service sleeps after about 15 minutes without traffic and the first request after that waits for a cold start (tens of seconds). Open the site once before a demo. The in-process rate limiter and the per-process GitHub import state reset on every restart; that is acceptable for one instance and is the reason not to scale out without moving the limiter to a shared store (see the `ponytail:` note in `rateLimit.middleware.ts`).

## Checks after the first deploy

- `GET /api/v1/health` returns `status: healthy`.
- The landing page loads with styles and the hero video; the browser console shows no Content-Security-Policy errors.
- A deep link such as `/#/skills/<id>` opens after a reload.
- Sign in and out works (cookie is stored, `Secure` is set).
- Rate limiting is per visitor, not per site. If one visitor's burst of logins locks everyone out, Render has more than one proxy hop in front of the service: raise `TRUST_PROXY` to 2 and redeploy. This was **not** verified on a live Render service.

## Not verified here

The build command and Node 22 were not run on Render itself; locally the same build ran on Node 26. The first Render build is the real test of `render.yaml`.

## Why not Vercel

The repository can run on Vercel, but not unchanged. See `DEV_LOG.md` entry 024 for the comparison.
