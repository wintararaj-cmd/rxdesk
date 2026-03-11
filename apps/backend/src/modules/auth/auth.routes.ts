import { Router } from 'express';
import { otpRateLimiter } from '../../middleware/rateLimit';
import { authenticate } from '../../middleware/auth';
import * as controller from './auth.controller';

const router = Router();

/**
 * @route  POST /api/v1/auth/login
 * @desc   Login with phone number and password
 * @access Public
 */
router.post('/login', controller.login);

/**
 * @route  POST /api/v1/auth/otp/send
 * @desc   Send OTP to phone number (first-time login or password reset)
 * @access Public
 */
router.post('/otp/send', otpRateLimiter, controller.sendOtp);

/**
 * @route  POST /api/v1/auth/otp/verify
 * @desc   Verify OTP and return JWT tokens
 * @access Public
 */
router.post('/otp/verify', controller.verifyOtp);

/**
 * @route  POST /api/v1/auth/password/set
 * @desc   Set password for first-time users after OTP verification
 * @access Private
 */
router.post('/password/set', authenticate, controller.setPassword);

/**
 * @route  POST /api/v1/auth/password/reset
 * @desc   Reset password using a verified OTP ref (forgot password flow)
 * @access Public
 */
router.post('/password/reset', controller.resetPassword);

/**
 * @route  POST /api/v1/auth/token/refresh
 * @desc   Refresh access token using refresh token
 * @access Public
 */
router.post('/token/refresh', controller.refreshToken);

/**
 * @route  POST /api/v1/auth/logout
 * @desc   Invalidate all refresh tokens for user
 * @access Private
 */
router.post('/logout', authenticate, controller.logout);

/**
 * @route  PATCH /api/v1/auth/role
 * @desc   Update user role (patient → doctor or shop_owner during onboarding)
 * @access Private
 */
router.patch('/role', authenticate, controller.updateRole);

/**
 * @route  GET /api/v1/auth/me
 * @desc   Return current authenticated user info
 * @access Private
 */
router.get('/me', authenticate, controller.getMe);

/**
 * @route  PATCH /api/v1/auth/push-token
 * @desc   Register / update the device push token for the authenticated user
 * @access Private
 */
router.patch('/push-token', authenticate, controller.registerPushToken);

export default router;
