import express, { Express } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { sendError } from './utils/response.js';
import { rateLimit } from './middlewares/rateLimit.middleware.js';

/** The built frontend sits next to the backend in the repo, for both src/ (tsx) and dist/ (tsc). */
const BUILT_WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

interface AppOptions {
  /** Defaults to on everywhere except the unit-test run, where suites fire many requests per second. */
  rateLimits?: boolean;
  /** Proxies in front of the app whose X-Forwarded-For is believed (0 = none). Defaults to the TRUST_PROXY env var. */
  trustProxyHops?: number;
  /** Folder with the built frontend to serve. Defaults to frontend/dist when it exists; null = API only. */
  webRoot?: string | null;
}

export function createApp({
  rateLimits = process.env.NODE_ENV !== 'test',
  trustProxyHops = Number(process.env.TRUST_PROXY) || 0,
  webRoot = process.env.NODE_ENV !== 'test' && existsSync(path.join(BUILT_WEB, 'index.html')) ? BUILT_WEB : null,
}: AppOptions = {}): Express {
  const app = express();
  // Behind a host's load balancer every request arrives from the proxy; without this all visitors share one rate-limit bucket.
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

  // 1. Security & Hygiene Middlewares
  app.use(helmet());
  if (rateLimits) {
    const perMinute = (max: number) => rateLimit({ windowMs: 60_000, max });
    const strictMax = Number(process.env.RATE_LIMIT_STRICT_PER_MIN) || 10;
    app.use('/api/v1', perMinute(Number(process.env.RATE_LIMIT_PER_MIN) || 60));
    // Separate budgets: brute-forcing login and scraping config generation are different abuse cases.
    app.use(['/api/v1/auth/login', '/api/v1/auth/register'], perMinute(strictMax));
    app.use('/api/v1/configs/generate', perMinute(strictMax));
    app.use('/api/v1/admin/import', perMinute(strictMax)); // each call fans out to GitHub
  }
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // 2. API Routes
  app.use('/api/v1', apiRouter);

  // 3. The site itself: one origin for page and API keeps the SameSite=strict session cookie working.
  if (webRoot) {
    app.use('/assets', express.static(path.join(webRoot, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(webRoot, { index: false, maxAge: '1h' }));
    // Deep links such as /#/servers/x are hash routes, but a path without a file extension still gets the page.
    app.get(/^\/(?!api\/|assets\/)[^.]*$/, (_req, res) => res.sendFile(path.join(webRoot, 'index.html')));
  }

  // 4. Fallback 404 Handler
  app.use((req, res) => {
    sendError(res, 404, `Endpoint ${req.method} ${req.originalUrl} not found.`, 'NOT_FOUND');
  });

  // 5. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
