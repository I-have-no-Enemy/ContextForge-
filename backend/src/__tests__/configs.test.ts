import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';

const app = createApp();
const JWT_SECRET = process.env.JWT_SECRET || 'contextforge_fallback_dev_secret_key_2026';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@contextforge.local',
  role: 'developer' as const,
};

const userToken = jwt.sign(mockUser, JWT_SECRET, { expiresIn: '1h' });

const validServerId = '11111111-1111-1111-1111-111111111111';
const validSkillId = '22222222-2222-2222-2222-222222222222';
const validConfigId = '33333333-3333-3333-3333-333333333333';

describe('Config Generation & Snapshot Retrieval API (/api/v1/configs/*)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/configs/generate', () => {
    it('should generate Claude Desktop configuration anonymously (HTTP 201)', async () => {
      vi.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([
        {
          id: validServerId,
          name: 'postgres-inspector',
          install_command: 'npx -y @modelcontextprotocol/server-postgres postgresql://...',
          required_env_vars: ['DATABASE_URL'],
        } as any,
      ]);

      vi.spyOn(prisma.aiSkill, 'findMany').mockResolvedValue([
        {
          id: validSkillId,
          name: 'anti-slop-designer',
          skill_content: '# Anti Slop Design Guideline\nAvoid exaggerated marketing hype and AI slop.',
        } as any,
      ]);

      const mockCreatedConfig = {
        id: validConfigId,
        user_id: null,
        client_type: 'claude_desktop',
        selected_server_ids: [validServerId],
        selected_skill_ids: [validSkillId],
        generated_json: {
          mcpServers: {
            'postgres-inspector': {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://...'],
              env: { DATABASE_URL: 'YOUR_DATABASE_URL_HERE' },
            },
          },
          skills: [
            {
              name: 'anti-slop-designer',
              contentSummary: '# Anti Slop Design Guideline\nAvoid exaggerated marketing hype and AI slop.',
              content: '# Anti Slop Design Guideline\nAvoid exaggerated marketing hype and AI slop.',
            },
          ],
        },
        created_at: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          clientConfig: {
            create: vi.fn().mockResolvedValue(mockCreatedConfig),
          },
          mcpServer: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          aiSkill: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/configs/generate')
        .send({
          client_type: 'claude_desktop',
          selected_server_ids: [validServerId],
          selected_skill_ids: [validSkillId],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.id).toBe(validConfigId);
      expect(response.body.data.client_type).toBe('claude_desktop');
      expect(response.body.data.generated_json.mcpServers).toHaveProperty('postgres-inspector');
      expect(response.body.data.generated_json.skills).toHaveLength(1);
    });

    it('should generate Cursor configuration for authenticated user attaching user_id (HTTP 201)', async () => {
      vi.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([
        {
          id: validServerId,
          name: 'github-mcp',
          install_command: 'npx -y github-mcp',
          required_env_vars: ['GITHUB_TOKEN'],
        } as any,
      ]);

      const mockCreatedConfig = {
        id: validConfigId,
        user_id: mockUser.id,
        client_type: 'cursor',
        selected_server_ids: [validServerId],
        selected_skill_ids: [],
        generated_json: {
          mcpServers: {
            'github-mcp': {
              command: 'npx',
              args: ['-y', 'github-mcp'],
              env: { GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN_HERE' },
            },
          },
          skills: [],
        },
        created_at: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          clientConfig: {
            create: vi.fn().mockResolvedValue(mockCreatedConfig),
          },
          mcpServer: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          aiSkill: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/configs/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          client_type: 'cursor',
          selected_server_ids: [validServerId],
          selected_skill_ids: [],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(mockUser.id);
    });

    it('should reject generation when both server and skill selections are empty (HTTP 400)', async () => {
      const response = await request(app)
        .post('/api/v1/configs/generate')
        .send({
          client_type: 'claude_desktop',
          selected_server_ids: [],
          selected_skill_ids: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('At least one MCP server or AI skill must be selected');
    });

    it('should reject invalid client_type (HTTP 400)', async () => {
      const response = await request(app)
        .post('/api/v1/configs/generate')
        .send({
          client_type: 'unknown_ide',
          selected_server_ids: [validServerId],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject when a selected server is unverified or non-existent (HTTP 400)', async () => {
      // Return 0 servers when 1 was requested
      vi.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([]);

      const response = await request(app)
        .post('/api/v1/configs/generate')
        .send({
          client_type: 'antigravity',
          selected_server_ids: [validServerId],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SELECTION');
      expect(response.body.error.message).toContain('servers are invalid, unverified, or not found');
    });

    it('should reject when a selected skill is unverified or non-existent (HTTP 400)', async () => {
      // Server is valid, but skill is not found
      vi.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([
        {
          id: validServerId,
          name: 'test-server',
          install_command: 'npx test',
          required_env_vars: [],
        } as any,
      ]);
      vi.spyOn(prisma.aiSkill, 'findMany').mockResolvedValue([]);

      const response = await request(app)
        .post('/api/v1/configs/generate')
        .send({
          client_type: 'cline',
          selected_server_ids: [validServerId],
          selected_skill_ids: [validSkillId],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SELECTION');
      expect(response.body.error.message).toContain('skills are invalid, unverified, or not found');
    });
  });

  describe('GET /api/v1/configs/:id', () => {
    it('should retrieve existing configuration snapshot by UUID (HTTP 200)', async () => {
      vi.spyOn(prisma.clientConfig, 'findUnique').mockResolvedValue({
        id: validConfigId,
        user_id: null,
        client_type: 'cursor',
        selected_server_ids: [validServerId],
        selected_skill_ids: [],
        generated_json: { mcpServers: {} },
        created_at: new Date(),
      } as any);

      const response = await request(app).get(`/api/v1/configs/${validConfigId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(validConfigId);
    });

    it('should return HTTP 404 when configuration snapshot is not found', async () => {
      vi.spyOn(prisma.clientConfig, 'findUnique').mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/configs/${validConfigId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return HTTP 400 when config ID is not a valid UUID', async () => {
      const response = await request(app).get('/api/v1/configs/not-a-valid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMS');
    });
  });
});
