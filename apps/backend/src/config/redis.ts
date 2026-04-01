import Redis from 'ioredis';
import { env } from './env';
import logger from '../utils/logger';

// In development, fall back to in-memory mock when real Redis is unavailable
const useMock = env.NODE_ENV === 'development' && process.env.USE_REDIS_MOCK === 'true';

let redis: Redis;

if (useMock) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RedisMock = require('ioredis-mock');
  redis = new RedisMock() as Redis;
  logger.warn('Redis: Using in-memory mock (USE_REDIS_MOCK=true) — OTPs will not persist across restarts');
} else {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) {
        logger.error('Redis: Too many retries, giving up');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });
  redis.on('connect', () => logger.info('Redis: Connected'));
  redis.on('error', (err) => logger.error('Redis error:', err));
}

export default redis;

// ─── Redis Key Helpers ────────────────────────

export const RedisKeys = {
  otp: (phone: string) => `otp:${phone}`,
  otpRef: (ref: string) => `otp_ref:${ref}`,
  refreshToken: (userId: string, tokenId: string) => `refresh:${userId}:${tokenId}`,
  rateLimitOtp: (phone: string) => `rl:otp:${phone}`,
  shopQueue: (shopId: string) => `queue:shop:${shopId}`,
  inventorySearch: (shopId: string, q: string) => `inventory:search:${shopId}:${q}`,
  medicineSearch: (q: string) => `medicine:search:${q}`,
  medicineCompSearch: (q: string) => `medicine:comp:${q}`,
  customerSearch: (shopId: string, q: string) => `customer:search:${shopId}:${q}`,
} as const;

/**
 * Deletes all keys matching a pattern using SCAN stream for safety on large datasets.
 */
export async function clearCacheByPattern(pattern: string): Promise<number> {
  const stream = redis.scanStream({
    match: pattern,
  });

  let deletedCount = 0;
  for await (const keys of stream) {
    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      keys.forEach((key: string) => pipeline.del(key));
      await pipeline.exec();
      deletedCount += keys.length;
    }
  }

  return deletedCount;
}

export const clearInventorySearchCache = (shopId: string) => 
  clearCacheByPattern(`inventory:search:${shopId}:*`);

export const clearCustomerSearchCache = (shopId: string) =>
  clearCacheByPattern(`customer:search:${shopId}:*`);
