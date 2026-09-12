import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ReviewItemType, ReviewStatus } from '@prisma/client';

export class ServerController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const search = (req.query.search as string)?.trim();
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

      const [total, rawServers] = await Promise.all([
        prisma.mcpServer.count({ where: whereClause }),
        prisma.mcpServer.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { downloads_count: 'desc' },
          select: {
            server_id: true,
            name: true,
            description: true,
            repository_url: true,
            install_command: true,
            required_env_vars: true,
            downloads_count: true,
            github_stars: true,
            github_contributors: true,
            created_at: true,
            _count: { select: { tools: true } },
          },
        }),
      ]);

      const servers = rawServers.map((s) => ({ ...s, id: s.server_id }));
      const totalPages = Math.ceil(total / limit) || 1;

      sendSuccess(res, servers, 200, {
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

      const server = await prisma.mcpServer.findUnique({
        where: { server_id: id },
        include: {
          tools: true,
          user: { select: { email: true } },
        },
      });

      if (!server || server.is_deleted) {
        sendError(res, 404, 'MCP Server not found.', 'SERVER_NOT_FOUND');
        return;
      }

      // If unverified, only owner or admin can view
      if (!server.is_verified) {
        const canView = req.user && ((req.user.user_id || req.user.id) === server.submitted_by || req.user.role === 'admin');
        if (!canView) {
          sendError(res, 404, 'MCP Server not found.', 'SERVER_NOT_FOUND');
          return;
        }
      }

      sendSuccess(res, { ...server, id: server.server_id });
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

      const { name, description, repository_url, install_command, required_env_vars } = req.body;
      const currentUserId = req.user.user_id || req.user.id!;

      const existing = await prisma.mcpServer.findUnique({
        where: { name: name.toLowerCase() },
      });

      if (existing) {
        sendError(res, 409, `A server with name '${name}' already exists.`, 'SERVER_NAME_EXISTS');
        return;
      }

      // Create server + auto-queue in submission_reviews transactionally
      const result = await prisma.$transaction(async (tx) => {
        const server = await tx.mcpServer.create({
          data: {
            name: name.toLowerCase(),
            description,
            repository_url,
            install_command,
            required_env_vars: required_env_vars || [],
            is_verified: false,
            submitted_by: currentUserId,
          },
        });

        await tx.submissionReview.create({
          data: {
            item_type: ReviewItemType.server,
            item_id: server.server_id,
            reviewer_id: currentUserId,
            status: ReviewStatus.pending,
            review_notes: 'Community MCP server submitted. Pending administrator review.',
          },
        });

        return server;
      });

      sendSuccess(res, { ...result, id: result.server_id }, 201);
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
      const server = await prisma.mcpServer.findUnique({ where: { server_id: id } });

      if (!server || server.is_deleted) {
        sendError(res, 404, 'MCP Server not found.', 'SERVER_NOT_FOUND');
        return;
      }

      // Broken Access Control check (IDOR Prevention)
      if (server.submitted_by !== currentUserId && req.user.role !== 'admin') {
        sendError(res, 403, 'Forbidden: You do not have permission to modify this server.', 'FORBIDDEN');
        return;
      }

      const updated = await prisma.mcpServer.update({
        where: { server_id: id },
        data: req.body,
      });

      sendSuccess(res, { ...updated, id: updated.server_id });
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
      const server = await prisma.mcpServer.findUnique({ where: { server_id: id } });

      if (!server || server.is_deleted) {
        sendError(res, 404, 'MCP Server not found.', 'SERVER_NOT_FOUND');
        return;
      }

      // Ownership check
      if (server.submitted_by !== currentUserId && req.user.role !== 'admin') {
        sendError(res, 403, 'Forbidden: You do not have permission to delete this server.', 'FORBIDDEN');
        return;
      }

      await prisma.mcpServer.update({
        where: { server_id: id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      sendSuccess(res, { message: 'Server deleted successfully (soft delete).' });
    } catch (error) {
      next(error);
    }
  }

  public static async listTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const tools = await prisma.toolDefinition.findMany({
        where: { server_id: id },
        orderBy: { name: 'asc' },
      });

      const formatted = tools.map((t) => ({ ...t, id: t.tool_id }));
      sendSuccess(res, formatted);
    } catch (error) {
      next(error);
    }
  }

  public static async addTool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 401, 'Authentication required.', 'UNAUTHORIZED');
        return;
      }

      const { id } = req.params;
      const currentUserId = req.user.user_id || req.user.id;
      const server = await prisma.mcpServer.findUnique({ where: { server_id: id } });

      if (!server || server.is_deleted) {
        sendError(res, 404, 'Parent MCP Server not found.', 'SERVER_NOT_FOUND');
        return;
      }

      if (server.submitted_by !== currentUserId && req.user.role !== 'admin') {
        sendError(res, 403, 'Forbidden: You can only add tools to servers you own.', 'FORBIDDEN');
        return;
      }

      const { name, description, input_schema, risk_level } = req.body;

      const tool = await prisma.toolDefinition.create({
        data: {
          server_id: id,
          name,
          description,
          input_schema: input_schema || {},
          risk_level: risk_level || 'read_only',
        },
      });

      sendSuccess(res, { ...tool, id: tool.tool_id }, 201);
    } catch (error) {
      next(error);
    }
  }
}
