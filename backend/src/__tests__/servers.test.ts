import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { makeServer, makeUser, NIL_UUID, resetDb, type TestUser } from '../test/factories.js';

const app = createApp();
let owner: TestUser;
let other: TestUser;
let admin: TestUser;

beforeEach(async () => {
  await resetDb();
  [owner, other, admin] = await Promise.all([makeUser(), makeUser(), makeUser('admin')]);
});

describe('GET /api/v1/servers (public discovery, spec US1)', () => {
  it('lists only verified, non-deleted servers with pagination', async () => {
    await makeServer(owner, { name: 'live-one' });
    await makeServer(owner, { name: 'live-two' });
    await makeServer(owner, { name: 'pending', verified: false });
    await makeServer(owner, { name: 'removed', deleted: true });

    const res = await request(app).get('/api/v1/servers?page=1&limit=1');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(res.body.data).toHaveLength(1);
    const all = await request(app).get('/api/v1/servers?limit=100');
    expect(all.body.data.map((s: any) => s.name).sort()).toEqual(['live-one', 'live-two']);
  });

  it('searches name and description case-insensitively', async () => {
    await makeServer(owner, { name: 'postgres-inspector' });
    await makeServer(owner, { name: 'other-thing' });
    const res = await request(app).get('/api/v1/servers?search=POSTGRES');
    expect(res.body.data.map((s: any) => s.name)).toEqual(['postgres-inspector']);
  });

  it('includes each tool risk level so cards can show the highest risk', async () => {
    await makeServer(owner, { tools: [{ name: 'rm_rf', risk_level: 'destructive' }] });
    const res = await request(app).get('/api/v1/servers');
    expect(res.body.data[0].tools).toEqual([{ name: 'rm_rf', risk_level: 'destructive' }]);
  });

  it('clamps limit to 100 (bounded list)', async () => {
    const res = await request(app).get('/api/v1/servers?limit=5000');
    expect(res.body.pagination.limit).toBe(100);
  });
});

describe('GET /api/v1/servers/:id', () => {
  it('returns a verified server with tools and author email', async () => {
    const s = await makeServer(owner, { tools: [{ name: 'query', risk_level: 'read_only' }] });
    const res = await request(app).get(`/api/v1/servers/${s.server_id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tools).toHaveLength(1);
    expect(res.body.data.user).toEqual({ email: owner.email });
  });

  it('hides an unverified server from public and other developers, shows it to owner and admin', async () => {
    const s = await makeServer(owner, { verified: false });
    expect((await request(app).get(`/api/v1/servers/${s.server_id}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/servers/${s.server_id}`).set('Authorization', other.auth)).status).toBe(404);
    expect((await request(app).get(`/api/v1/servers/${s.server_id}`).set('Authorization', owner.auth)).status).toBe(200);
    expect((await request(app).get(`/api/v1/servers/${s.server_id}`).set('Authorization', admin.auth)).status).toBe(200);
  });

  it('404 for deleted or unknown, 400 INVALID_ID for a malformed id (AC11)', async () => {
    const s = await makeServer(owner, { deleted: true });
    expect((await request(app).get(`/api/v1/servers/${s.server_id}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/servers/${NIL_UUID}`)).status).toBe(404);
    const bad = await request(app).get("/api/v1/servers/1'%20OR%20'1'='1");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_ID');
  });
});

describe('POST /api/v1/servers (submission, spec US3)', () => {
  const body = { name: 'my-server', install_command: 'npx -y my-server', required_env_vars: ['API_KEY'] };

  it('401 without a token, nothing stored', async () => {
    expect((await request(app).post('/api/v1/servers').send(body)).status).toBe(401);
    expect(await prisma.mcpServer.count()).toBe(0);
  });

  it('stores the server unverified and queues one pending review in the same transaction', async () => {
    const res = await request(app).post('/api/v1/servers').set('Authorization', owner.auth).send(body);

    expect(res.status).toBe(201);
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { name: 'my-server' } });
    expect(row).toMatchObject({ is_verified: false, submitted_by: owner.user_id, required_env_vars: ['API_KEY'] });
    const reviews = await prisma.submissionReview.findMany({ where: { item_id: row.server_id } });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ item_type: 'server', status: 'pending' });
  });

  it('409 on a duplicate name', async () => {
    await makeServer(owner, { name: 'my-server' });
    const res = await request(app).post('/api/v1/servers').set('Authorization', other.auth).send(body);
    expect(res.status).toBe(409);
  });

  it('rejects env var values pasted as names and an invalid name (400)', async () => {
    const res = await request(app)
      .post('/api/v1/servers')
      .set('Authorization', owner.auth)
      .send({ ...body, name: 'Bad Name', required_env_vars: ['sk-live-123'] });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: any) => d.field).sort()).toEqual(['name', 'required_env_vars.0']);
  });
});

describe('PATCH /api/v1/servers/:id (OWASP A01 + A04)', () => {
  it('403 when another developer edits, and the row is unchanged (IDOR)', async () => {
    const s = await makeServer(owner);
    const res = await request(app).patch(`/api/v1/servers/${s.server_id}`).set('Authorization', other.auth).send({ description: 'hijacked' });
    expect(res.status).toBe(403);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: s.server_id } })).description).toBe('Integration test server');
  });

  it('AC2: an owner edit of a verified server drops verification and re-queues review', async () => {
    const s = await makeServer(owner, { verified: true });
    const res = await request(app)
      .patch(`/api/v1/servers/${s.server_id}`)
      .set('Authorization', owner.auth)
      .send({ install_command: 'npx -y totally-different-package' });

    expect(res.status).toBe(200);
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: s.server_id } });
    expect(row).toMatchObject({ is_verified: false, install_command: 'npx -y totally-different-package' });
    expect(await prisma.submissionReview.count({ where: { item_id: s.server_id, status: 'pending' } })).toBe(1);
    expect((await request(app).get(`/api/v1/servers/${s.server_id}`)).status).toBe(404);
  });

  it('two owner edits keep a single pending review (idempotent queue)', async () => {
    const s = await makeServer(owner);
    for (const d of ['one', 'two']) {
      await request(app).patch(`/api/v1/servers/${s.server_id}`).set('Authorization', owner.auth).send({ description: d });
    }
    expect(await prisma.submissionReview.count({ where: { item_id: s.server_id, status: 'pending' } })).toBe(1);
  });

  it('an admin edit keeps verification', async () => {
    const s = await makeServer(owner);
    await request(app).patch(`/api/v1/servers/${s.server_id}`).set('Authorization', admin.auth).send({ description: 'typo fix' });
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: s.server_id } })).is_verified).toBe(true);
  });

  it('ignores fields outside the schema (mass assignment: is_verified, submitted_by)', async () => {
    const s = await makeServer(owner, { verified: false });
    await request(app)
      .patch(`/api/v1/servers/${s.server_id}`)
      .set('Authorization', owner.auth)
      .send({ description: 'x', is_verified: true, submitted_by: other.user_id, downloads_count: 9999 });
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: s.server_id } });
    expect(row).toMatchObject({ is_verified: false, submitted_by: owner.user_id, downloads_count: 0 });
  });
});

describe('DELETE /api/v1/servers/:id (soft delete)', () => {
  it('AC6: owner delete answers 204 and sets is_deleted + deleted_at', async () => {
    const s = await makeServer(owner);
    const res = await request(app).delete(`/api/v1/servers/${s.server_id}`).set('Authorization', owner.auth);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { server_id: s.server_id } });
    expect(row.is_deleted).toBe(true);
    expect(row.deleted_at).toBeInstanceOf(Date);
  });

  it('403 for another developer; second delete is 404', async () => {
    const s = await makeServer(owner);
    expect((await request(app).delete(`/api/v1/servers/${s.server_id}`).set('Authorization', other.auth)).status).toBe(403);
    expect((await request(app).delete(`/api/v1/servers/${s.server_id}`).set('Authorization', owner.auth)).status).toBe(204);
    expect((await request(app).delete(`/api/v1/servers/${s.server_id}`).set('Authorization', owner.auth)).status).toBe(404);
  });
});

describe('Tools (/api/v1/servers/:id/tools)', () => {
  it('AC3: tools of an unverified server are 404 for the public, visible to the owner', async () => {
    const s = await makeServer(owner, { verified: false, tools: [{ name: 'secret_tool', risk_level: 'network' }] });
    expect((await request(app).get(`/api/v1/servers/${s.server_id}/tools`)).status).toBe(404);
    const mine = await request(app).get(`/api/v1/servers/${s.server_id}/tools`).set('Authorization', owner.auth);
    expect(mine.body.data.map((t: any) => t.name)).toEqual(['secret_tool']);
  });

  it('owner adds a tool with its JSON schema; invalid risk level is 400', async () => {
    const s = await makeServer(owner);
    const ok = await request(app)
      .post(`/api/v1/servers/${s.server_id}/tools`)
      .set('Authorization', owner.auth)
      .send({ name: 'write_table', risk_level: 'destructive', input_schema: { type: 'object' } });
    expect(ok.status).toBe(201);
    const bad = await request(app)
      .post(`/api/v1/servers/${s.server_id}/tools`)
      .set('Authorization', owner.auth)
      .send({ name: 'x_tool', risk_level: 'super_admin' });
    expect(bad.status).toBe(400);
    const tools = await prisma.toolDefinition.findMany({ where: { server_id: s.server_id } });
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ risk_level: 'destructive', input_schema: { type: 'object' } });
  });

  it('another developer cannot add or delete tools (403), nothing changes', async () => {
    const s = await makeServer(owner, { tools: [{ name: 'keep_me', risk_level: 'read_only' }] });
    const toolId = s.tools[0].tool_id;
    expect(
      (await request(app).post(`/api/v1/servers/${s.server_id}/tools`).set('Authorization', other.auth).send({ name: 'evil_tool' })).status
    ).toBe(403);
    expect((await request(app).delete(`/api/v1/servers/${s.server_id}/tools/${toolId}`).set('Authorization', other.auth)).status).toBe(403);
    expect(await prisma.toolDefinition.count({ where: { server_id: s.server_id } })).toBe(1);
  });

  it('owner deletes a tool (204); a tool id from another server is 404', async () => {
    const a = await makeServer(owner, { tools: [{ name: 'a_tool', risk_level: 'read_only' }] });
    const b = await makeServer(owner, { tools: [{ name: 'b_tool', risk_level: 'read_only' }] });
    expect((await request(app).delete(`/api/v1/servers/${a.server_id}/tools/${b.tools[0].tool_id}`).set('Authorization', owner.auth)).status).toBe(404);
    expect((await request(app).delete(`/api/v1/servers/${a.server_id}/tools/${a.tools[0].tool_id}`).set('Authorization', owner.auth)).status).toBe(204);
    expect(await prisma.toolDefinition.count({ where: { server_id: a.server_id } })).toBe(0);
    expect(await prisma.toolDefinition.count({ where: { server_id: b.server_id } })).toBe(1);
  });
});
