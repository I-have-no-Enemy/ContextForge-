import { Router } from 'express';
import { sendSuccess } from '../utils/response.js';

import { authRouter } from './auth.routes.js';
import { serverRouter } from './server.routes.js';
import { skillRouter } from './skill.routes.js';
import { configRouter } from './config.routes.js';

export const apiRouter = Router();

// Healthcheck & System Telemetry Endpoint
apiRouter.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: '1.0.0',
  });
});

// Authentication & Identity Routes
apiRouter.use('/auth', authRouter);

// MCP Server & Tool Registry Routes
apiRouter.use('/servers', serverRouter);

// AI Skills & Playbook Routes
apiRouter.use('/skills', skillRouter);

// Multi-Client Configuration Generation Routes
apiRouter.use('/configs', configRouter);

// Admin Governance Routes (connected in Slice 5)
// apiRouter.use('/admin', adminRouter);

