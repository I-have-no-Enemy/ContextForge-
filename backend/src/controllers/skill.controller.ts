import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { SecurityScanner } from '../services/scanner.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ReviewItemType, ReviewStatus } from '@prisma/client';
import { requeueForReview } from '../services/review.service.js';

export class SkillController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const search = (req.query.search as string)?.trim();
      const client = (req.query.client as string)?.trim();
      const skip = (page - 1) * limit;

      const whereClause: any = {
        is_verified: true,
        is_deleted: false,
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (client) {
        whereClause.compatible_clients = {
          array_contains: client,
        };
      }

      const [total, rawSkills] = await Promise.all([
        prisma.aiSkill.count({ where: whereClause }),
        prisma.aiSkill.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { downloads_count: 'desc' },
          select: {
            skill_id: true,
            name: true,
            description: true,
            compatible_clients: true,
            tags: true,
            downloads_count: true,
            created_at: true,
            user: { select: { email: true } },
          },
        }),
      ]);

      const skills = rawSkills.map((s) => ({ ...s, id: s.skill_id }));
      const totalPages = Math.ceil(total / limit) || 1;

      sendSuccess(res, skills, 200, {
        page,
        limit,
        total,
        totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const skill = await prisma.aiSkill.findUnique({
        where: { skill_id: id },
        include: {
          user: { select: { email: true } },
        },
      });

      if (!skill || skill.is_deleted) {
        sendError(res, 404, 'AI Skill not found.', 'SKILL_NOT_FOUND');
        return;
      }

      // If unverified, only owner or admin can inspect
      if (!skill.is_verified) {
        const canView = req.user && ((req.user.user_id || req.user.id) === skill.submitted_by || req.user.role === 'admin');
        if (!canView) {
          sendError(res, 404, 'AI Skill not found.', 'SKILL_NOT_FOUND');
          return;
        }
      }

      sendSuccess(res, { ...skill, id: skill.skill_id });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 401, 'Authentication required.', 'UNAUTHORIZED');
        return;
      }

      const { name, description, skill_content, compatible_clients, tags } = req.body;
      const currentUserId = req.user.user_id || req.user.id!;

      const existing = await prisma.aiSkill.findUnique({
        where: { name: name.toLowerCase() },
      });

      if (existing) {
        sendError(res, 409, `An AI Skill with name '${name}' already exists.`, 'SKILL_NAME_EXISTS');
        return;
      }

      // 1. Run Automated In-Process Heuristic Security Scanner (LLM01 Defense)
      const scanResult = SecurityScanner.scanSkillContent(skill_content);

      // 2. Transactionally save skill with scan flags + auto-queue in review
      const result = await prisma.$transaction(async (tx) => {
        const skill = await tx.aiSkill.create({
          data: {
            name: name.toLowerCase(),
            description,
            skill_content,
            compatible_clients: compatible_clients || ['claude_desktop', 'cursor', 'cline', 'antigravity'],
            tags: tags || [],
            scan_flags: scanResult as any,
            is_verified: false,
            submitted_by: currentUserId,
          },
        });

        await tx.submissionReview.create({
          data: {
            item_type: ReviewItemType.skill,
            item_id: skill.skill_id,
            reviewer_id: currentUserId,
            status: ReviewStatus.pending,
            flagged_by_scan: scanResult.prompt_injection_detected,
            review_notes: scanResult.prompt_injection_detected
              ? `SECURITY SCAN ALERT: ${scanResult.flags.join('; ')}`
              : 'Automated heuristic scan passed cleanly with zero injection flags.',
          },
        });

        return skill;
      });

      sendSuccess(res, { ...result, id: result.skill_id }, 201);
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 401, 'Authentication required.', 'UNAUTHORIZED');
        return;
      }

      const { id } = req.params;
      const currentUserId = req.user.user_id || req.user.id;
      const skill = await prisma.aiSkill.findUnique({ where: { skill_id: id } });

      if (!skill || skill.is_deleted) {
        sendError(res, 404, 'AI Skill not found.', 'SKILL_NOT_FOUND');
        return;
      }

      // Broken Access Control check (IDOR Prevention)
      if (skill.submitted_by !== currentUserId && req.user.role !== 'admin') {
        sendError(res, 403, 'Forbidden: You do not have permission to modify this skill.', 'FORBIDDEN');
        return;
      }

      const updateData: any = { ...req.body };

      // Re-scan if skill_content changed (LLM01)
      const scanResult = updateData.skill_content
        ? SecurityScanner.scanSkillContent(updateData.skill_content)
        : null;
      if (scanResult) updateData.scan_flags = scanResult;

      // Any owner edit goes back to review so approved content cannot be swapped afterwards (OWASP A04).
      const isOwnerEdit = req.user.role !== 'admin';
      if (isOwnerEdit) updateData.is_verified = false;

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.aiSkill.update({
          where: { skill_id: id },
          data: updateData,
        });
        if (isOwnerEdit) {
          const flagged = scanResult?.prompt_injection_detected ?? false;
          await requeueForReview(
            tx,
            ReviewItemType.skill,
            id,
            currentUserId!,
            flagged,
            flagged
              ? `SECURITY SCAN ALERT after owner edit: ${scanResult!.flags.join('; ')}`
              : 'Owner edited this skill. Re-review required before it is listed again.'
          );
        }
        return row;
      });

      sendSuccess(res, { ...updated, id: updated.skill_id });
    } catch (error) {
      next(error);
    }
  }

  public static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 401, 'Authentication required.', 'UNAUTHORIZED');
        return;
      }

      const { id } = req.params;
      const currentUserId = req.user.user_id || req.user.id;
      const skill = await prisma.aiSkill.findUnique({ where: { skill_id: id } });

      if (!skill || skill.is_deleted) {
        sendError(res, 404, 'AI Skill not found.', 'SKILL_NOT_FOUND');
        return;
      }

      // Ownership check
      if (skill.submitted_by !== currentUserId && req.user.role !== 'admin') {
        sendError(res, 403, 'Forbidden: You do not have permission to delete this skill.', 'FORBIDDEN');
        return;
      }

      await prisma.aiSkill.update({
        where: { skill_id: id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
