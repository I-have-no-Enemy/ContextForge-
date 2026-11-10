import { Router } from 'express';
import { ServerController } from '../controllers/server.controller.js';
import {
  createServerSchema,
  updateServerSchema,
  createToolSchema,
  validateBody,
} from '../validators/server.validator.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { uuidParam } from '../middlewares/params.middleware.js';

export const serverRouter = Router();
serverRouter.param('id', uuidParam);
serverRouter.param('toolId', uuidParam);

// Public Discovery
serverRouter.get('/', ServerController.list);
serverRouter.get('/:id', optionalAuth, ServerController.getById);
serverRouter.get('/:id/tools', optionalAuth, ServerController.listTools);

// Authenticated Operations
serverRouter.post('/', requireAuth, validateBody(createServerSchema), ServerController.create);
serverRouter.patch('/:id', requireAuth, validateBody(updateServerSchema), ServerController.update);
serverRouter.delete('/:id', requireAuth, ServerController.softDelete);
serverRouter.post('/:id/tools', requireAuth, validateBody(createToolSchema), ServerController.addTool);
