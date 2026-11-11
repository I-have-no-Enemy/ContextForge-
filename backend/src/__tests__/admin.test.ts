import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { makePendingReview, makeServer, makeSkill, makeUser, NIL_UUID, resetDb, type TestUser } from '../test/factories.js';

const app = createApp();
let admin: TestUser;
let dev: TestUser;

beforeEach(async () => {
  await resetDb();
  [admin, dev] = await Promise.all([makeUser('admin'), makeUser('developer')]);
});

describe('RBAC on every /admin route (OWASP A01)', () => {
  const routes: [string, string][] = [
    ['get', '/api/v1/admin/metrics'],
    ['get', '/api/v1/admin/submissions'],
    ['post', '/api/v1/admin/submissions/review'],
    ['post', '/api/v1/admin/takedown'],
    ['post', '/api/v1/admin/sync/github'],
  ];

  it.each(routes)('%s %s: 401 without token, 403 for a developer', async (method, path) => {
    const anon = await (request(app) as any)[method](path);
    expect(anon.status).toBe(401);
    const asDev = await (request(app) as any)[method](path).set('Authorization', dev.auth);
    expect(asDev.status).toBe(403);
    expect(asDev.body.error.code).toBe('FORBIDDEN');
  });

  it('a developer token with role edited to admin but a wrong signature is rejected', async () => {
    const [h, p] = dev.auth.replace('Bearer ', '').split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...payload, role: 'admin' })).toString('base64url')}.invalidsig`;
    const res = await request(app).get('/api/v1/admin/metrics').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/admin/submissions', () => {
  it('filters the queue by status and flagged_by_scan', async () => {
    const s1 = await makeSkill(dev, { verified: false });
    const s2 = await makeSkill(dev, { verified: false });
    await makePendingReview(dev, 'skill', s1.skill_id, true);
    await makePendingReview(dev, 'skill', s2.skill_id, false);

    const flagged = await request(app).get('/api/v1/admin/submissions?status=pending&flagged_by_scan=true').set('Authorization', admin.auth);
    expect(flagged.status).toBe(200);
    expect(flagged.body.data.map((r: any) => r.item_id)).toEqual([s1.skill_id]);
    const all = await request(app).get('/api/v1/admin/submissions?status=pending').set('Authorization', admin.auth);
    expect(all.body.pagination.total).toBe(2);
  });

  it('400 for an invalid status filter', async () => {
    const res = await request(app).get('/api/v1/admin/submissions?status=maybe').set('Authorization', admin.auth);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/admin/submissions/review (spec US4)', () => {
  it('approve flips is_verified in the same transaction and closes the pending review', async () => {
    const server = await makeServer(dev, { verified: false });
    await makePendingReview(dev, 'server', server.server_id);

    const res = await request(app)
      .post('/api/v1/admin/submissions/review')
      .set('Authorization', admin.auth)
      .send({ item_type: 'server', item_id: server.server_id, status: 'approved', review_notes: 'Checked' });

    expect(res.status).toBe(200);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: server.server_id } })).is_verified).toBe(true);
    const reviews = await prisma.submissionReview.findMany({ where: { item_id: server.server_id } });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ status: 'approved', reviewer_id: admin.user_id, review_notes: 'Checked' });
    expect((await request(app).get(`/api/v1/servers/${server.server_id}`)).status).toBe(200);
  });

  it('reject keeps the skill unverified and records the reason', async () => {
    const skill = await makeSkill(dev, { verified: false });
    await makePendingReview(dev, 'skill', skill.skill_id, true);
    await request(app)
      .post('/api/v1/admin/submissions/review')
      .set('Authorization', admin.auth)
      .send({ item_type: 'skill', item_id: skill.skill_id, status: 'rejected', review_notes: 'Exfiltration pattern' });

    expect((await prisma.aiSkill.findUniqueOrThrow({ where: { skill_id: skill.skill_id } })).is_verified).toBe(false);
    expect(await prisma.submissionReview.findFirstOrThrow({ where: { item_id: skill.skill_id } })).toMatchObject({
      status: 'rejected',
      review_notes: 'Exfiltration pattern',
    });
  });

  it('approving twice leaves the same state (idempotent)', async () => {
    const server = await makeServer(dev, { verified: false });
    await makePendingReview(dev, 'server', server.server_id);
    const send = () =>
      request(app)
        .post('/api/v1/admin/submissions/review')
        .set('Authorization', admin.auth)
        .send({ item_type: 'server', item_id: server.server_id, status: 'approved' });
    await send();
    await send();
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: server.server_id } })).is_verified).toBe(true);
    expect(await prisma.submissionReview.count({ where: { item_id: server.server_id, status: 'pending' } })).toBe(0);
  });

  it('polymorphic integrity: item_type server with a skill id is 400 and changes nothing', async () => {
    const skill = await makeSkill(dev, { verified: false });
    const res = await request(app)
      .post('/api/v1/admin/submissions/review')
      .set('Authorization', admin.auth)
      .send({ item_type: 'server', item_id: skill.skill_id, status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('POLYMORPHIC_REFERENCE_ERROR');
    expect((await prisma.aiSkill.findUniqueOrThrow({ where: { skill_id: skill.skill_id } })).is_verified).toBe(false);
  });
});

describe('POST /api/v1/admin/takedown', () => {
  it('unverifies, soft deletes and writes an audit entry; existing snapshots survive', async () => {
    const server = await makeServer(dev);
    const cfg = await request(app).post('/api/v1/configs/generate').send({ client_type: 'cline', selected_server_ids: [server.server_id] });

    const res = await request(app)
      .post('/api/v1/admin/takedown')
      .set('Authorization', admin.auth)
      .send({ item_type: 'server', item_id: server.server_id, reason: 'Reported credential stealer' });

    expect(res.status).toBe(200);
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: server.server_id } });
    expect(row).toMatchObject({ is_verified: false, is_deleted: true });
    const audit = await prisma.submissionReview.findFirstOrThrow({ where: { item_id: server.server_id } });
    expect(audit.review_notes).toBe('[EMERGENCY TAKEDOWN] Reported credential stealer');
    expect(audit.reviewer_id).toBe(admin.user_id);
    expect((await request(app).get('/api/v1/servers')).body.data).toHaveLength(0);
    expect((await request(app).get(`/api/v1/configs/${cfg.body.data.config_id}`)).status).toBe(200);
  });

  it('404 for an unknown item, 400 for a reason under 5 characters', async () => {
    const missing = await request(app).post('/api/v1/admin/takedown').set('Authorization', admin.auth).send({ item_type: 'skill', item_id: NIL_UUID, reason: 'malicious' });
    expect(missing.status).toBe(404);
    const short = await request(app).post('/api/v1/admin/takedown').set('Authorization', admin.auth).send({ item_type: 'skill', item_id: NIL_UUID, reason: 'bad' });
    expect(short.status).toBe(400);
  });
});

describe('GET /api/v1/admin/metrics (AC8)', () => {
  it('counts the real rows by lifecycle, queue state, role and client', async () => {
    await makeServer(dev);
    await makeServer(dev, { verified: false });
    await makeServer(dev, { deleted: true });
    const pendingSkill = await makeSkill(dev, { verified: false });
    await makePendingReview(dev, 'skill', pendingSkill.skill_id, true);
    const live = await makeServer(dev, { name: 'popular' });
    await request(app).post('/api/v1/configs/generate').send({ client_type: 'cursor', selected_server_ids: [live.server_id] });

    const res = await request(app).get('/api/v1/admin/metrics').set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual({ total: 2, by_role: { admin: 1, developer: 1 } });
    expect(res.body.data.servers).toEqual({ live: 2, unverified: 1, deleted: 1 });
    expect(res.body.data.skills).toEqual({ live: 0, unverified: 1, deleted: 0 });
    expect(res.body.data.queue).toEqual({ pending: 1, flagged_pending: 1, approved: 0, rejected: 0 });
    expect(res.body.data.configs).toEqual({ total: 1, by_client: { cursor: 1 } });
    expect(res.body.data.top_servers[0]).toMatchObject({ name: 'popular', downloads_count: 1 });
  });
});
