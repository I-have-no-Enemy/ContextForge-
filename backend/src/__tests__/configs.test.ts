import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { makeServer, makeSkill, makeUser, NIL_UUID, resetDb, type TestUser } from '../test/factories.js';

const app = createApp();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let dev: TestUser;

beforeEach(async () => {
  await resetDb();
  dev = await makeUser();
});

describe('POST /api/v1/configs/generate (spec US2)', () => {
  it('builds the Cursor file, stores the snapshot and bumps both download counters', async () => {
    const server = await makeServer(dev, { name: 'github', env: ['GITHUB_PERSONAL_ACCESS_TOKEN'] });
    const skill = await makeSkill(dev, { name: 'tdd-loop' });

    const res = await request(app)
      .post('/api/v1/configs/generate')
      .set('Authorization', dev.auth)
      .send({ client_type: 'cursor', selected_server_ids: [server.server_id], selected_skill_ids: [skill.skill_id] });

    expect(res.status).toBe(201);
    const files = res.body.data.generated_json;
    expect(files.config_path).toBe('.cursor/mcp.json');
    expect(files.config.mcpServers.github.env).toEqual({ GITHUB_PERSONAL_ACCESS_TOKEN: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE' });
    expect(files.skill_files[0].path).toBe('.cursor/rules/tdd-loop.mdc');

    const stored = await prisma.clientConfig.findUniqueOrThrow({ where: { config_id: res.body.data.config_id } });
    expect(stored.user_id).toBe(dev.user_id);
    expect(stored.selected_server_ids).toEqual([server.server_id]);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: server.server_id } })).downloads_count).toBe(1);
    expect((await prisma.aiSkill.findUniqueOrThrow({ where: { skill_id: skill.skill_id } })).downloads_count).toBe(1);
  });

  it('works anonymously (user_id null) and de-duplicates repeated ids', async () => {
    const server = await makeServer(dev);
    const res = await request(app)
      .post('/api/v1/configs/generate')
      .send({ client_type: 'claude_desktop', selected_server_ids: [server.server_id, server.server_id] });
    expect(res.status).toBe(201);
    expect((await prisma.clientConfig.findFirstOrThrow()).user_id).toBeNull();
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: server.server_id } })).downloads_count).toBe(1);
  });

  it.each([
    ['unverified', { verified: false }],
    ['soft-deleted', { deleted: true }],
  ])('rejects a %s server with 400 naming the id, and writes nothing', async (_l, opts) => {
    const good = await makeServer(dev);
    const bad = await makeServer(dev, opts);
    const res = await request(app)
      .post('/api/v1/configs/generate')
      .send({ client_type: 'cline', selected_server_ids: [good.server_id, bad.server_id] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SELECTION');
    expect(res.body.error.details.rejected_server_ids).toEqual([bad.server_id]);
    expect(await prisma.clientConfig.count()).toBe(0);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: good.server_id } })).downloads_count).toBe(0);
  });

  it('rejects an unknown skill id and an empty selection', async () => {
    const unknown = await request(app).post('/api/v1/configs/generate').send({ client_type: 'cursor', selected_skill_ids: [NIL_UUID] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.details.rejected_skill_ids).toEqual([NIL_UUID]);
    const empty = await request(app).post('/api/v1/configs/generate').send({ client_type: 'cursor' });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unsupported client_type', async () => {
    const server = await makeServer(dev);
    const res = await request(app).post('/api/v1/configs/generate').send({ client_type: 'vim', selected_server_ids: [server.server_id] });
    expect(res.status).toBe(400);
  });

  it('AC4: a takedown that commits mid-request rolls the generation back (row lock race)', async () => {
    const server = await makeServer(dev);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    // Admin transaction: flips the row and holds the lock until we release it.
    const takedown = prisma.$transaction(
      async (tx) => {
        await tx.mcpServer.update({ where: { server_id: server.server_id }, data: { is_verified: false, is_deleted: true } });
        await gate;
      },
      { timeout: 20_000 }
    );
    await sleep(500);

    // Generation reads the last committed row (still verified), then blocks on the lock at updateMany.
    const generation = request(app)
      .post('/api/v1/configs/generate')
      .send({ client_type: 'cursor', selected_server_ids: [server.server_id] })
      .then((r) => r);
    await sleep(1_500);
    release();
    await takedown;
    const res = await generation;

    expect(res.status).toBe(400);
    expect(res.body.error.details.rejected_server_ids).toEqual([server.server_id]);
    expect(await prisma.clientConfig.count()).toBe(0);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: server.server_id } })).downloads_count).toBe(0);
  });
});

describe('GET /api/v1/configs/:id and /me', () => {
  it('snapshot stays byte-identical after the server is deleted (immutability)', async () => {
    const server = await makeServer(dev, { name: 'snapshot-me' });
    const created = await request(app).post('/api/v1/configs/generate').send({ client_type: 'cursor', selected_server_ids: [server.server_id] });
    await prisma.mcpServer.update({ where: { server_id: server.server_id }, data: { is_deleted: true, name: 'renamed' } });

    const res = await request(app).get(`/api/v1/configs/${created.body.data.config_id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.generated_json).toEqual(created.body.data.generated_json);
    expect(Object.keys(res.body.data.generated_json.config.mcpServers)).toEqual(['snapshot-me']);
  });

  it('400 for a malformed id, 404 for an unknown one', async () => {
    expect((await request(app).get('/api/v1/configs/abc')).status).toBe(400);
    expect((await request(app).get(`/api/v1/configs/${NIL_UUID}`)).status).toBe(404);
  });

  it('GET /configs/me lists only the caller history, newest first; 401 without token', async () => {
    const other = await makeUser();
    const server = await makeServer(dev);
    for (const [who, client] of [
      [dev, 'cursor'],
      [other, 'cline'],
      [dev, 'antigravity'],
    ] as const) {
      await request(app).post('/api/v1/configs/generate').set('Authorization', who.auth).send({ client_type: client, selected_server_ids: [server.server_id] });
      await sleep(20);
    }

    const res = await request(app).get('/api/v1/configs/me').set('Authorization', dev.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: any) => c.client_type)).toEqual(['antigravity', 'cursor']);
    expect((await request(app).get('/api/v1/configs/me')).status).toBe(401);
  });
});
