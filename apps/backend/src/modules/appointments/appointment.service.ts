import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getAvailableSlots } from '../chambers/chamber.service';
import logger from '../../utils/logger';

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export async function bookAppointment(
  userId: string,
  data: {
    chamber_id: string;
    appointment_date: string;
    slot_start_time: string;
    chief_complaint?: string;
  }
) {
  const patient = await prisma.patient.findUnique({ where: { user_id: userId } });
  if (!patient) throw new AppError(404, 'NOT_FOUND', 'Patient profile not found');

  // Check slot availability (re-validate)
  const slots = await getAvailableSlots(data.chamber_id, data.appointment_date);
  const slot = slots.find((s) => s.start === data.slot_start_time);

  if (!slot) throw new AppError(409, 'SLOT_NOT_AVAILABLE', 'Selected time slot does not exist');
  if (slot.status !== 'available') throw new AppError(409, 'SLOT_NOT_AVAILABLE', 'This slot is already booked');

  // Check duplicate booking by same patient on same day at same chamber
  const duplicate = await prisma.appointment.findFirst({
    where: {
      patient_id: patient.id,
      chamber_id: data.chamber_id,
      appointment_date: {
        gte: new Date(data.appointment_date),
        lt: new Date(new Date(data.appointment_date).getTime() + 86400000),
      },
      status: { notIn: ['cancelled', 'no_show'] },
    },
  });
  if (duplicate) throw new AppError(409, 'DUPLICATE_BOOKING', 'You already have an appointment on this day at this chamber');

  // Get chamber details for slot_end_time + token
  const chamber = await prisma.doctorChamber.findUnique({
    where: { id: data.chamber_id },
    include: {
      schedules: {
        where: {
          day_of_week: new Date(data.appointment_date).getDay(),
          is_active: true,
        },
      },
      shop: { select: { id: true } },
    },
  });

  const slotDuration = chamber?.schedules[0]?.slot_duration ?? 15;
  const slotEndTime = addMinutes(data.slot_start_time, slotDuration);

  // Count existing appointments to assign token
  const existingCount = await prisma.appointment.count({
    where: {
      chamber_id: data.chamber_id,
      appointment_date: {
        gte: new Date(data.appointment_date),
        lt: new Date(new Date(data.appointment_date).getTime() + 86400000),
      },
      status: { notIn: ['cancelled', 'no_show'] },
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      patient_id: patient.id,
      chamber_id: data.chamber_id,
      appointment_date: new Date(data.appointment_date),
      slot_start_time: data.slot_start_time,
      slot_end_time: slotEndTime,
      token_number: existingCount + 1,
      chief_complaint: data.chief_complaint,
      status: 'booked',
    },
    include: {
      chamber: {
        include: {
          doctor: { select: { full_name: true, specialization: true } },
          shop: { select: { shop_name: true, address_line: true, city: true, contact_phone: true } },
        },
      },
      patient: { select: { full_name: true } },
    },
  });

  logger.info(`Appointment booked: ${appointment.id} for patient ${patient.id}`);

  // ── In-app notification: confirm to patient ─────────────────────────────
  const doctorName = appointment.chamber.doctor.full_name;
  const shopName   = appointment.chamber.shop.shop_name;
  const apptDate   = new Date(appointment.appointment_date).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  prisma.notification.create({
    data: {
      user_id: userId,
      title: 'Appointment Confirmed',
      body: `Your appointment with Dr. ${doctorName} at ${shopName} on ${apptDate} at ${appointment.slot_start_time} has been booked. Token #${appointment.token_number}.`,
      type: 'push',
      category: 'appointment_confirmed',
      reference_id: appointment.id,
      reference_type: 'appointment',
    },
  }).catch((e) => logger.warn(`Notification create failed: ${e?.message}`));

  return appointment;
}

export async function bookWalkInAppointment(
  shopOwnerUserId: string,
  data: {
    chamber_id: string;
    appointment_date: string;
    slot_start_time?: string;   // optional — defaults to current time if no schedule
    patient_phone: string;
    patient_name?: string;
    chief_complaint?: string;
  }
) {
  // Verify shop owns the chamber
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: shopOwnerUserId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const chamber = await prisma.doctorChamber.findFirst({
    where: { id: data.chamber_id, shop_id: shop.id, status: 'active' },
  });
  if (!chamber) throw new AppError(404, 'NOT_FOUND', 'Chamber not found or not active in your shop');

  // Normalise phone → +91XXXXXXXXXX
  const rawDigits = data.patient_phone.replace(/\D/g, '');
  const phone = rawDigits.startsWith('91') ? `+${rawDigits}` : `+91${rawDigits}`;

  // Find or create user + patient
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({ data: { phone, role: 'patient' } });
  }

  let patient = await prisma.patient.findUnique({ where: { user_id: user.id } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: { user_id: user.id, full_name: data.patient_name?.trim() || 'Walk-in Patient' },
    });
  }

  // Resolve slot time: validate against schedule if slot provided, otherwise use current time
  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let resolvedSlotStart: string;
  let slotDuration = 15;

  const slots = await getAvailableSlots(data.chamber_id, data.appointment_date);

  if (slots.length > 0 && data.slot_start_time) {
    // Schedule exists and slot was selected — validate it
    const slot = slots.find((s) => s.start === data.slot_start_time);
    if (!slot) throw new AppError(409, 'SLOT_NOT_AVAILABLE', 'Selected slot does not exist');
    if (slot.status !== 'available') throw new AppError(409, 'SLOT_NOT_AVAILABLE', 'Slot is already booked');
    resolvedSlotStart = data.slot_start_time;
  } else if (slots.length > 0 && !data.slot_start_time) {
    // Schedule exists but no slot picked — take first available
    const firstAvailable = slots.find((s) => s.status === 'available');
    if (!firstAvailable) throw new AppError(409, 'SLOT_NOT_AVAILABLE', 'No available slots for this date');
    resolvedSlotStart = firstAvailable.start;
  } else {
    // No schedule set — walk-in without time constraint, use provided time or now
    resolvedSlotStart = data.slot_start_time ?? nowTimeStr;
  }

  // Duplicate check
  const duplicate = await prisma.appointment.findFirst({
    where: {
      patient_id: patient.id,
      chamber_id: data.chamber_id,
      appointment_date: {
        gte: new Date(data.appointment_date),
        lt: new Date(new Date(data.appointment_date).getTime() + 86400000),
      },
      status: { notIn: ['cancelled', 'no_show'] },
    },
  });
  if (duplicate) throw new AppError(409, 'DUPLICATE_BOOKING', 'Patient already has an appointment at this chamber for this date');

  // Fetch slot duration from schedule
  const chamberFull = await prisma.doctorChamber.findUnique({
    where: { id: data.chamber_id },
    include: {
      schedules: {
        where: { day_of_week: new Date(data.appointment_date).getDay(), is_active: true },
      },
    },
  });
  slotDuration = chamberFull?.schedules[0]?.slot_duration ?? 15;
  const slotEndTime = addMinutes(resolvedSlotStart, slotDuration);

  const existingCount = await prisma.appointment.count({
    where: {
      chamber_id: data.chamber_id,
      appointment_date: {
        gte: new Date(data.appointment_date),
        lt: new Date(new Date(data.appointment_date).getTime() + 86400000),
      },
      status: { notIn: ['cancelled', 'no_show'] },
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      patient_id: patient.id,
      chamber_id: data.chamber_id,
      appointment_date: new Date(data.appointment_date),
      slot_start_time: resolvedSlotStart,
      slot_end_time: slotEndTime,
      token_number: existingCount + 1,
      chief_complaint: data.chief_complaint,
      status: 'booked',
    },
    include: {
      chamber: {
        include: {
          doctor: { select: { full_name: true, specialization: true } },
          shop: { select: { id: true, shop_name: true } },
        },
      },
      patient: { select: { full_name: true, user_id: true } },
    },
  });

  logger.info(`Walk-in appointment booked: ${appointment.id} for patient ${patient.id} by shop ${shop.id}`);
  return appointment;
}

export async function updateAppointmentStatus(
  appointmentId: string,
  userId: string,
  userRole: string,
  status: string,
  cancelReason?: string
) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) throw new AppError(404, 'NOT_FOUND', 'Appointment not found');

  // Authorization check
  if (userRole === 'patient') {
    const patient = await prisma.patient.findUnique({ where: { user_id: userId } });
    if (appointment.patient_id !== patient?.id) throw new AppError(403, 'FORBIDDEN', 'Not your appointment');
    if (!['cancelled'].includes(status)) throw new AppError(403, 'FORBIDDEN', 'Patients can only cancel appointments');
  } else if (userRole === 'shop_owner') {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
    const chamber = await prisma.doctorChamber.findUnique({ where: { id: appointment.chamber_id } });
    if (chamber?.shop_id !== shop?.id) throw new AppError(403, 'FORBIDDEN', 'Not your shop appointment');
  } else if (userRole === 'doctor') {
    const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
    const chamber = await prisma.doctorChamber.findUnique({ where: { id: appointment.chamber_id } });
    if (chamber?.doctor_id !== doctor?.id) throw new AppError(403, 'FORBIDDEN', 'Not your patient');
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: status as never,
      ...(status === 'cancelled' && {
        cancelled_by: userRole as 'patient' | 'doctor' | 'shop',
        cancel_reason: cancelReason,
      }),
    },
    include: {
      chamber: { include: { shop: { select: { id: true } } } },
      patient: { select: { user_id: true } },
    },
  });

  // ── In-app notification: status change → patient ─────────────────────────
  const STATUS_MESSAGES: Record<string, string> = {
    confirmed:       'Your appointment has been confirmed.',
    in_consultation: 'You are now in consultation. The doctor is ready for you.',
    completed:       'Your appointment is complete. Check prescriptions for your report.',
    cancelled:       `Your appointment was cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
    no_show:         'You were marked as a no-show for your appointment.',
  };
  const msgBody = STATUS_MESSAGES[status];
  if (msgBody) {
    prisma.notification.create({
      data: {
        user_id: updated.patient.user_id,
        title: 'Appointment Update',
        body: msgBody,
        type: 'push',
        category: 'appointment_reminder',
        reference_id: updated.id,
        reference_type: 'appointment',
      },
    }).catch((e) => logger.warn(`Notification create (status) failed: ${e?.message}`));
  }

  return updated;
}

export async function getTodayAppointmentsForShop(userId: string, chamberId?: string, date?: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  // Use same UTC-based approach as appointment creation for consistency
  const dateStr = date || new Date().toISOString().slice(0, 10);
  const startDate = new Date(dateStr);          // parsed as UTC midnight
  const endDate   = new Date(startDate.getTime() + 86_400_000); // +24h

  return prisma.appointment.findMany({
    where: {
      chamber: {
        shop_id: shop.id,
        ...(chamberId ? { id: chamberId } : {}),
      },
      appointment_date: { gte: startDate, lt: endDate },
      status: { notIn: ['cancelled', 'no_show'] },
    },
    include: {
      patient: { select: { full_name: true, age: true, gender: true, blood_group: true, user: { select: { phone: true } } } },
      chamber: {
        include: {
          doctor: { select: { full_name: true, specialization: true } },
          shop: { select: { shop_name: true } },
        },
      },
      prescription: { select: { id: true } },
    },
    orderBy: [{ slot_start_time: 'asc' }, { token_number: 'asc' }],
  });
}

export async function getTodayAppointmentsForDoctor(userId: string, chamberId?: string) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.appointment.findMany({
    where: {
      chamber: {
        doctor_id: doctor.id,
        ...(chamberId ? { id: chamberId } : {}),
      },
      appointment_date: { gte: today, lt: tomorrow },
      status: { notIn: ['cancelled', 'no_show'] },
    },
    include: {
      patient: { select: { full_name: true, age: true, gender: true, blood_group: true } },
      chamber: { include: { shop: { select: { shop_name: true } } } },
      prescription: { select: { id: true } },
    },
    orderBy: [{ chamber_id: 'asc' }, { slot_start_time: 'asc' }],
  });
}

export async function getDoctorAppointmentHistory(
  userId: string,
  options: { chamber_id?: string; status?: string; page?: number; limit?: number },
) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor not found');

  const page  = Math.max(1, options.page  ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip  = (page - 1) * limit;

  const where: Record<string, unknown> = {
    chamber: {
      doctor_id: doctor.id,
      ...(options.chamber_id ? { id: options.chamber_id } : {}),
    },
  };

  if (options.status) {
    where.status = options.status;
  }

  const [total, appointments] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { full_name: true, age: true, gender: true } },
        chamber: { include: { shop: { select: { shop_name: true, city: true } } } },
        prescription: { select: { id: true } },
      },
      orderBy: [{ appointment_date: 'desc' }, { slot_start_time: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    data: appointments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getAppointmentById(appointmentId: string, userId: string, userRole: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { id: true, full_name: true, age: true, gender: true, blood_group: true, user_id: true } },
      chamber: {
        include: {
          doctor: { select: { full_name: true, specialization: true, user_id: true } },
          shop: { select: { shop_name: true, address_line: true, contact_phone: true, owner_user_id: true } },
        },
      },
      prescription: true,
    },
  });
  if (!appointment) throw new AppError(404, 'NOT_FOUND', 'Appointment not found');

  // Authorization: only the involved patient, doctor, or shop owner can view
  if (userRole === 'patient' && appointment.patient.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
  if (userRole === 'doctor' && appointment.chamber.doctor.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
  if (userRole === 'shop_owner' && appointment.chamber.shop.owner_user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  return appointment;
}
