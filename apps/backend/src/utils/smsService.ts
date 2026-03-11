import axios from 'axios';
import { env, isDev } from '../config/env';
import logger from './logger';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send OTP via MSG91
 */
export async function sendOtpSms(phone: string, otp: string): Promise<SmsResult> {
  // In development, skip actual SMS and log the OTP
  if (isDev) {
    logger.info(`[DEV] OTP for ${phone}: ${otp}`);
    return { success: true, messageId: 'dev-mock' };
  }

  if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID_OTP) {
    logger.warn('MSG91 not configured — skipping OTP SMS');
    return { success: false, error: 'SMS not configured' };
  }

  try {
    const response = await axios.post(
      'https://api.msg91.com/api/v5/otp',
      {
        template_id: env.MSG91_TEMPLATE_ID_OTP,
        mobile: phone.replace('+', ''),
        otp,
      },
      {
        headers: {
          authkey: env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
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

  if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID_REMINDER) {
    return { success: false, error: 'SMS not configured' };
  }

  // MSG91 transactional SMS via Flow API
  try {
    const response = await axios.post(
      'https://api.msg91.com/api/v5/flow/',
      {
        template_id: env.MSG91_TEMPLATE_ID_REMINDER,
        sender: env.MSG91_SENDER_ID,
        mobiles: phone.replace('+', ''),
        VAR1: patientName,
        VAR2: doctorName,
        VAR3: shopName,
        VAR4: `${appointmentDate} at ${appointmentTime}`,
      },
      {
        headers: {
          authkey: env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
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
