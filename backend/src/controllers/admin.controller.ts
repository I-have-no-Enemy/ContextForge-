import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import {
  listSubmissionsQuerySchema,
  reviewSubmissionSchema,
  emergencyTakedownSchema,
} from '../validators/admin.validator.js';

export class AdminController {
  /**
   * GET /api/v1/admin/submissions
   * Lists pending/reviewed submission queues with filters.
   */
  public static async listSubmissions(req: Request, res: Response): Promise<void> {
    const parseResult = listSubmissionsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      sendError(res, 400, 'Invalid query parameters.', 'INVALID_PARAMS', parseResult.error.format());
      return;
    }

    const { page, limit, status, flagged_by_scan, item_type } = parseResult.data;

    const where: any = {};
    if (status) where.status = status;
    if (typeof flagged_by_scan === 'boolean') where.flagged_by_scan = flagged_by_scan;
    if (item_type) where.item_type = item_type;

    const [total, rawSubmissions] = await Promise.all([
      prisma.submissionReview.count({ where }),
      prisma.submissionReview.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { reviewed_at: 'desc' },
        include: {
          reviewer: {
            select: {
              user_id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const formattedSubmissions = rawSubmissions.map((s) => ({
      ...s,
      id: s.review_id,
      reviewer: s.reviewer ? { ...s.reviewer, id: s.reviewer.user_id } : s.reviewer,
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, formattedSubmissions, 200, {
      page,
      limit,
      total,
      totalPages,
    });
  }

  /**
   * POST /api/v1/admin/submissions/review
   * Approves or rejects a submitted server or skill, enforcing polymorphic referential integrity.
   */
  public static async reviewSubmission(req: Request, res: Response): Promise<void> {
    const parseResult = reviewSubmissionSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(
        res,
        400,
        parseResult.error.issues[0]?.message || 'Validation failed.',
        'VALIDATION_ERROR',
        parseResult.error.format()
      );
      return;
    }

    const { item_type, item_id, status, review_notes } = parseResult.data;
    const currentUserId = req.user!.user_id || req.user!.id!;

    // 1. Enforce Polymorphic Integrity: Verify item exists in the specified table
    if (item_type === 'server') {
      const server = await prisma.mcpServer.findUnique({
        where: { server_id: item_id },
      });
      if (!server) {
        sendError(
          res,
          400,
          'Referenced MCP Server not found for polymorphic review.',
          'POLYMORPHIC_REFERENCE_ERROR'
        );
        return;
      }
    } else if (item_type === 'skill') {
      const skill = await prisma.aiSkill.findUnique({
        where: { skill_id: item_id },
      });
      if (!skill) {
        sendError(
          res,
          400,
          'Referenced AI Skill not found for polymorphic review.',
          'POLYMORPHIC_REFERENCE_ERROR'
        );
        return;
      }
    }

    // 2. Transactionally update/create review record and flip is_verified flag
    const reviewResult = await prisma.$transaction(async (tx) => {
      const isVerified = status === 'approved';

      if (item_type === 'server') {
        await tx.mcpServer.update({
          where: { server_id: item_id },
          data: { is_verified: isVerified },
        });
      } else {
        await tx.aiSkill.update({
          where: { skill_id: item_id },
          data: { is_verified: isVerified },
        });
      }

      // Check for an existing pending review or create new
      const existingPending = await tx.submissionReview.findFirst({
        where: { item_type, item_id, status: 'pending' },
      });

      let updatedReview;
      if (existingPending) {
        updatedReview = await tx.submissionReview.update({
          where: { review_id: existingPending.review_id },
          data: {
            reviewer_id: currentUserId,
            status,
            review_notes: review_notes || null,
            reviewed_at: new Date(),
          },
        });
      } else {
        updatedReview = await tx.submissionReview.create({
          data: {
            item_type,
            item_id,
            reviewer_id: currentUserId,
            status,
            flagged_by_scan: false,
            review_notes: review_notes || null,
            reviewed_at: new Date(),
          },
        });
      }

      return updatedReview;
    });

    sendSuccess(res, { ...reviewResult, id: reviewResult.review_id }, 200);
  }

  /**
   * POST /api/v1/admin/takedown
   * Emergency revocation and soft-deletion of compromised or malicious tools/skills.
   */
  public static async emergencyTakedown(req: Request, res: Response): Promise<void> {
    const parseResult = emergencyTakedownSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(
        res,
        400,
        parseResult.error.issues[0]?.message || 'Validation failed.',
        'VALIDATION_ERROR',
        parseResult.error.format()
      );
      return;
    }

    const { item_type, item_id, reason } = parseResult.data;
    const currentUserId = req.user!.user_id || req.user!.id!;

    // Verify item exists
    if (item_type === 'server') {
      const server = await prisma.mcpServer.findUnique({
        where: { server_id: item_id },
      });
      if (!server) {
        sendError(res, 404, 'MCP Server not found.', 'NOT_FOUND');
        return;
      }
    } else {
      const skill = await prisma.aiSkill.findUnique({
        where: { skill_id: item_id },
      });
      if (!skill) {
        sendError(res, 404, 'AI Skill not found.', 'NOT_FOUND');
        return;
      }
    }

    // Transactionally soft-delete and record audit entry
    const takedownLog = await prisma.$transaction(async (tx) => {
      const now = new Date();

      if (item_type === 'server') {
        await tx.mcpServer.update({
          where: { server_id: item_id },
          data: {
            is_verified: false,
            is_deleted: true,
            deleted_at: now,
          },
        });
      } else {
        await tx.aiSkill.update({
          where: { skill_id: item_id },
          data: {
            is_verified: false,
            is_deleted: true,
            deleted_at: now,
          },
        });
      }

      return tx.submissionReview.create({
        data: {
          item_type,
          item_id,
          reviewer_id: currentUserId,
          status: 'rejected',
          flagged_by_scan: true,
          review_notes: `[EMERGENCY TAKEDOWN] ${reason}`,
          reviewed_at: now,
        },
      });
    });

    sendSuccess(res, {
      message: `Emergency takedown completed for ${item_type} ${item_id}.`,
      takedown_log: { ...takedownLog, id: takedownLog.review_id },
    });
  }
}
