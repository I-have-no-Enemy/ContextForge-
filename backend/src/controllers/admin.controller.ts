import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getRegistryMetrics } from '../services/metrics.service.js';
import { syncGithubMetrics } from '../services/githubSync.service.js';
import { ImportInputError, importFromGithub } from '../services/githubImport.service.js';
import {
  listSubmissionsQuerySchema,
  reviewSubmissionSchema,
  emergencyTakedownSchema,
  importGithubSchema,
  approveCleanSchema,
} from '../validators/admin.validator.js';

export class AdminController {
  /** GET /api/v1/admin/metrics - dashboard numbers. */
  public static async metrics(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await getRegistryMetrics());
  }

  /** POST /api/v1/admin/sync/github - refresh stars/contributors on demand (spec US5). */
  public static async syncGithub(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await syncGithubMetrics());
  }

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

  /**
   * POST /api/v1/admin/import/github
   * Reads skills or MCP servers from a public GitHub URL and queues them for review (never auto-approved).
   */
  public static async importGithub(req: Request, res: Response): Promise<void> {
    const parsed = importGithubSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message || 'Validation failed.', 'VALIDATION_ERROR', parsed.error.format());
      return;
    }
    try {
      const summary = await importFromGithub({
        url: parsed.data.url,
        kind: parsed.data.kind,
        limit: parsed.data.limit,
        minStars: parsed.data.min_stars,
        dryRun: parsed.data.dry_run,
        submittedBy: req.user!.user_id || req.user!.id!,
      });
      sendSuccess(res, summary, summary.created.length > 0 && !summary.dry_run ? 201 : 200);
    } catch (err) {
      if (err instanceof ImportInputError) {
        sendError(res, 400, err.message, 'INVALID_IMPORT_URL');
        return;
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/admin/submissions/approve-clean
   * One admin decision for every pending imported listing the scanner did not flag. Flagged items stay in the queue.
   */
  public static async approveClean(req: Request, res: Response): Promise<void> {
    const parsed = approveCleanSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message || 'Validation failed.', 'VALIDATION_ERROR', parsed.error.format());
      return;
    }
    const { item_type } = parsed.data;
    const adminId = req.user!.user_id || req.user!.id!;

    const BATCH = 500;
    const result = await prisma.$transaction(async (tx) => {
      // Start from the imported listings, so hand-submitted or flagged items never use up the batch.
      const waiting =
        item_type === 'server'
          ? (await tx.mcpServer.findMany({ where: { source_url: { not: null }, is_verified: false, is_deleted: false }, select: { server_id: true }, orderBy: { created_at: 'asc' }, take: BATCH + 1 })).map((i) => i.server_id)
          : (await tx.aiSkill.findMany({ where: { source_url: { not: null }, is_verified: false, is_deleted: false }, select: { skill_id: true }, orderBy: { created_at: 'asc' }, take: BATCH + 1 })).map((i) => i.skill_id);
      const capped = waiting.length > BATCH;
      const ids = waiting.slice(0, BATCH);

      const clean = await tx.submissionReview.findMany({
        where: { item_type, item_id: { in: ids }, status: 'pending', flagged_by_scan: false },
        select: { review_id: true, item_id: true },
      });
      const cleanIds = clean.map((r) => r.item_id);
      let approved = 0;
      if (cleanIds.length > 0) {
        // The `is_verified: false` guard makes a repeated or concurrent call approve each item at most once.
        const flipped =
          item_type === 'server'
            ? await tx.mcpServer.updateMany({ where: { server_id: { in: cleanIds }, is_verified: false }, data: { is_verified: true } })
            : await tx.aiSkill.updateMany({ where: { skill_id: { in: cleanIds }, is_verified: false }, data: { is_verified: true } });
        approved = flipped.count;
        await tx.submissionReview.updateMany({
          where: { review_id: { in: clean.map((r) => r.review_id) }, status: 'pending' },
          data: {
            status: 'approved',
            reviewer_id: adminId,
            reviewed_at: new Date(),
            review_notes: 'Bulk-approved by an admin: imported listing, scanner reported no flags.',
          },
        });
      }
      const left = await tx.submissionReview.count({ where: { item_type, item_id: { in: ids }, status: 'pending', flagged_by_scan: true } });
      return { approved, left_in_queue_flagged: left, capped };
    });

    sendSuccess(res, result);
  }
}
