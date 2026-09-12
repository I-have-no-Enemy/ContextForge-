import { Router } from 'express';
import { sendSuccess } from '../utils/response.js';

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

// Route mounts (Stubs will be connected as controllers are implemented)
// apiRouter.use('/auth', authRouter);
// apiRouter.use('/servers', serverRouter);
// apiRouter.use('/skills', skillRouter);
// apiRouter.use('/configs', configRouter);
// apiRouter.use('/admin', adminRouter);
