import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Generate a signed QR payload for a prescription.
 * Format: `prescriptionId:issuedAt:hmac`
 */
export function signPrescriptionQR(prescriptionId: string, issuedAt: Date): string {
  const payload = `${prescriptionId}:${issuedAt.toISOString()}`;
  const hmac = crypto
    .createHmac('sha256', env.PRESCRIPTION_HMAC_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}:${hmac}`;
}

/**
 * Verify a prescription QR payload.
 * Returns the prescription ID if valid, null if tampered.
 */
export function verifyPrescriptionQR(qrContent: string): string | null {
  const parts = qrContent.split(':');
  if (parts.length < 3) return null;

  const signature = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(':');
  const prescriptionId = parts[0];

  const expected = crypto
    .createHmac('sha256', env.PRESCRIPTION_HMAC_SECRET)
    .update(payload)
    .digest('hex');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
    return isValid ? prescriptionId : null;
  } catch {
    return null;
  }
}
