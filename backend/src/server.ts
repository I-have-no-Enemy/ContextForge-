import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { prisma } from './config/prisma.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`🚀 [ContextForge Server]: Running on http://localhost:${PORT}`);
  console.log(`📡 [API Route]: http://localhost:${PORT}/api/v1/health`);
});

// Graceful Shutdown
async function shutdown(signal: string) {
  console.log(`\n🛑 [ContextForge Shutdown]: Received ${signal}, closing gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ [ContextForge Shutdown]: Database disconnected. Process terminated.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
