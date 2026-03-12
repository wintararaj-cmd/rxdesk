import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // AWS S3 / Cloudflare R2 / Backblaze B2
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  S3_BUCKET_NAME: z.string().optional(),
  // Optional: set to use Cloudflare R2 or Backblaze B2 instead of AWS S3
  S3_ENDPOINT: z.string().url().optional(),

  // Fast2SMS
  FAST2SMS_API_KEY: z.string().optional(),

  // Firebase
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Prescription QR
  PRESCRIPTION_HMAC_SECRET: z.string().min(16),

  // App URLs
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL_LAN: z.string().url().optional(),
  API_URL: z.string().url().default('http://localhost:3000'),

  // OTP
  OTP_EXPIRY_SECONDS: z.coerce.number().default(300),
  OTP_LENGTH: z.coerce.number().default(6),
  DEV_FIXED_OTP: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
