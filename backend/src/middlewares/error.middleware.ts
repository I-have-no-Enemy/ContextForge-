import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { sendError } from '../utils/response.js';

interface Mapped {
  status: number;
  code: string;
  message: string;
}

/** Turns known infrastructure errors into stable API errors; null means "unexpected". */
function mapKnown(err: any): Mapped | null {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, code: 'DB_UNAVAILABLE', message: 'The database is unavailable. Try again shortly.' };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return { status: 409, code: 'CONFLICT', message: 'A record with the same unique value already exists.' };
    if (err.code === 'P2025') return { status: 404, code: 'NOT_FOUND', message: 'The record no longer exists.' };
    if (err.code === 'P1001' || err.code === 'P1002')
      return { status: 503, code: 'DB_UNAVAILABLE', message: 'The database is unavailable. Try again shortly.' };
  }
  const status = err?.status || err?.statusCode;
  if (status && status >= 400 && status < 500) {
    // body-parser errors carry type 'entity.parse.failed' and a safe message.
    return { status, code: typeof err.code === 'string' ? err.code : 'REQUEST_ERROR', message: err.message || 'Bad request.' };
  }
  return null;
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const known = mapKnown(err);

  // Full detail stays in the server log; clients get a stable code and a safe message (OWASP A05).
  console.error(`[ContextForge Error] ${req.method} ${req.originalUrl}:`, err);

  if (known) {
    sendError(res, known.status, known.message, known.code);
    return;
  }
  sendError(res, 500, 'An unexpected internal server error occurred.', 'INTERNAL_SERVER_ERROR');
}
