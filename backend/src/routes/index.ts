import { Router } from 'express';
import { sendSuccess } from '../utils/response.js';

import { authRouter } from './auth.routes.js';
import { serverRouter } from './server.routes.js';

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

// Route mounts (Stubs will be connected as controllers are implemented)
// apiRouter.use('/skills', skillRouter);
// apiRouter.use('/configs', configRouter);
// apiRouter.use('/admin', adminRouter);
