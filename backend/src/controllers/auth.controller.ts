import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET || 'contextforge_fallback_dev_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, role } = req.body;

      // 1. Check existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        sendError(res, 409, 'An account with this email address already exists.', 'EMAIL_ALREADY_EXISTS');
        return;
      }

      // 2. Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // 3. Create user record
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password_hash,
          role: role || 'developer',
        },
        select: {
          user_id: true,
          email: true,
          role: true,
          created_at: true,
        },
      });

      const userId = (user as any).user_id || (user as any).id;
      sendSuccess(res, { user: { ...user, user_id: userId, id: userId } }, 201);
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // 1. Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        sendError(res, 401, 'Invalid email or password credentials.', 'INVALID_CREDENTIALS');
        return;
      }

      // 2. Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        sendError(res, 401, 'Invalid email or password credentials.', 'INVALID_CREDENTIALS');
        return;
      }

      // 3. Generate JWT Token
      const userId = (user as any).user_id || (user as any).id;
      const token = jwt.sign(
        {
          user_id: userId,
          id: userId,
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: (JWT_EXPIRES_IN || '24h') as any }
      );

      // 4. Set HttpOnly Cookie (Dual-delivery)
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      sendSuccess(res, {
        token,
        user: {
          user_id: userId,
          id: userId,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 401, 'Authentication required.', 'UNAUTHORIZED');
        return;
      }

      const lookupId = req.user.user_id || req.user.id;
      const user = await prisma.user.findUnique({
        where: { user_id: lookupId },
        select: {
          user_id: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!user) {
        sendError(res, 404, 'User profile not found.', 'USER_NOT_FOUND');
        return;
      }

      const userId = (user as any).user_id || (user as any).id;
      sendSuccess(res, { user: { ...user, user_id: userId, id: userId } });
    } catch (error) {
      next(error);
    }
  }

  public static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    sendSuccess(res, { message: 'Logged out successfully.' });
  }
}
