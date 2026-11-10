import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const configRouter = Router();

// POST /api/v1/configs/generate (Optional auth - attach user_id if logged in)
configRouter.post('/generate', optionalAuth, asyncHandler(ConfigController.generateConfig));

// GET /api/v1/configs/me (Caller's config history; registered before /:id)
configRouter.get('/me', requireAuth, asyncHandler(ConfigController.listMine));

// GET /api/v1/configs/:id (Public retrieval of immutable config snapshot)
configRouter.get('/:id', asyncHandler(ConfigController.getConfigById));
