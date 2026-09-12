import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export const createServerSchema = z.object({
  name: z
    .string()
    .min(3, 'Server name must be at least 3 characters')
    .max(100, 'Server name too long')
    .regex(/^[a-z0-9-_]+$/, 'Server name must only contain lowercase letters, numbers, hyphens, or underscores'),
  description: z.string().max(2000).optional(),
  repository_url: z.string().url('Must be a valid URL').optional(),
  install_command: z.string().min(3, 'Install command is required').max(255),
  required_env_vars: z.array(z.string().regex(/^[A-Z0-9_]+$/, 'Env var names must be uppercase alphanumeric with underscores')).optional().default([]),
});

export const updateServerSchema = createServerSchema.partial();

export const createToolSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  input_schema: z.record(z.any()).optional().default({}),
  risk_level: z.enum(['read_only', 'network', 'filesystem', 'destructive']).default('read_only'),
});

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      sendError(res, 400, 'Invalid request input parameters.', 'VALIDATION_ERROR', issues);
      return;
    }
    req.body = result.data;
    next();
  };
}
