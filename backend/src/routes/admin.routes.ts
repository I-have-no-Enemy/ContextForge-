import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRouter = Router();

// Enforce Admin-only authentication on all governance routes
adminRouter.use(requireAuth, requireRole(['admin']));

// GET /api/v1/admin/metrics (Dashboard numbers)
adminRouter.get('/metrics', asyncHandler(AdminController.metrics));

// GET /api/v1/admin/submissions (List pending/reviewed queues)
adminRouter.get('/submissions', asyncHandler(AdminController.listSubmissions));

// POST /api/v1/admin/submissions/review (Approve/Reject with polymorphic validation)
adminRouter.post('/submissions/review', asyncHandler(AdminController.reviewSubmission));

// POST /api/v1/admin/takedown (Emergency revocation and soft deletion)
adminRouter.post('/takedown', asyncHandler(AdminController.emergencyTakedown));

// POST /api/v1/admin/sync/github (Refresh GitHub stars/contributors, spec US5)
adminRouter.post('/sync/github', asyncHandler(AdminController.syncGithub));
