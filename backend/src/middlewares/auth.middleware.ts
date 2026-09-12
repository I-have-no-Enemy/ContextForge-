import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';

export interface AuthenticatedUser {
  user_id: string;
  id?: string; // ponytail: backward-compatible alias
  email: string;
  role: 'public' | 'developer' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'contextforge_fallback_dev_secret_key_2026';

export function extractToken(req: Request): string | null {
  // 1. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Fallback to HttpOnly Cookie: token=<token>
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      user_id: decoded.user_id || decoded.id,
      id: decoded.user_id || decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    // Ignore invalid token on optional auth routes
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    sendError(res, 401, 'Authentication required. Provide Bearer token or cookie.', 'UNAUTHORIZED');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      user_id: decoded.user_id || decoded.id,
      id: decoded.user_id || decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    sendError(res, 401, 'Invalid or expired session token.', 'INVALID_TOKEN');
    return;
  }

  next();
}

export function requireRole(allowedRoles: ('public' | 'developer' | 'admin')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'Authentication required.', 'UNAUTHORIZED');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        403,
        `Forbidden: Role '${req.user.role}' lacks permission for this resource.`,
        'FORBIDDEN'
      );
      return;
    }

    next();
  };
}
