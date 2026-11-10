import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { generateConfigSchema, configIdParamSchema } from '../validators/config.validator.js';
import { ConfigGenerator } from '../services/configGenerator.service.js';
import { parsePage, pageMeta } from '../utils/pagination.js';

/** Thrown inside the generation transaction to roll it back with the offending ids. */
class SelectionError extends Error {
  constructor(
    public kind: 'servers' | 'skills',
    public serverIds: string[],
    public skillIds: string[]
  ) {
    super('INVALID_SELECTION');
  }
}

export class ConfigController {
  /**
   * POST /api/v1/configs/generate
   * Generates a multi-client config JSON snapshot and increments download counters in a transaction.
   */
  public static async generateConfig(req: Request, res: Response): Promise<void> {
    const parseResult = generateConfigSchema.safeParse(req.body);
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

    const { client_type } = parseResult.data;
    const serverIds = [...new Set(parseResult.data.selected_server_ids)];
    const skillIds = [...new Set(parseResult.data.selected_skill_ids)];
    const live = { is_verified: true, is_deleted: false };

    // Read, verify, increment and snapshot inside ONE transaction. The conditional
    // updateMany re-checks verification at write time, so a takedown that commits
    // between our read and write aborts the whole generation (spec US2 scenario 2).
    let newConfig;
    try {
      newConfig = await prisma.$transaction(async (tx) => {
        const rawServers = serverIds.length
          ? await tx.mcpServer.findMany({
              where: { server_id: { in: serverIds }, ...live },
              select: { server_id: true, name: true, install_command: true, required_env_vars: true },
            })
          : [];
        const rawSkills = skillIds.length
          ? await tx.aiSkill.findMany({
              where: { skill_id: { in: skillIds }, ...live },
              select: { skill_id: true, name: true, skill_content: true },
            })
          : [];

        const foundServers = new Set(rawServers.map((s) => s.server_id));
        const foundSkills = new Set(rawSkills.map((s) => s.skill_id));
        const rejectedServers = serverIds.filter((id) => !foundServers.has(id));
        const rejectedSkills = skillIds.filter((id) => !foundSkills.has(id));
        if (rejectedServers.length) throw new SelectionError('servers', rejectedServers, []);
        if (rejectedSkills.length) throw new SelectionError('skills', [], rejectedSkills);

        if (serverIds.length) {
          const { count } = await tx.mcpServer.updateMany({
            where: { server_id: { in: serverIds }, ...live },
            data: { downloads_count: { increment: 1 } },
          });
          if (count !== serverIds.length) throw new SelectionError('servers', serverIds, []);
        }
        if (skillIds.length) {
          const { count } = await tx.aiSkill.updateMany({
            where: { skill_id: { in: skillIds }, ...live },
            data: { downloads_count: { increment: 1 } },
          });
          if (count !== skillIds.length) throw new SelectionError('skills', [], skillIds);
        }

        const generatedJson = ConfigGenerator.generate(
          client_type,
          rawServers.map((s) => ({ ...s, id: s.server_id })),
          rawSkills.map((s) => ({ ...s, id: s.skill_id }))
        );

        return tx.clientConfig.create({
          data: {
            user_id: req.user?.user_id || req.user?.id || null,
            client_type,
            selected_server_ids: serverIds,
            selected_skill_ids: skillIds,
            generated_json: generatedJson,
          },
        });
      });
    } catch (err) {
      if (err instanceof SelectionError) {
        sendError(
          res,
          400,
          `One or more selected ${err.kind === 'servers' ? 'MCP servers' : 'AI skills'} are invalid, unverified, or not found.`,
          'INVALID_SELECTION',
          { rejected_server_ids: err.serverIds, rejected_skill_ids: err.skillIds }
        );
        return;
      }
      throw err;
    }

    const configId = (newConfig as any).config_id || (newConfig as any).id;
    sendSuccess(res, { ...newConfig, config_id: configId, id: configId }, 201);
  }

  /** GET /api/v1/configs/me - caller's generated config history, newest first. */
  public static async listMine(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = parsePage(req.query);
    const where = { user_id: req.user!.user_id || req.user!.id! };
    const [total, rows] = await Promise.all([
      prisma.clientConfig.count({ where }),
      prisma.clientConfig.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);
    sendSuccess(res, rows.map((c) => ({ ...c, id: c.config_id })), 200, pageMeta(page, limit, total));
  }

  /**
   * GET /api/v1/configs/:id
   * Retrieves an immutable configuration snapshot by its UUID.
   */
  public static async getConfigById(req: Request, res: Response): Promise<void> {
    const paramResult = configIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      sendError(res, 400, 'Invalid configuration UUID.', 'INVALID_PARAMS');
      return;
    }

    const config = await prisma.clientConfig.findUnique({
      where: { config_id: paramResult.data.id },
    });

    if (!config) {
      sendError(res, 404, 'Configuration snapshot not found.', 'NOT_FOUND');
      return;
    }

    const configId = (config as any).config_id || (config as any).id;
    sendSuccess(res, { ...config, config_id: configId, id: configId });
  }
}
