import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';
import { assertSeedAllowed } from '../config/seedGuard.js';

const login = { email: 'proxy@example.com', password: 'wrong-password1' };

describe('Behind a proxy (AC-D1, OWASP A05)', () => {
  it('with trust proxy on, two clients get separate rate-limit budgets', async () => {
    const app = createApp({ rateLimits: true, trustProxyHops: 1 });
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', '203.0.113.1').send(login);
    }
    const first = await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', '203.0.113.1').send(login);
    const other = await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', '203.0.113.2').send(login);
    expect(first.status).toBe(429);
    expect(other.status).toBe(401);
  });

  it('without trust proxy, a spoofed X-Forwarded-For cannot dodge the limit', async () => {
    const app = createApp({ rateLimits: true, trustProxyHops: 0 });
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', `198.51.100.${i}`).send(login);
    }
    const res = await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', '198.51.100.99').send(login);
    expect(res.status).toBe(429);
  });
});

describe('One service serves the site and the API (AC-D2)', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'cf-web-'));
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>ContextForge</title><div id="root"></div>');
    writeFileSync(join(root, 'assets', 'app-abc123.js'), 'console.log(1)');
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const app = () => createApp({ rateLimits: false, webRoot: root });

  it('serves index.html at / and for deep links without a file extension', async () => {
    for (const path of ['/', '/servers/abc', '/workspace']) {
      const res = await request(app()).get(path);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('id="root"');
    }
  });

  it('serves hashed assets with a long immutable cache', async () => {
    const res = await request(app()).get('/assets/app-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });

  it('answers a missing file or an unknown API route with JSON 404, never index.html', async () => {
    for (const path of ['/assets/missing.js', '/api/v1/nope', '/favicon-missing.png']) {
      const res = await request(app()).get(path);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('does not answer non-GET requests with the page', async () => {
    expect((await request(app()).post('/workspace').send({})).status).toBe(404);
  });

  it('keeps the plain API behaviour when no web root is set (dev and tests)', async () => {
    expect((await request(createApp({ rateLimits: false })).get('/')).status).toBe(404);
  });

  it('keeps the helmet CSP strict, so index.html must not carry an inline script', () => {
    const html = readFileSync(new URL('../../../frontend/index.html', import.meta.url), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)];
    expect(inline).toHaveLength(0);
  });
});

describe('seed wipes tables, so it needs a guard (AC-D4, OWASP A04)', () => {
  const real = 'postgresql://u:p@host:5432/postgres?schema=public';
  it('refuses a non-test schema without --confirm-wipe', () => {
    expect(() => assertSeedAllowed(real, [])).toThrow(/--confirm-wipe/);
    expect(() => assertSeedAllowed('postgresql://u:p@host/postgres', [])).toThrow(/--confirm-wipe/);
  });
  it('allows it with the flag, and always allows the test schema', () => {
    expect(() => assertSeedAllowed(real, ['--confirm-wipe'])).not.toThrow();
    expect(() => assertSeedAllowed('postgresql://u:p@host/postgres?schema=ctxforge_test', [])).not.toThrow();
  });
  it('never echoes the connection string in the error', () => {
    try { assertSeedAllowed(real, []); } catch (e) { expect(String(e)).not.toContain('u:p@host'); }
  });
});
