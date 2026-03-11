import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis';

// Use Redis store only when the real ioredis client has the .call() method
// (ioredis-mock used in dev doesn't implement it → falls back to in-memory)
const hasRedisCall = typeof (redis as any).call === 'function';

// Generic rate limiter factory
function createLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(hasRedisCall && {
      store: new RedisStore({
        sendCommand: (...args: string[]) => (redis as any).call(args[0], ...args.slice(1)),
      }),
    }),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
        },
      });
    },
  });
}

// OTP: 3 requests per phone per 10 minutes (enforced in service logic via Redis)
export const otpRateLimiter = createLimiter(
  10 * 60 * 1000,
  10,
  'Too many OTP requests. Please wait 10 minutes before trying again.'
);

// General API: 200 requests per minute per authenticated user
export const apiRateLimiter = createLimiter(
  60 * 1000,
  200,
  'Too many requests. Please slow down.'
);

// Search endpoints: 60 per minute per IP
export const searchRateLimiter = createLimiter(
  60 * 1000,
  60,
  'Too many search requests. Please wait a moment.'
);

// PDF generation: 10 per minute per user
export const pdfRateLimiter = createLimiter(
  60 * 1000,
  10,
  'Too many PDF requests. Please wait before generating another.'
);
