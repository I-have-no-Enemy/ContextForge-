import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

export const adminRouter = Router();

// Enforce Admin-only authentication on all governance routes
adminRouter.use(requireAuth, requireRole(['admin']));

// GET /api/v1/admin/submissions (List pending/reviewed queues)
adminRouter.get('/submissions', AdminController.listSubmissions);

// POST /api/v1/admin/submissions/review (Approve/Reject with polymorphic validation)
adminRouter.post('/submissions/review', AdminController.reviewSubmission);

// POST /api/v1/admin/takedown (Emergency revocation and soft deletion)
adminRouter.post('/takedown', AdminController.emergencyTakedown);
