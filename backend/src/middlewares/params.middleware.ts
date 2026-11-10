import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendError } from '../utils/response.js';

const uuid = z.string().uuid();

/**
 * Router param guard: rejects malformed ids with 400 before they reach Prisma,
 * which would otherwise throw and surface as a 500 (OWASP A03/A05).
 * Usage: router.param('id', uuidParam)
 */
export function uuidParam(_req: Request, res: Response, next: NextFunction, value: string, name: string): void {
  if (!uuid.safeParse(value).success) {
    sendError(res, 400, `Parameter '${name}' must be a valid UUID.`, 'INVALID_ID');
    return;
  }
  next();
}
