import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { getJwtSecret } from '../config/env.js';

const app = createApp();
const admin = jwt.sign({ id: 'aaaaaaaa-1111-4111-8111-0000000000ad', email: 'admin@x.io', role: 'admin' }, getJwtSecret());
const dev = jwt.sign({ id: 'aaaaaaaa-1111-4111-8111-0000000000de', email: 'dev@x.io', role: 'developer' }, getJwtSecret());

describe('Admin operations', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('AC8: GET /api/v1/admin/metrics', () => {
    it('401 without token, 403 for developer', async () => {
      expect((await request(app).get('/api/v1/admin/metrics')).status).toBe(401);
      expect((await request(app).get('/api/v1/admin/metrics').set('Authorization', `Bearer ${dev}`)).status).toBe(403);
    });

    it('200 for admin with grouped registry, queue, user and config numbers', async () => {
      vi.spyOn(prisma.user, 'groupBy').mockResolvedValue([
        { role: 'admin', _count: { _all: 1 } },
        { role: 'developer', _count: { _all: 4 } },
      ] as any);
      vi.spyOn(prisma.mcpServer, 'groupBy').mockResolvedValue([
        { is_verified: true, is_deleted: false, _count: { _all: 3 } },
        { is_verified: false, is_deleted: false, _count: { _all: 2 } },
        { is_verified: false, is_deleted: true, _count: { _all: 1 } },
      ] as any);
      vi.spyOn(prisma.aiSkill, 'groupBy').mockResolvedValue([
        { is_verified: true, is_deleted: false, _count: { _all: 5 } },
      ] as any);
      vi.spyOn(prisma.submissionReview, 'groupBy').mockResolvedValue([
        { status: 'pending', flagged_by_scan: true, _count: { _all: 2 } },
        { status: 'pending', flagged_by_scan: false, _count: { _all: 1 } },
        { status: 'approved', flagged_by_scan: false, _count: { _all: 7 } },
      ] as any);
      vi.spyOn(prisma.clientConfig, 'groupBy').mockResolvedValue([
        { client_type: 'cursor', _count: { _all: 4 } },
      ] as any);
      vi.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([{ server_id: 's', name: 'pg', downloads_count: 9 }] as any);
      vi.spyOn(prisma.aiSkill, 'findMany').mockResolvedValue([]);

      const res = await request(app).get('/api/v1/admin/metrics').set('Authorization', `Bearer ${admin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users).toEqual({ total: 5, by_role: { admin: 1, developer: 4 } });
      expect(res.body.data.servers).toEqual({ live: 3, unverified: 2, deleted: 1 });
      expect(res.body.data.skills).toEqual({ live: 5, unverified: 0, deleted: 0 });
      expect(res.body.data.queue).toEqual({ pending: 3, flagged_pending: 2, approved: 7, rejected: 0 });
      expect(res.body.data.configs).toEqual({ total: 4, by_client: { cursor: 4 } });
      expect(res.body.data.top_servers[0].name).toBe('pg');
    });
  });

  describe('AC9: POST /api/v1/admin/sync/github', () => {
    it('is admin-only', async () => {
      expect((await request(app).post('/api/v1/admin/sync/github').set('Authorization', `Bearer ${dev}`)).status).toBe(403);
    });
  });
});
