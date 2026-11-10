import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { getJwtSecret } from '../config/env.js';

const app = createApp();
const userA = { id: 'aaaaaaaa-1111-4111-8111-000000000001', email: 'a@example.com', role: 'developer' as const };
const tokenA = jwt.sign(userA, getJwtSecret(), { expiresIn: '1h' });
const SRV_1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const SRV_2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';

describe('Owner-scoped endpoints (/me) - id comes from the JWT, never the URL', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('AC7: GET /servers/me without a token is 401', async () => {
    const res = await request(app).get('/api/v1/servers/me');
    expect(res.status).toBe(401);
  });

  it('AC7: GET /servers/me filters by the token user and attaches the latest review in one batched query', async () => {
    vi.spyOn(prisma.mcpServer, 'count').mockResolvedValue(2);
    const findMany = vi.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([
      { server_id: SRV_1, name: 'one', is_verified: true },
      { server_id: SRV_2, name: 'two', is_verified: false },
    ] as any);
    const reviews = vi.spyOn(prisma.submissionReview, 'findMany').mockResolvedValue([
      { item_id: SRV_2, status: 'pending', flagged_by_scan: false, review_notes: 'queued', reviewed_at: new Date('2026-11-10') },
      { item_id: SRV_1, status: 'approved', flagged_by_scan: false, review_notes: 'ok', reviewed_at: new Date('2026-11-09') },
      { item_id: SRV_1, status: 'pending', flagged_by_scan: false, review_notes: 'old', reviewed_at: new Date('2026-11-01') },
    ] as any);

    const res = await request(app).get('/api/v1/servers/me?page=1&limit=10').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const where = (findMany.mock.calls[0][0] as any).where;
    expect(where).toMatchObject({ submitted_by: userA.id, is_deleted: false });
    expect(where).not.toHaveProperty('is_verified');
    expect(reviews).toHaveBeenCalledTimes(1);
    expect(res.body.data.map((s: any) => s.latest_review?.status)).toEqual(['approved', 'pending']);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10, total: 2 });
  });

  it('AC7: GET /skills/me returns only the caller skills, including unverified ones', async () => {
    vi.spyOn(prisma.aiSkill, 'count').mockResolvedValue(0);
    const findMany = vi.spyOn(prisma.aiSkill, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.submissionReview, 'findMany').mockResolvedValue([]);

    const res = await request(app).get('/api/v1/skills/me').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect((findMany.mock.calls[0][0] as any).where).toMatchObject({ submitted_by: userA.id, is_deleted: false });
  });

  it('T8: GET /configs/me lists only the caller configs, newest first, bounded by limit', async () => {
    vi.spyOn(prisma.clientConfig, 'count').mockResolvedValue(1);
    const findMany = vi.spyOn(prisma.clientConfig, 'findMany').mockResolvedValue([
      { config_id: 'cccccccc-0000-4000-8000-000000000001', client_type: 'cursor', created_at: new Date() },
    ] as any);

    const res = await request(app).get('/api/v1/configs/me?limit=500').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const args = findMany.mock.calls[0][0] as any;
    expect(args.where).toEqual({ user_id: userA.id });
    expect(args.orderBy).toEqual({ created_at: 'desc' });
    expect(args.take).toBeLessThanOrEqual(100);
    expect(res.body.data[0].id).toBe('cccccccc-0000-4000-8000-000000000001');
  });

  it('T8: GET /configs/me without a token is 401', async () => {
    expect((await request(app).get('/api/v1/configs/me')).status).toBe(401);
  });
});
