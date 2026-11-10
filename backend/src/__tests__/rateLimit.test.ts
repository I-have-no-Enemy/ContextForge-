import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit } from '../middlewares/rateLimit.middleware.js';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';

function tinyApp(max: number, now: () => number) {
  const app = express();
  app.use(rateLimit({ windowMs: 60_000, max, now }));
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Rate limiting (spec US1 scenario 4, OWASP A04/A07)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows requests up to the limit, then answers 429 with Retry-After', async () => {
    const app = tinyApp(3, () => 1_000);
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/ping')).status).toBe(200);
    }
    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('opens a fresh window after windowMs has passed', async () => {
    let t = 0;
    const app = tinyApp(1, () => t);
    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(429);
    t = 60_001;
    expect((await request(app).get('/ping')).status).toBe(200);
  });

  it('AC5: the 11th login attempt within a minute is rejected with 429', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    const app = createApp({ rateLimits: true });
    const body = { email: 'brute@example.com', password: 'wrong-password1' };

    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/v1/auth/login').send(body)).status).toBe(401);
    }
    const res = await request(app).post('/api/v1/auth/login').send(body);
    expect(res.status).toBe(429);
  });
});
