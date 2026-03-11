// ─────────────────────────────────────────────
//  RxDesk — Shared Types
// ─────────────────────────────────────────────

export type UserRole = 'patient' | 'doctor' | 'shop_owner' | 'admin';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type Gender = 'male' | 'female' | 'other';

export type MedicineForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'injection'
  | 'ointment'
  | 'drops'
  | 'inhaler'
  | 'powder'
  | 'other';

export type NotificationType = 'sms' | 'push' | 'whatsapp';

export type NotificationCategory =
  | 'appointment_reminder'
  | 'appointment_confirmed'
  | 'prescription_ready'
  | 'bill_generated'
  | 'stock_alert'
  | 'subscription_expiry'
  | 'general';

export type PaymentStatus = 'pending' | 'paid' | 'not_required';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

// ─── API Response Shapes ───────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiPaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Auth Token Payload ───────────────────────

export interface JwtPayload {
  sub: string;       // user id
  role: UserRole;
  iat: number;
  exp: number;
}

// ─── Common DTOs ─────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface TimeSlot {
  start: string;    // "09:00"
  end: string;      // "09:15"
  token: number;
  status: 'available' | 'booked' | 'blocked';
}

// ─── Doctor Search Result ─────────────────────

export interface DoctorSearchResult {
  id: string;
  full_name: string;
  specialization: string | null;
  experience_years: number;
  profile_photo: string | null;
  qualifications: string[];
  chambers: {
    chamber_id: string;
    shop_id: string;
    shop_name: string;
    address: string;
    city: string;
    pin_code: string;
    consultation_fee: number;
    available_today: boolean;
    next_available: string | null;
    distance_km?: number;
  }[];
}

// ─── Prescription ─────────────────────────────

export interface PrescriptionItemInput {
  medicine_id?: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity: number;
}

export interface VitalsData {
  bp?: string;
  pulse?: string;
  temp?: string;
  weight?: string;
  spo2?: string;
  [key: string]: string | undefined;
}

// ─── Error Codes ──────────────────────────────

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  SLOT_NOT_AVAILABLE: 'SLOT_NOT_AVAILABLE',
  DOCTOR_ON_LEAVE: 'DOCTOR_ON_LEAVE',
  PRESCRIPTION_DISPENSED: 'PRESCRIPTION_DISPENSED',
  SHOP_NOT_VERIFIED: 'SHOP_NOT_VERIFIED',
  DOCTOR_NOT_VERIFIED: 'DOCTOR_NOT_VERIFIED',
  SUBSCRIPTION_LIMIT: 'SUBSCRIPTION_LIMIT',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
