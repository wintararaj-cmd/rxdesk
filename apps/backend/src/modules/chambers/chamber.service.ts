import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

interface SlotInfo {
  start: string;
  end: string;
  token: number;
  status: 'available' | 'booked' | 'blocked';
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export async function getAvailableSlots(chamberId: string, dateStr: string): Promise<SlotInfo[]> {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();

  const chamber = await prisma.doctorChamber.findUnique({
    where: { id: chamberId },
    include: {
      schedules: { where: { day_of_week: dayOfWeek, is_active: true } },
      leaves: { where: { leave_date: { gte: date, lte: date } } },
    },
  });

  if (!chamber || chamber.status !== 'active') {
    throw new AppError(404, 'NOT_FOUND', 'Chamber not found or not active');
  }

  if (chamber.leaves.length > 0) {
    throw new AppError(409, 'DOCTOR_ON_LEAVE', 'Doctor is on leave on this date');
  }

  if (chamber.schedules.length === 0) {
    return [];
  }

  const schedule = chamber.schedules[0];

  // Get existing bookings for this date
  const booked = await prisma.appointment.findMany({
    where: {
      chamber_id: chamberId,
      appointment_date: { gte: date, lt: new Date(date.getTime() + 86400000) },
      status: { notIn: ['cancelled', 'no_show'] },
    },
    select: { slot_start_time: true },
  });

  const bookedTimes = new Set(booked.map((a) => a.slot_start_time));

  // Generate all slots
  const slots: SlotInfo[] = [];
  let current = schedule.start_time;
  let token = 1;

  while (current < schedule.end_time && slots.length < schedule.max_patients) {
    const end = addMinutesToTime(current, schedule.slot_duration);
    slots.push({
      start: current,
      end,
      token: token++,
      status: bookedTimes.has(current) ? 'booked' : 'available',
    });
    current = end;
  }

  return slots;
}

export async function createChamber(
  userId: string,
  data: { shop_id: string; consultation_fee?: number }
) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor profile not found');
  if (doctor.verification_status !== 'approved') {
    throw new AppError(403, 'DOCTOR_NOT_VERIFIED', 'Your profile must be approved before adding chambers');
  }

  const shop = await prisma.medicalShop.findUnique({ where: { id: data.shop_id } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const existing = await prisma.doctorChamber.findUnique({
    where: { doctor_id_shop_id: { doctor_id: doctor.id, shop_id: data.shop_id } },
  });
  if (existing) throw new AppError(409, 'DUPLICATE_BOOKING', 'Chamber link already exists');

  return prisma.doctorChamber.create({
    data: {
      doctor_id: doctor.id,
      shop_id: data.shop_id,
      consultation_fee: data.consultation_fee ?? 0,
      requested_by: 'doctor',
      status: 'pending',
    },
  });
}

export async function linkDoctorByShop(
  shopOwnerUserId: string,
  data: { mci_number: string; consultation_fee?: number }
) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: shopOwnerUserId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const doctor = await prisma.doctor.findUnique({ where: { mci_number: data.mci_number } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'No doctor found with this MCI number');
  if (doctor.verification_status !== 'approved') {
    throw new AppError(403, 'DOCTOR_NOT_VERIFIED', 'This doctor has not been approved yet');
  }

  const existing = await prisma.doctorChamber.findUnique({
    where: { doctor_id_shop_id: { doctor_id: doctor.id, shop_id: shop.id } },
  });
  if (existing) throw new AppError(409, 'DUPLICATE_BOOKING', 'This doctor is already linked to your shop');

  return prisma.doctorChamber.create({
    data: {
      doctor_id: doctor.id,
      shop_id: shop.id,
      consultation_fee: data.consultation_fee ?? 0,
      requested_by: 'shop',
      status: 'active',
      approved_at: new Date(),
    },
    include: {
      doctor: { select: { id: true, full_name: true, specialization: true, experience_years: true } },
    },
  });
}

export async function approveChamber(chamberId: string, userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const chamber = await prisma.doctorChamber.findFirst({
    where: { id: chamberId, shop_id: shop.id },
  });
  if (!chamber) throw new AppError(404, 'NOT_FOUND', 'Chamber link not found');
  if (chamber.status === 'active') throw new AppError(409, 'DUPLICATE_BOOKING', 'Already approved');

  return prisma.doctorChamber.update({
    where: { id: chamberId },
    data: { status: 'active', approved_at: new Date() },
  });
}

export async function setSchedule(
  chamberId: string,
  userId: string,
  schedules: { day_of_week: number; start_time: string; end_time: string; slot_duration?: number; max_patients?: number }[]
) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(403, 'FORBIDDEN', 'Only doctors can set schedules');

  const chamber = await prisma.doctorChamber.findFirst({
    where: { id: chamberId, doctor_id: doctor.id },
  });
  if (!chamber) throw new AppError(404, 'NOT_FOUND', 'Chamber not found');

  // Replace all schedules for this chamber
  await prisma.chamberSchedule.deleteMany({ where: { chamber_id: chamberId } });

  return prisma.chamberSchedule.createMany({
    data: schedules.map((s) => ({ chamber_id: chamberId, ...s })),
  });
}

export async function markLeave(
  chamberId: string,
  userId: string,
  leaveDate: string,
  reason?: string
) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(403, 'FORBIDDEN', 'Only doctors can mark leaves');

  return prisma.chamberLeave.create({
    data: { chamber_id: chamberId, leave_date: new Date(leaveDate), reason },
  });
}

export async function getMyChambers(userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor profile not found');

  return prisma.doctorChamber.findMany({
    where: { doctor_id: doctor.id },
    include: {
      shop: {
        select: {
          id: true, shop_name: true, address_line: true, city: true, pin_code: true,
          contact_phone: true,
        },
      },
      schedules: { where: { is_active: true }, orderBy: { day_of_week: 'asc' } },
    },
    orderBy: { created_at: 'asc' },
  });
}

export async function getShopChambers(userId: string, status?: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  return prisma.doctorChamber.findMany({
    where: {
      shop_id: shop.id,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      doctor: { select: { id: true, full_name: true, specialization: true, experience_years: true, profile_photo: true } },
      schedules: { where: { is_active: true }, orderBy: { day_of_week: 'asc' } },
    },
    orderBy: { created_at: 'desc' },
  });
}
