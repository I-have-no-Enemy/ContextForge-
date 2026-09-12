import { Router } from 'express';
import { SkillController } from '../controllers/skill.controller.js';
import { createSkillSchema, updateSkillSchema, validateBody } from '../validators/skill.validator.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';

export const skillRouter = Router();

// Public Discovery
skillRouter.get('/', SkillController.list);
skillRouter.get('/:id', optionalAuth, SkillController.getById);

// Authenticated Operations
skillRouter.post('/', requireAuth, validateBody(createSkillSchema), SkillController.create);
skillRouter.patch('/:id', requireAuth, validateBody(updateSkillSchema), SkillController.update);
skillRouter.delete('/:id', requireAuth, SkillController.softDelete);
