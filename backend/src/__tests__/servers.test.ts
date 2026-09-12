import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';

const app = createApp();
const JWT_SECRET = process.env.JWT_SECRET || 'contextforge_fallback_dev_secret_key_2026';

const userA = {
  id: 'user-a-uuid',
  email: 'usera@example.com',
  role: 'developer' as const,
};

const userB = {
  id: 'user-b-uuid',
  email: 'userb@example.com',
  role: 'developer' as const,
};

const tokenA = jwt.sign(userA, JWT_SECRET, { expiresIn: '1h' });
const tokenB = jwt.sign(userB, JWT_SECRET, { expiresIn: '1h' });

describe('MCP Servers & Tools API Endpoints (/api/v1/servers/*)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/servers', () => {
    it('should return paginated list of verified MCP servers (HTTP 200)', async () => {
      vi.spyOn(prisma.mcpServer, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([
        {
          id: 'server-1',
          name: 'postgres-inspector',
          description: 'Inspect postgres databases',
          repository_url: 'https://github.com/mcp/postgres',
          install_command: 'npx -y postgres',
          required_env_vars: ['DATABASE_URL'],
          downloads_count: 500,
          github_stars: 1200,
          github_contributors: 14,
          created_at: new Date(),
          _count: { tools: 3 },
        } as any,
      ]);

      const response = await request(app).get('/api/v1/servers?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('GET /api/v1/servers/:id', () => {
    it('should return 200 for existing verified server', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: 'srv-1',
        name: 'test-server',
        is_verified: true,
        is_deleted: false,
        submitted_by: userA.id,
        tools: [],
        user: { email: userA.email },
      } as any);

      const response = await request(app).get('/api/v1/servers/srv-1');

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('test-server');
    });

    it('should return 404 for deleted or non-existent server', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: 'srv-deleted',
        is_deleted: true,
      } as any);

      const response = await request(app).get('/api/v1/servers/srv-deleted');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SERVER_NOT_FOUND');
    });
  });

  describe('POST /api/v1/servers', () => {
    it('should reject unauthenticated server creation (HTTP 401)', async () => {
      const response = await request(app)
        .post('/api/v1/servers')
        .send({
          name: 'my-server',
          install_command: 'npx -y my-server',
        });

      expect(response.status).toBe(401);
    });

    it('should create server with is_verified=false and auto-queue review (HTTP 201)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          mcpServer: {
            create: vi.fn().mockResolvedValue({
              id: 'new-srv',
              name: 'my-new-server',
              is_verified: false,
              submitted_by: userA.id,
            }),
          },
          submissionReview: {
            create: vi.fn().mockResolvedValue({ id: 'review-1' }),
          },
        });
      });

      const response = await request(app)
        .post('/api/v1/servers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'my-new-server',
          description: 'A newly submitted server',
          install_command: 'npx -y my-new-server',
          required_env_vars: ['API_KEY'],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('my-new-server');
      expect(response.body.data.is_verified).toBe(false);
    });
  });

  describe('PATCH /api/v1/servers/:id (OWASP A01: Broken Access Control / IDOR Prevention)', () => {
    it('should return 403 Forbidden when User B tries to update User A server', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: 'srv-user-a',
        submitted_by: userA.id,
        is_deleted: false,
      } as any);

      const response = await request(app)
        .patch('/api/v1/servers/srv-user-a')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ description: 'Hacked description' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow owner User A to update server metadata (HTTP 200)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: 'srv-user-a',
        submitted_by: userA.id,
        is_deleted: false,
      } as any);

      vi.spyOn(prisma.mcpServer, 'update').mockResolvedValue({
        id: 'srv-user-a',
        description: 'Updated description',
      } as any);

      const response = await request(app)
        .patch('/api/v1/servers/srv-user-a')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ description: 'Updated description' });

      expect(response.status).toBe(200);
      expect(response.body.data.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/v1/servers/:id (Soft Delete)', () => {
    it('should perform soft delete when owner requests deletion (HTTP 200)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: 'srv-user-a',
        submitted_by: userA.id,
        is_deleted: false,
      } as any);

      vi.spyOn(prisma.mcpServer, 'update').mockResolvedValue({
        id: 'srv-user-a',
        is_deleted: true,
      } as any);

      const response = await request(app)
        .delete('/api/v1/servers/srv-user-a')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Tools Endpoints (/api/v1/servers/:id/tools)', () => {
    it('should return tool definitions for server (HTTP 200)', async () => {
      vi.spyOn(prisma.toolDefinition, 'findMany').mockResolvedValue([
        {
          id: 'tool-1',
          server_id: 'srv-1',
          name: 'query_db',
          risk_level: 'read_only',
        } as any,
      ]);

      const response = await request(app).get('/api/v1/servers/srv-1/tools');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('query_db');
    });

    it('should allow owner to add a new tool (HTTP 201)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: 'srv-user-a',
        submitted_by: userA.id,
        is_deleted: false,
      } as any);

      vi.spyOn(prisma.toolDefinition, 'create').mockResolvedValue({
        id: 'tool-new',
        server_id: 'srv-user-a',
        name: 'write_table',
        risk_level: 'destructive',
      } as any);

      const response = await request(app)
        .post('/api/v1/servers/srv-user-a/tools')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'write_table',
          description: 'Insert data into table',
          risk_level: 'destructive',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('write_table');
      expect(response.body.data.risk_level).toBe('destructive');
    });
  });
});
