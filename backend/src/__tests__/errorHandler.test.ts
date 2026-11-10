import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../middlewares/error.middleware.js';

function appThrowing(err: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe('Central error handler (OWASP A05: no internals in responses)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('hides the message of unexpected 500s, even outside production', async () => {
    const res = await request(appThrowing(new Error('at D:\\secret\\path.ts:29 prisma.count()'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.text).not.toContain('secret');
  });

  it('maps an unreachable database to 503 DB_UNAVAILABLE', async () => {
    const err = new Prisma.PrismaClientInitializationError('Environment variable not found: DATABASE_URL', '5.22.0');
    const res = await request(appThrowing(err)).get('/boom');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');
    expect(res.text).not.toContain('DATABASE_URL');
  });

  it('maps a unique-constraint race (P2002) to 409 CONFLICT', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });
    const res = await request(appThrowing(err)).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('maps a missing record (P2025) to 404', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '5.22.0' });
    const res = await request(appThrowing(err)).get('/boom');
    expect(res.status).toBe(404);
  });

  it('keeps explicit 4xx errors and their message', async () => {
    const err = Object.assign(new Error('Bad thing'), { status: 400, code: 'BAD_THING' });
    const res = await request(appThrowing(err)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'BAD_THING', message: 'Bad thing' });
  });

  it('turns malformed JSON bodies into 400', async () => {
    const app = express();
    app.use(express.json());
    app.post('/x', (_req, res) => res.json({}));
    app.use(errorHandler);
    const res = await request(app).post('/x').set('Content-Type', 'application/json').send('{"broken":');
    expect(res.status).toBe(400);
  });
});
