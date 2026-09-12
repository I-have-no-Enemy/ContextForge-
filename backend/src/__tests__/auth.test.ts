import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';

const app = createApp();
const JWT_SECRET = process.env.JWT_SECRET || 'contextforge_fallback_dev_secret_key_2026';

describe('Authentication API Endpoints (/api/v1/auth/*)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully (HTTP 201)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'user-uuid-1',
        email: 'newdev@example.com',
        role: 'developer',
        created_at: new Date(),
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newdev@example.com',
          password: 'Password123!',
          role: 'developer',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user).toHaveProperty('id', 'user-uuid-1');
      expect(response.body.data.user).toHaveProperty('email', 'newdev@example.com');
      expect(response.body.data.user).toHaveProperty('role', 'developer');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should reject registration with invalid email (HTTP 400)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email-format',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject registration with short password (HTTP 400)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'valid@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate email registration (HTTP 409)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'existing-id',
        email: 'existing@example.com',
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate user and return signed JWT + Set-Cookie (HTTP 200)', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid-2',
        email: 'user@example.com',
        password_hash: passwordHash,
        role: 'developer',
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'CorrectPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('id', 'user-uuid-2');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 when email is not found', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'notfound@example.com',
          password: 'SomePassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 on incorrect password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid-2',
        email: 'user@example.com',
        password_hash: passwordHash,
        role: 'developer',
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return profile with valid Bearer token (HTTP 200)', async () => {
      const token = jwt.sign(
        { id: 'user-uuid-3', email: 'verified@example.com', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid-3',
        email: 'verified@example.com',
        role: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user).toHaveProperty('id', 'user-uuid-3');
      expect(response.body.data.user).toHaveProperty('role', 'admin');
    });

    it('should return 401 when Authorization header is missing', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear authentication cookie (HTTP 200)', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie'][0]).toContain('token=;');
    });
  });
});
