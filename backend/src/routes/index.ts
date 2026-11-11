import { Router } from 'express';
import { sendSuccess } from '../utils/response.js';
import { prisma } from '../config/prisma.js';

import { authRouter } from './auth.routes.js';
import { serverRouter } from './server.routes.js';
import { skillRouter } from './skill.routes.js';
import { configRouter } from './config.routes.js';
import { adminRouter } from './admin.routes.js';

export const apiRouter = Router();

// Healthcheck: reports the real database state, 503 when it cannot answer.
apiRouter.get('/health', async (_req, res) => {
  const started = Date.now();
  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  sendSuccess(
    res,
    {
      status: database === 'up' ? 'healthy' : 'degraded',
      database,
      dbLatencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: '1.0.0',
    },
    database === 'up' ? 200 : 503
  );
});

// Authentication & Identity Routes
apiRouter.use('/auth', authRouter);

// MCP Server & Tool Registry Routes
apiRouter.use('/servers', serverRouter);

// AI Skills & Playbook Routes
apiRouter.use('/skills', skillRouter);

// Multi-Client Configuration Generation Routes
apiRouter.use('/configs', configRouter);

// Admin Governance Routes
apiRouter.use('/admin', adminRouter);


