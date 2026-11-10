import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Express 4 does not catch rejected promises from async handlers; on Node 22 an
 * unhandled rejection terminates the process. Route all async handlers through this.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
