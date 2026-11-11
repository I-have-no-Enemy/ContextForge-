import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { sendError } from './utils/response.js';
import { rateLimit } from './middlewares/rateLimit.middleware.js';

interface AppOptions {
  /** Defaults to on everywhere except the unit-test run, where suites fire many requests per second. */
  rateLimits?: boolean;
}

export function createApp({ rateLimits = process.env.NODE_ENV !== 'test' }: AppOptions = {}): Express {
  const app = express();

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

  // 3. Fallback 404 Handler
  app.use((req, res) => {
    sendError(res, 404, `Endpoint ${req.method} ${req.originalUrl} not found.`, 'NOT_FOUND');
  });

  // 4. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
