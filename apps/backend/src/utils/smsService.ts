import axios from 'axios';
import { env, isDev } from '../config/env';
import logger from './logger';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send OTP via Fast2SMS
 */
export async function sendOtpSms(phone: string, otp: string): Promise<SmsResult> {
  // In development, skip actual SMS and log the OTP
  if (isDev) {
    logger.info(`[DEV] OTP for ${phone}: ${otp}`);
    return { success: true, messageId: 'dev-mock' };
  }

  if (!env.FAST2SMS_API_KEY) {
    logger.warn('Fast2SMS not configured — skipping OTP SMS');
    return { success: false, error: 'SMS not configured' };
  }

  // Strip country code — Fast2SMS expects 10-digit Indian mobile number
  const mobile = phone.replace(/^\+91/, '').replace(/^\+/, '');

  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'otp',
        variables_values: otp,
        numbers: mobile,
      },
      {
        headers: {
          authorization: env.FAST2SMS_API_KEY,
        },
        timeout: 10_000,
      }
    );

    return {
      success: true,
      messageId: response.data?.request_id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`SMS OTP send failed for ${phone}: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Send appointment reminder SMS
 */
export async function sendReminderSms(
  phone: string,
  patientName: string,
  doctorName: string,
  shopName: string,
  appointmentTime: string,
  appointmentDate: string
): Promise<SmsResult> {
  if (isDev) {
    logger.info(
      `[DEV] Reminder SMS for ${phone}: Appointment with ${doctorName} at ${shopName} on ${appointmentDate} ${appointmentTime}`
    );
    return { success: true, messageId: 'dev-mock' };
  }

  if (!env.FAST2SMS_API_KEY) {
    return { success: false, error: 'SMS not configured' };
  }

  // Strip country code — Fast2SMS expects 10-digit Indian mobile number
  const mobile = phone.replace(/^\+91/, '').replace(/^\+/, '');
  const message = `Dear ${patientName}, your appointment with ${doctorName} at ${shopName} is scheduled on ${appointmentDate} at ${appointmentTime}.`;

  // Fast2SMS quick SMS (DLT route for production; uses 'q' route for now)
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'q',
        message,
        numbers: mobile,
      },
      {
        headers: {
          authorization: env.FAST2SMS_API_KEY,
        },
        timeout: 10_000,
      }
    );
    return { success: true, messageId: response.data?.request_id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Reminder SMS failed for ${phone}: ${message}`);
    return { success: false, error: message };
  }
}
