import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { sendError } from './utils/response.js';

export function createApp(): Express {
  const app = express();

  // 1. Security & Hygiene Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // 2. API Routes
  app.use('/api/v1', apiRouter);

  // 3. Fallback 404 Handler
  app.use((req, res) => {
    sendError(res, 404, `Endpoint ${req.method} ${req.originalUrl} not found.`, 'NOT_FOUND');
  });

  // 4. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
