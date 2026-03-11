import { z } from 'zod';

// ─── Common ───────────────────────────────────

export const uuidSchema = z.string().uuid();

export const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, 'Phone must be a valid Indian mobile number (+91XXXXXXXXXX)');

export const pinCodeSchema = z.string().regex(/^\d{6}$/, 'Pin code must be 6 digits');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Auth ─────────────────────────────────────

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits'),
  otp_ref: z.string().min(1),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(8),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export const resetPasswordSchema = z
  .object({
    phone: phoneSchema,
    otp_ref: z.string().min(1, 'otp_ref is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(8),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

// ─── Patient ──────────────────────────────────

export const createPatientSchema = z.object({
  full_name: z.string().min(2).max(100),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  date_of_birth: z.string().date().optional(),
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  address_line: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  pin_code: pinCodeSchema.optional(),
  state: z.string().max(100).optional(),
  emergency_contact: phoneSchema.optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

// ─── Doctor ───────────────────────────────────

export const createDoctorSchema = z.object({
  full_name: z.string().min(2).max(100),
  mci_number: z.string().min(5).max(50),
  specialization: z.string().max(100).optional(),
  qualifications: z.array(z.string()).min(1),
  experience_years: z.number().int().min(0).max(60).default(0),
  gender: z.enum(['male', 'female', 'other']).optional(),
  languages: z.array(z.string()).default(['Hindi', 'English']),
});

// ─── Shop ─────────────────────────────────────

export const createShopSchema = z.object({
  shop_name: z.string().min(2).max(150),
  shop_type: z
    .enum(['medical_shop', 'clinic', 'pharmacy', 'dispensary'])
    .default('medical_shop'),
  gst_number: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number')
    .optional(),
  drug_license_no: z.string().min(5).max(50),
  address_line: z.string().min(5).max(300),
  city: z.string().min(2).max(100),
  district: z.string().max(100).optional(),
  state: z.string().min(2).max(100),
  pin_code: pinCodeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contact_phone: phoneSchema,
  contact_email: z.string().email().optional(),
  opening_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  closing_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  working_days: z
    .array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']))
    .default(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
});

// ─── Chamber ──────────────────────────────────

export const createChamberSchema = z.object({
  shop_id: uuidSchema,
  consultation_fee: z.number().min(0).max(10000).default(0),
});

export const chamberScheduleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_duration: z.number().int().min(5).max(60).default(15),
  max_patients: z.number().int().min(1).max(100).default(20),
});

export const setScheduleSchema = z.array(chamberScheduleSchema).min(1);

// ─── Appointment ──────────────────────────────

export const bookAppointmentSchema = z.object({
  chamber_id: uuidSchema,
  appointment_date: z.string().date(),
  slot_start_time: z.string().regex(/^\d{2}:\d{2}$/),
  chief_complaint: z.string().max(500).optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum([
    'confirmed',
    'arrived',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show',
  ]),
  cancel_reason: z.string().max(300).optional(),
});

// ─── Prescription ─────────────────────────────

export const prescriptionItemSchema = z.object({
  medicine_id: uuidSchema.optional(),
  medicine_name: z.string().min(1).max(200),
  dosage: z.string().max(100),
  frequency: z.string().max(100),
  duration: z.string().max(100),
  instructions: z.string().max(300).optional(),
  quantity: z.number().int().min(1).max(999),
});

export const createPrescriptionSchema = z.object({
  appointment_id: uuidSchema,
  diagnosis: z.string().min(1).max(500),
  chief_complaint: z.string().max(500).optional(),
  vitals: z
    .object({
      bp: z.string().optional(),
      pulse: z.string().optional(),
      temp: z.string().optional(),
      weight: z.string().optional(),
      spo2: z.string().optional(),
    })
    .optional(),
  items: z.array(prescriptionItemSchema).min(1),
  advice: z.string().max(1000).optional(),
  follow_up_date: z.string().date().optional(),
});

// ─── Inventory ───────────────────────────────

export const addInventoryItemSchema = z.object({
  medicine_id: uuidSchema.optional(),
  medicine_name: z.string().min(1).max(200),
  hsn_code: z.string().max(20).optional(),
  unit: z.string().max(20).default('strip'),
  mrp: z.number().min(0),
  gst_rate: z.number().min(0).max(100).default(12),
  reorder_level: z.number().int().min(0).default(10),
  // Fields below come from purchase invoice — optional on creation
  stock_qty: z.number().int().min(0).default(0),
  purchase_price: z.number().min(0).optional(),
  batch_number: z.string().max(50).optional(),
  expiry_date: z.string().date().optional(),
});

export const updateInventorySchema = addInventoryItemSchema.partial();
