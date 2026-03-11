import { Request, Response, NextFunction } from 'express';
import { sendOtpSchema, verifyOtpSchema, loginSchema, setPasswordSchema, resetPasswordSchema } from '@rxdesk/shared';
import * as authService from './auth.service';

export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone } = sendOtpSchema.parse(req.body);
    const result = await authService.sendOtp(phone);
    res.json({ success: true, data: result, message: 'OTP sent successfully' });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = verifyOtpSchema.parse(req.body);
    const result = await authService.verifyOtpAndLogin(body.phone, body.otp, body.otp_ref);
    res.json({ success: true, data: result, message: 'Login successful' });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refresh_token } = req.body as { refresh_token?: string };
    if (!refresh_token) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'refresh_token is required' },
      });
      return;
    }
    const result = await authService.refreshAccessToken(refresh_token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.user!.id);
    res.json({ success: true, data: null, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.body as { role?: string };
    const allowedRoles = ['patient', 'doctor', 'shop_owner'];
    if (!role || !allowedRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'role must be patient, doctor, or shop_owner' },
      });
      return;
    }
    await authService.updateUserRole(req.user!.id, role as 'patient' | 'doctor' | 'shop_owner');
    res.json({ success: true, data: { role }, message: 'Role updated' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getUserById(req.user!.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function registerPushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { push_token } = req.body as { push_token?: string };
    if (!push_token || typeof push_token !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'push_token (string) is required' },
      });
      return;
    }
    await authService.savePushToken(req.user!.id, push_token);
    res.json({ success: true, data: null, message: 'Push token registered' });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, password } = loginSchema.parse(req.body);
    const result = await authService.loginWithPassword(phone, password);
    res.json({ success: true, data: result, message: 'Login successful' });
  } catch (err) {
    next(err);
  }
}

export async function setPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { password } = setPasswordSchema.parse(req.body);
    await authService.setPassword(req.user!.id, password);
    res.json({ success: true, data: null, message: 'Password set successfully' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, otp_ref, password, confirm_password } = req.body as {
      phone?: string; otp_ref?: string; password?: string; confirm_password?: string;
    };
    const parsed = resetPasswordSchema.parse({ phone, otp_ref, password, confirm_password });
    await authService.resetPasswordWithOtp(parsed.phone, parsed.otp_ref, parsed.password);
    res.json({ success: true, data: null, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}
