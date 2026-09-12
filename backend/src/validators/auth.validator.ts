import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password is too long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['public', 'developer']).optional().default('developer'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
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
