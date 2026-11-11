import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { makeUser, resetDb } from '../test/factories.js';

const app = createApp();

describe('Auth API against PostgreSQL (/api/v1/auth/*)', () => {
  beforeEach(resetDb);

  describe('POST /register', () => {
    it('creates a developer with a bcrypt hash and never returns the hash (201)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'New.Dev@Example.com', password: 'Password123!' });

      expect(res.status).toBe(201);
      expect(res.text).not.toContain('password_hash');
      const row = await prisma.user.findUnique({ where: { email: 'new.dev@example.com' } });
      expect(row?.role).toBe('developer');
      expect(row?.password_hash).not.toBe('Password123!');
      expect(await bcrypt.compare('Password123!', row!.password_hash)).toBe(true);
      expect(row!.password_hash.startsWith('$2b$12$')).toBe(true);
    });

    it('cannot self-register as admin (role is validated)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@example.com', password: 'Password123!', role: 'admin' });
      expect(res.status).toBe(400);
      expect(await prisma.user.count()).toBe(0);
    });

    it.each([
      ['invalid email', { email: 'not-an-email', password: 'Password123!' }],
      ['7-char password (boundary)', { email: 'a@example.com', password: 'Pass12!' }],
      ['password without a number', { email: 'a@example.com', password: 'Password!!' }],
    ])('rejects %s with 400 VALIDATION_ERROR', async (_label, body) => {
      const res = await request(app).post('/api/v1/auth/register').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.user.count()).toBe(0);
    });

    it('accepts an 8-char password (boundary)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'b@example.com', password: 'Pass123!' });
      expect(res.status).toBe(201);
    });

    it('rejects a duplicate email case-insensitively (409) and keeps one row', async () => {
      await request(app).post('/api/v1/auth/register').send({ email: 'dup@example.com', password: 'Password123!' });
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'DUP@example.com', password: 'Password123!' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(await prisma.user.count({ where: { email: 'dup@example.com' } })).toBe(1);
    });
  });

  describe('POST /login', () => {
    it('returns a JWT and sets an HttpOnly SameSite=Strict cookie (200)', async () => {
      const user = await makeUser('developer', 'Correct-horse-9');
      const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Correct-horse-9' });

      expect(res.status).toBe(200);
      expect(res.body.data.token.split('.')).toHaveLength(3);
      expect(res.body.data.user).toMatchObject({ user_id: user.user_id, role: 'developer' });
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });

    it('answers the same 401 for an unknown email and a wrong password (no user enumeration)', async () => {
      const user = await makeUser();
      const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' });
      const wrong = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'wrong-pass-1' });
      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(unknown.body.error).toEqual(wrong.body.error);
    });
  });

  describe('GET /me', () => {
    it('returns the profile for a Bearer token', async () => {
      const user = await makeUser('admin');
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', user.auth);
      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({ email: user.email, role: 'admin' });
    });

    it('works from the login cookie alone (browser session)', async () => {
      const user = await makeUser('developer', 'Cookie-pass-1');
      const agent = request.agent(app);
      await agent.post('/api/v1/auth/login').send({ email: user.email, password: 'Cookie-pass-1' });
      const res = await agent.get('/api/v1/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(user.email);
    });

    it('401 without a token and 401 INVALID_TOKEN for a forged one', async () => {
      expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
      const forged = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.');
      expect(forged.status).toBe(401);
      expect(forged.body.error.code).toBe('INVALID_TOKEN');
    });

    it('404 when the token belongs to a deleted account', async () => {
      const user = await makeUser();
      await prisma.user.delete({ where: { user_id: user.user_id } });
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', user.auth);
      expect(res.status).toBe(404);
    });
  });

  it('POST /logout clears the cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toMatch(/token=;/);
  });
});
