import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Injected clock for tests. */
  now?: () => number;
}

/**
 * Fixed-window, per-IP limiter (spec section 5: 60 req/min general, 10 req/min auth + generate).
 * ponytail: in-process Map is enough for a single instance; move to Redis if the API is ever scaled out.
 */
export function rateLimit({ windowMs, max, now = Date.now }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const t = now();
    const key = req.ip || 'unknown';

    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      sendError(res, 429, 'Too many requests. Please slow down and try again shortly.', 'RATE_LIMITED');
      return;
    }
    next();
  };
}
