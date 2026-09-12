import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

export const configRouter = Router();

// POST /api/v1/configs/generate (Optional auth - attach user_id if logged in)
configRouter.post('/generate', optionalAuth, ConfigController.generateConfig);

// GET /api/v1/configs/:id (Public retrieval of immutable config snapshot)
configRouter.get('/:id', ConfigController.getConfigById);
