import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import prisma from '../../config/database';
import redis, { RedisKeys } from '../../config/redis';
import { env, isDev } from '../../config/env';
import { sendOtpSms } from '../../utils/smsService';
import logger from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { UserRole, JwtPayload } from '@rxdesk/shared';

// ─── OTP Generation ──────────────────────────

function generateOtp(length = env.OTP_LENGTH): string {
  if (env.DEV_FIXED_OTP) return env.DEV_FIXED_OTP; // override — remove in production
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

// ─── Token Generation ─────────────────────────

function generateAccessToken(userId: string, role: UserRole): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign({ sub: userId, role } as Omit<JwtPayload, 'iat' | 'exp'>, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

// ─── Service Functions ───────────────────────

// ─── Session Limit Enforcement ──────────────────────────────────────────────
// Only applies to shop_owner users. Counts active Redis refresh tokens and
// rejects the login if the subscription's max_sessions limit is reached.
async function enforceSessionLimit(userId: string, role: UserRole): Promise<void> {
  if (role !== 'shop_owner') return;

  const shop = await prisma.medicalShop.findUnique({
    where: { owner_user_id: userId },
    select: {
      subscriptions: {
        where: { status: { in: ['trial', 'active'] } },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { plan: { select: { max_sessions: true, name: true } } },
      },
    },
  });

  // No shop yet (mid-registration), skip check
  if (!shop) return;

  const activePlan = shop.subscriptions[0]?.plan;
  const maxSessions = activePlan?.max_sessions ?? 2;
  const planName = activePlan?.name ?? 'Basic';

  const sessionKeys = await redis.keys(`refresh:${userId}:*`);
  if (sessionKeys.length >= maxSessions) {
    throw new AppError(
      403,
      'SESSION_LIMIT_EXCEEDED',
      `Your ${planName} plan allows ${maxSessions} active session${maxSessions !== 1 ? 's' : ''}. Please sign out from another device first, or upgrade your plan.`,
    );
  }
}

// ─── Service Functions ───────────────────────

export async function sendOtp(phone: string): Promise<{ otp_ref: string; expires_in: number }> {
  // Rate limit: max 3 OTPs per 10 minutes (skipped in development)
  if (!isDev) {
    const rlKey = RedisKeys.rateLimitOtp(phone);
    const attempts = await redis.incr(rlKey);
    if (attempts === 1) await redis.expire(rlKey, 10 * 60);
    if (attempts > 3) {
      throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many OTP requests. Try again in 10 minutes.');
    }
  }

  const otp = generateOtp();
  const otpRef = uuidv4();
  const expirySeconds = env.OTP_EXPIRY_SECONDS;

  // Store: otp_ref → { phone, otp }
  await redis.setex(RedisKeys.otpRef(otpRef), expirySeconds, JSON.stringify({ phone, otp }));

  const smsResult = await sendOtpSms(phone, otp);
  if (!smsResult.success) {
    logger.warn(`OTP SMS failed for ${phone}: ${smsResult.error}`);
    // Still return ref in dev mode; in prod this would be handled differently
  }

  logger.info(`OTP sent to ${phone} (ref: ${otpRef})`);
  return { otp_ref: otpRef, expires_in: expirySeconds };
}

export async function verifyOtpAndLogin(
  phone: string,
  otp: string,
  otpRef: string
): Promise<{
  access_token: string;
  refresh_token: string;
  user: { id: string; phone: string; role: UserRole; is_profile_complete: boolean; requires_password_setup: boolean };
}> {
  // Validate OTP
  const stored = await redis.get(RedisKeys.otpRef(otpRef));
  if (!stored) {
    throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.');
  }

  const { phone: storedPhone, otp: storedOtp } = JSON.parse(stored) as {
    phone: string;
    otp: string;
  };

  if (storedPhone !== phone || storedOtp !== otp) {
    throw new AppError(400, 'OTP_INVALID', 'Invalid OTP entered.');
  }

  // Delete used OTP
  await redis.del(RedisKeys.otpRef(otpRef));

  // Find or create user
  let user = await prisma.user.findUnique({ where: { phone } });
  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({
      data: { phone, role: 'patient' }, // default role; user picks during profile setup
    });
  }

  // Determine if profile is complete
  const isProfileComplete = await checkProfileComplete(user.id, user.role);

  // First-time users (no password set) must set a password after OTP
  const requiresPasswordSetup = !user.password;

  // Enforce concurrent session limit for shop_owner role
  await enforceSessionLimit(user.id, user.role);

  // Generate tokens
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  const tokenId = uuidv4();

  // Store refresh token in Redis (30 days)
  await redis.setex(
    RedisKeys.refreshToken(user.id, tokenId),
    30 * 24 * 60 * 60,
    refreshToken
  );

  logger.info(`User ${user.id} logged in via OTP (new: ${isNewUser})`);

  return {
    access_token: accessToken,
    refresh_token: `${tokenId}:${refreshToken}`,
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      is_profile_complete: isProfileComplete,
      requires_password_setup: requiresPasswordSetup,
    },
  };
}

export async function loginWithPassword(
  phone: string,
  password: string
): Promise<{
  access_token: string;
  refresh_token: string;
  user: { id: string; phone: string; role: UserRole; is_profile_complete: boolean };
}> {
  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user || !user.is_active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or password.');
  }

  if (!user.password) {
    throw new AppError(400, 'PASSWORD_NOT_SET', 'No password set. Please login with OTP first to set your password.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or password.');
  }

  const isProfileComplete = await checkProfileComplete(user.id, user.role);

  // Enforce concurrent session limit for shop_owner role
  await enforceSessionLimit(user.id, user.role);

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  const tokenId = uuidv4();

  await redis.setex(
    RedisKeys.refreshToken(user.id, tokenId),
    30 * 24 * 60 * 60,
    refreshToken
  );

  logger.info(`User ${user.id} logged in via password`);

  return {
    access_token: accessToken,
    refresh_token: `${tokenId}:${refreshToken}`,
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      is_profile_complete: isProfileComplete,
    },
  };
}

export async function setPassword(userId: string, newPassword: string): Promise<void> {
  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  logger.info(`User ${userId} set their password`);
}

export async function resetPasswordWithOtp(
  phone: string,
  otpRef: string,
  newPassword: string
): Promise<void> {
  // Validate the OTP ref is still valid in Redis
  const stored = await redis.get(RedisKeys.otpRef(otpRef));
  if (!stored) {
    throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.');
  }

  const { phone: storedPhone } = JSON.parse(stored) as { phone: string; otp: string };
  if (storedPhone !== phone) {
    throw new AppError(400, 'OTP_INVALID', 'OTP does not match this phone number.');
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.is_active) {
    throw new AppError(404, 'NOT_FOUND', 'No account found with this phone number.');
  }

  // Consume the OTP so it cannot be reused
  await redis.del(RedisKeys.otpRef(otpRef));

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  logger.info(`User ${user.id} reset their password via OTP`);
}

export async function refreshAccessToken(
  rawRefreshToken: string
): Promise<{ access_token: string }> {
  const [tokenId, ...rest] = rawRefreshToken.split(':');
  const token = rest.join(':');

  if (!tokenId || !token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token format');
  }

  // We need to find which user this token belongs to — scan Redis pattern
  // In production, store tokenId → userId mapping for O(1) lookup
  const keys = await redis.keys(`refresh:*:${tokenId}`);
  if (!keys.length) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token expired or invalid');
  }

  const key = keys[0];
  const storedToken = await redis.get(key);

  if (!storedToken || storedToken !== token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token mismatch');
  }

  // Extract userId from key: refresh:{userId}:{tokenId}
  const userId = key.split(':')[1];
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.is_active) {
    throw new AppError(401, 'UNAUTHORIZED', 'User account is inactive');
  }

  const newAccessToken = generateAccessToken(userId, user.role);
  return { access_token: newAccessToken };
}

export async function logout(userId: string): Promise<void> {
  // Delete all refresh tokens for this user
  const keys = await redis.keys(`refresh:${userId}:*`);
  if (keys.length) {
    await redis.del(...keys);
  }
}

async function checkProfileComplete(userId: string, role: UserRole): Promise<boolean> {
  if (role === 'patient') {
    const patient = await prisma.patient.findUnique({ where: { user_id: userId } });
    return !!patient?.full_name;
  }
  if (role === 'doctor') {
    const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
    return !!doctor?.full_name;
  }
  if (role === 'shop_owner') {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
    return !!shop?.shop_name;
  }
  return true;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, role: true, is_verified: true, is_active: true },
  });
  if (!user) throw new Error('User not found');
  return user;
}

export async function savePushToken(userId: string, pushToken: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { fcm_token: pushToken } });
}
