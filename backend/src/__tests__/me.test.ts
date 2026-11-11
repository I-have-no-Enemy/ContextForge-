import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { makePendingReview, makeServer, makeSkill, makeUser, resetDb, type TestUser } from '../test/factories.js';

const app = createApp();
let a: TestUser;
let b: TestUser;

beforeEach(async () => {
  await resetDb();
  [a, b] = await Promise.all([makeUser(), makeUser()]);
});

describe('Owner views (/me): the id comes from the JWT, never the URL (AC7)', () => {
  it('401 without a token on every /me route', async () => {
    for (const path of ['/api/v1/servers/me', '/api/v1/skills/me', '/api/v1/configs/me']) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });

  it('GET /servers/me: only my servers, every review state, with the latest review attached', async () => {
    const live = await makeServer(a, { name: 'a-live' });
    const pending = await makeServer(a, { name: 'a-pending', verified: false });
    await makeServer(a, { name: 'a-deleted', deleted: true });
    await makeServer(b, { name: 'b-server' });
    await prisma.submissionReview.create({
      data: { item_type: 'server', item_id: live.server_id, reviewer_id: a.user_id, status: 'approved', reviewed_at: new Date(Date.now() - 1000) },
    });
    await makePendingReview(a, 'server', pending.server_id);

    const res = await request(app).get('/api/v1/servers/me').set('Authorization', a.auth);

    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.data.map((s: any) => [s.name, s.latest_review?.status]));
    expect(byName).toEqual({ 'a-live': 'approved', 'a-pending': 'pending' });
    expect(res.body.pagination.total).toBe(2);
  });

  it('GET /skills/me: user B never sees user A skills', async () => {
    await makeSkill(a, { name: 'a-skill', verified: false });
    const res = await request(app).get('/api/v1/skills/me').set('Authorization', b.auth);
    expect(res.body.data).toEqual([]);
    const mine = await request(app).get('/api/v1/skills/me').set('Authorization', a.auth);
    expect(mine.body.data.map((s: any) => s.name)).toEqual(['a-skill']);
  });

  it('"me" is routed before :id, so it is not parsed as a UUID', async () => {
    const res = await request(app).get('/api/v1/servers/me').set('Authorization', a.auth);
    expect(res.body.error).toBeNull();
  });
});
