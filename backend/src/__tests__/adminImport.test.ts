import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { makeUser, makeSkill, resetDb, type TestUser } from '../test/factories.js';

const app = createApp();
let admin: TestUser;
let developer: TestUser;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser('admin');
  developer = await makeUser('developer');
});

/** An imported skill waiting in the queue, the way the importer leaves it. */
async function importedSkill(name: string, flagged: boolean) {
  const skill = await prisma.aiSkill.create({
    data: {
      name, skill_content: '# demo', is_verified: false, submitted_by: admin.user_id,
      source_url: `https://github.com/acme/skills/blob/${'a'.repeat(40)}/${name}/SKILL.md`, source_license: 'MIT', source_ref: 'a'.repeat(40),
    },
  });
  await prisma.submissionReview.create({
    data: { item_type: 'skill', item_id: skill.skill_id, reviewer_id: admin.user_id, status: 'pending', flagged_by_scan: flagged, review_notes: 'Imported from test' },
  });
  return skill;
}

describe('POST /admin/import/github access and input (AC-I6, OWASP A01, A10)', () => {
  const body = { url: 'https://github.com/acme/skills', kind: 'skill', dry_run: true };

  it('401 without a token, 403 for a developer', async () => {
    expect((await request(app).post('/api/v1/admin/import/github').send(body)).status).toBe(401);
    const res = await request(app).post('/api/v1/admin/import/github').set('Authorization', developer.auth).send(body);
    expect(res.status).toBe(403);
    expect(await prisma.aiSkill.count()).toBe(0);
  });

  it.each([
    [{ url: 'https://169.254.169.254/latest', kind: 'skill' }, 'INVALID_IMPORT_URL'],
    [{ url: 'https://github.com.evil.example/a/b', kind: 'mcp' }, 'INVALID_IMPORT_URL'],
    [{ url: 'https://github.com/acme/skills', kind: 'plugin' }, 'VALIDATION_ERROR'],
    [{ url: 'https://github.com/acme/skills', kind: 'skill', limit: 5000 }, 'VALIDATION_ERROR'],
    [{ url: 'https://github.com/acme/skills', kind: 'skill', min_stars: -1 }, 'VALIDATION_ERROR'],
    [{ kind: 'skill' }, 'VALIDATION_ERROR'],
  ])('400 for %j', async (payload, code) => {
    const res = await request(app).post('/api/v1/admin/import/github').set('Authorization', admin.auth).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(code);
  });
});

describe('POST /admin/submissions/approve-clean (AC-I7)', () => {
  const call = (as: TestUser | null, item_type = 'skill') => {
    const r = request(app).post('/api/v1/admin/submissions/approve-clean').send({ item_type });
    return as ? r.set('Authorization', as.auth) : r;
  };

  it('is admin only', async () => {
    expect((await call(null)).status).toBe(401);
    expect((await call(developer)).status).toBe(403);
  });

  it('approves clean imports with one review each and leaves flagged ones in the queue', async () => {
    const a = await importedSkill('clean-one', false);
    const b = await importedSkill('clean-two', false);
    const flagged = await importedSkill('flagged-one', true);

    const res = await call(admin);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ approved: 2, left_in_queue_flagged: 1 });

    expect((await prisma.aiSkill.findUniqueOrThrow({ where: { skill_id: a.skill_id } })).is_verified).toBe(true);
    expect((await prisma.aiSkill.findUniqueOrThrow({ where: { skill_id: b.skill_id } })).is_verified).toBe(true);
    expect((await prisma.aiSkill.findUniqueOrThrow({ where: { skill_id: flagged.skill_id } })).is_verified).toBe(false);

    const reviews = await prisma.submissionReview.findMany({ where: { item_id: { in: [a.skill_id, b.skill_id] } } });
    expect(reviews).toHaveLength(2);
    expect(reviews.every((r) => r.status === 'approved' && r.reviewer_id === admin.user_id)).toBe(true);
    expect((await prisma.submissionReview.findFirstOrThrow({ where: { item_id: flagged.skill_id } })).status).toBe('pending');
  });

  it('treats imported MCP servers the same way: clean ones are approved, a flagged one stays in the queue', async () => {
    const make = async (name: string, flagged: boolean) => {
      const server = await prisma.mcpServer.create({
        data: { name, install_command: 'npx -y @acme/mcp-x', is_verified: false, submitted_by: admin.user_id, source_url: `https://github.com/acme/${name}`, source_license: 'MIT', source_ref: 'main' },
      });
      await prisma.submissionReview.create({
        data: { item_type: 'server', item_id: server.server_id, reviewer_id: admin.user_id, status: 'pending', flagged_by_scan: flagged, review_notes: 'Imported from test' },
      });
      return server;
    };
    const clean = await make('clean-server', false);
    const flagged = await make('flagged-server', true);

    const res = await call(admin, 'server');
    expect(res.body.data).toEqual({ approved: 1, left_in_queue_flagged: 1 });
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: clean.server_id } })).is_verified).toBe(true);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: flagged.server_id } })).is_verified).toBe(false);
  });

  it('is idempotent: a second call approves nothing new', async () => {
    await importedSkill('clean-one', false);
    expect((await call(admin)).body.data.approved).toBe(1);
    expect((await call(admin)).body.data.approved).toBe(0);
  });

  it('never touches a hand-submitted listing, only imports', async () => {
    const manual = await makeSkill(developer, { name: 'hand-made', verified: false });
    await prisma.submissionReview.create({
      data: { item_type: 'skill', item_id: manual.skill_id, reviewer_id: developer.user_id, status: 'pending', flagged_by_scan: false },
    });
    expect((await call(admin)).body.data.approved).toBe(0);
    expect((await prisma.aiSkill.findUniqueOrThrow({ where: { skill_id: manual.skill_id } })).is_verified).toBe(false);
  });

  it('two admins pressing at once approve each item once', async () => {
    await importedSkill('race-one', false);
    await importedSkill('race-two', false);
    const [x, y] = await Promise.all([call(admin), call(admin)]);
    expect(x.status).toBe(200);
    expect(y.status).toBe(200);
    expect(await prisma.submissionReview.count({ where: { status: 'approved' } })).toBe(2);
    expect(await prisma.aiSkill.count({ where: { is_verified: true } })).toBe(2);
  });
});
