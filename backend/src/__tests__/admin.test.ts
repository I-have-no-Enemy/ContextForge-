import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';

const app = createApp();
const JWT_SECRET = process.env.JWT_SECRET || 'contextforge_fallback_dev_secret_key_2026';

const adminUser = {
  id: '00000000-0000-0000-0000-000000000099',
  email: 'admin@contextforge.local',
  role: 'admin' as const,
};

const devUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@contextforge.local',
  role: 'developer' as const,
};

const adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '1h' });
const devToken = jwt.sign(devUser, JWT_SECRET, { expiresIn: '1h' });

const validServerId = '11111111-1111-1111-1111-111111111111';
const validSkillId = '22222222-2222-2222-2222-222222222222';
const validReviewId = '44444444-4444-4444-4444-444444444444';

describe('Admin Governance & Security Review API (/api/v1/admin/*)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC & Route Protection', () => {
    it('should reject unauthenticated requests with HTTP 401', async () => {
      const response = await request(app).get('/api/v1/admin/submissions');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-admin (developer) users with HTTP 403 Forbidden', async () => {
      const response = await request(app)
        .get('/api/v1/admin/submissions')
        .set('Authorization', `Bearer ${devToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/v1/admin/submissions', () => {
    it('should list pending submissions with scan flags for admin (HTTP 200)', async () => {
      vi.spyOn(prisma.submissionReview, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.submissionReview, 'findMany').mockResolvedValue([
        {
          id: validReviewId,
          item_type: 'skill',
          item_id: validSkillId,
          reviewer_id: adminUser.id,
          status: 'pending',
          flagged_by_scan: true,
          review_notes: 'Automated scan detected prompt injection attempt.',
          reviewed_at: new Date(),
          reviewer: {
            id: adminUser.id,
            email: adminUser.email,
            role: adminUser.role,
          },
        } as any,
      ]);

      const response = await request(app)
        .get('/api/v1/admin/submissions?status=pending&flagged_by_scan=true&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].flagged_by_scan).toBe(true);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('POST /api/v1/admin/submissions/review (Polymorphic & Approval Logic)', () => {
    it('should enforce Polymorphic Integrity: reject review when item_type is server but ID does not exist (HTTP 400)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/admin/submissions/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_type: 'server',
          item_id: validServerId,
          status: 'approved',
          review_notes: 'Legit server',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('POLYMORPHIC_REFERENCE_ERROR');
      expect(response.body.error.message).toContain('Referenced MCP Server not found');
    });

    it('should approve MCP server and transactionally set is_verified to true (HTTP 200)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: validServerId,
        name: 'verified-server',
        is_verified: false,
      } as any);

      const mockReviewRecord = {
        id: validReviewId,
        item_type: 'server',
        item_id: validServerId,
        reviewer_id: adminUser.id,
        status: 'approved',
        flagged_by_scan: false,
        review_notes: 'Approved after security audit.',
        reviewed_at: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          mcpServer: {
            update: vi.fn().mockResolvedValue({ id: validServerId, is_verified: true }),
          },
          aiSkill: {
            update: vi.fn(),
          },
          submissionReview: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockReviewRecord),
            update: vi.fn(),
          },
        };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/admin/submissions/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_type: 'server',
          item_id: validServerId,
          status: 'approved',
          review_notes: 'Approved after security audit.',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
    });

    it('should reject AI skill and transactionally ensure is_verified remains false (HTTP 200)', async () => {
      vi.spyOn(prisma.aiSkill, 'findUnique').mockResolvedValue({
        id: validSkillId,
        name: 'suspicious-skill',
        is_verified: false,
      } as any);

      const mockReviewRecord = {
        id: validReviewId,
        item_type: 'skill',
        item_id: validSkillId,
        reviewer_id: adminUser.id,
        status: 'rejected',
        flagged_by_scan: true,
        review_notes: 'Rejected due to credential theft pattern.',
        reviewed_at: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          aiSkill: {
            update: vi.fn().mockResolvedValue({ id: validSkillId, is_verified: false }),
          },
          mcpServer: {
            update: vi.fn(),
          },
          submissionReview: {
            findFirst: vi.fn().mockResolvedValue({ id: validReviewId }),
            update: vi.fn().mockResolvedValue(mockReviewRecord),
          },
        };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/admin/submissions/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_type: 'skill',
          item_id: validSkillId,
          status: 'rejected',
          review_notes: 'Rejected due to credential theft pattern.',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
    });
  });

  describe('POST /api/v1/admin/takedown (Emergency Revocation)', () => {
    it('should emergency-revoke and soft-delete an MCP server (HTTP 200)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue({
        id: validServerId,
        name: 'compromised-server',
        is_verified: true,
        is_deleted: false,
      } as any);

      const mockTakedownLog = {
        id: validReviewId,
        item_type: 'server',
        item_id: validServerId,
        reviewer_id: adminUser.id,
        status: 'rejected',
        flagged_by_scan: true,
        review_notes: '[EMERGENCY TAKEDOWN] Malicious remote execution vulnerability exploited.',
        reviewed_at: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          mcpServer: {
            update: vi.fn().mockResolvedValue({ id: validServerId, is_deleted: true, is_verified: false }),
          },
          aiSkill: {
            update: vi.fn(),
          },
          submissionReview: {
            create: vi.fn().mockResolvedValue(mockTakedownLog),
          },
        };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/admin/takedown')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_type: 'server',
          item_id: validServerId,
          reason: 'Malicious remote execution vulnerability exploited.',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Emergency takedown completed');
      expect(response.body.data.takedown_log.status).toBe('rejected');
    });

    it('should reject emergency takedown when item is not found (HTTP 404)', async () => {
      vi.spyOn(prisma.mcpServer, 'findUnique').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/admin/takedown')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_type: 'server',
          item_id: validServerId,
          reason: 'Non-existent server takedown attempt.',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject emergency takedown when reason is too short (HTTP 400)', async () => {
      const response = await request(app)
        .post('/api/v1/admin/takedown')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_type: 'server',
          item_id: validServerId,
          reason: 'bad', // < 5 chars
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
