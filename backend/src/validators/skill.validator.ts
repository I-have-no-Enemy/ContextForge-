import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export const createSkillSchema = z.object({
  name: z
    .string()
    .min(3, 'Skill name must be at least 3 characters')
    .max(100, 'Skill name too long')
    .regex(/^[a-z0-9-_]+$/, 'Skill name must only contain lowercase letters, numbers, hyphens, or underscores'),
  description: z.string().max(2000).optional(),
  skill_content: z.string().min(10, 'Skill content must be at least 10 characters of markdown'),
  compatible_clients: z
    .array(z.string())
    .optional()
    .default(['claude_desktop', 'cursor', 'cline', 'antigravity']),
  tags: z.array(z.string()).optional().default([]),
});

export const updateSkillSchema = createSkillSchema.partial();

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
