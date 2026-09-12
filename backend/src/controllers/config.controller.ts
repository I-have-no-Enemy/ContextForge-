import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { generateConfigSchema, configIdParamSchema } from '../validators/config.validator.js';
import { ConfigGenerator } from '../services/configGenerator.service.js';

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

    const { client_type, selected_server_ids, selected_skill_ids } = parseResult.data;

    // 1. Verify all selected servers exist, are verified, and are not deleted
    let servers: Array<{ id: string; server_id: string; name: string; install_command: string; required_env_vars: any }> = [];
    if (selected_server_ids.length > 0) {
      const rawServers = await prisma.mcpServer.findMany({
        where: {
          server_id: { in: selected_server_ids },
          is_verified: true,
          is_deleted: false,
        },
        select: {
          server_id: true,
          name: true,
          install_command: true,
          required_env_vars: true,
        },
      });

      servers = rawServers.map((s) => ({ ...s, id: s.server_id }));

      if (servers.length !== selected_server_ids.length) {
        sendError(
          res,
          400,
          'One or more selected MCP servers are invalid, unverified, or not found.',
          'INVALID_SELECTION'
        );
        return;
      }
    }

    // 2. Verify all selected skills exist, are verified, and are not deleted
    let skills: Array<{ id: string; skill_id: string; name: string; skill_content: string }> = [];
    if (selected_skill_ids.length > 0) {
      const rawSkills = await prisma.aiSkill.findMany({
        where: {
          skill_id: { in: selected_skill_ids },
          is_verified: true,
          is_deleted: false,
        },
        select: {
          skill_id: true,
          name: true,
          skill_content: true,
        },
      });

      skills = rawSkills.map((s) => ({ ...s, id: s.skill_id }));

      if (skills.length !== selected_skill_ids.length) {
        sendError(
          res,
          400,
          'One or more selected AI skills are invalid, unverified, or not found.',
          'INVALID_SELECTION'
        );
        return;
      }
    }

    // 3. Generate client config JSON via deep module
    const generatedJson = ConfigGenerator.generate(client_type, servers, skills);

    // 4. Save snapshot and increment download counters in an atomic transaction
    const newConfig = await prisma.$transaction(async (tx) => {
      const configRecord = await tx.clientConfig.create({
        data: {
          user_id: req.user?.user_id || req.user?.id || null,
          client_type,
          selected_server_ids,
          selected_skill_ids,
          generated_json: generatedJson,
        },
      });

      if (selected_server_ids.length > 0) {
        await tx.mcpServer.updateMany({
          where: { server_id: { in: selected_server_ids } },
          data: { downloads_count: { increment: 1 } },
        });
      }

      if (selected_skill_ids.length > 0) {
        await tx.aiSkill.updateMany({
          where: { skill_id: { in: selected_skill_ids } },
          data: { downloads_count: { increment: 1 } },
        });
      }

      return configRecord;
    });

    const configId = (newConfig as any).config_id || (newConfig as any).id;
    sendSuccess(res, { ...newConfig, config_id: configId, id: configId }, 201);
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
