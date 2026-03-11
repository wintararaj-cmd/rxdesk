import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import app from './app';
import { env } from './config/env';
import prisma from './config/database';
import redis from './config/redis';
import logger from './utils/logger';
import { registerSocketHandlers } from './modules/realtime/socket.handlers';

const server = http.createServer(app);

// ─── Socket.IO Setup ──────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      env.FRONTEND_URL,
      ...(env.FRONTEND_URL_LAN ? [env.FRONTEND_URL_LAN] : []),
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:19006',
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Attach io to app so route handlers can emit events
app.set('io', io);

// Register WebSocket event handlers
registerSocketHandlers(io);

// ─── Graceful Shutdown ────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received: closing server gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
    logger.info('Server shutdown complete');
    process.exit(0);
  });

  // Force close after 15 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// ─── Start Server ─────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    // Test DB connection
    await prisma.$connect();
    logger.info('Database: Connected');

    server.listen(env.PORT, () => {
      logger.info(`🚀 RxDesk API running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`   API  → http://localhost:${env.PORT}/api/v1`);
      logger.info(`   WS   → ws://localhost:${env.PORT}`);
      logger.info(`   Health → http://localhost:${env.PORT}/health`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
