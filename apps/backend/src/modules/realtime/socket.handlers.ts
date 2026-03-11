import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JwtPayload } from '@rxdesk/shared';
import logger from '../../utils/logger';

export function registerSocketHandlers(io: Server): void {
  // JWT Authentication for WebSocket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
      (socket as Socket & { user: { id: string; role: string } }).user = {
        id: payload.sub,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as Socket & { user: { id: string; role: string } }).user;
    logger.debug(`WS connected: ${user.id} (${user.role})`);

    // Shop panel joins its room to receive queue updates
    socket.on('join_shop', ({ shop_id }: { shop_id: string }) => {
      socket.join(`shop:${shop_id}`);
      logger.debug(`WS: user ${user.id} joined shop:${shop_id}`);
    });

    socket.on('join_chamber', ({ chamber_id }: { chamber_id: string }) => {
      socket.join(`chamber:${chamber_id}`);
    });

    socket.on('leave_shop', ({ shop_id }: { shop_id: string }) => {
      socket.leave(`shop:${shop_id}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`WS disconnected: ${user.id} — ${reason}`);
    });
  });
}

// ─── Emit Helpers (called from route handlers) ─────────

export function emitToShop(
  io: Server,
  shopId: string,
  event: string,
  data: unknown
): void {
  io.to(`shop:${shopId}`).emit(event, data);
}

export function emitToChamber(
  io: Server,
  chamberId: string,
  event: string,
  data: unknown
): void {
  io.to(`chamber:${chamberId}`).emit(event, data);
}
