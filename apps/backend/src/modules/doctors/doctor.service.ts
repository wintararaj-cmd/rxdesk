import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getPagination } from '../../utils/pagination';
import { haversineDistance } from '../../utils/geoUtils';
import { Request } from 'express';

export async function getDoctorByUserId(userId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { user_id: userId },
    include: { user: { select: { phone: true } } },
  });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor profile not found');
  return doctor;
}

export async function getDoctorById(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      user: { select: { phone: true } },
      chambers: {
        where: { status: 'active' },
        include: {
          shop: {
            select: {
              id: true, shop_name: true, address_line: true, city: true, pin_code: true,
              contact_phone: true, latitude: true, longitude: true,
            },
          },
          schedules: { where: { is_active: true } },
        },
      },
    },
  });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor not found');
  return doctor;
}

export async function createDoctor(
  userId: string,
  data: {
    full_name: string;
    mci_number: string;
    specialization?: string;
    qualifications: string[];
    experience_years?: number;
    gender?: 'male' | 'female' | 'other';
    languages?: string[];
  }
) {
  // Check MCI number uniqueness
  const existing = await prisma.doctor.findUnique({ where: { mci_number: data.mci_number } });
  if (existing) {
    throw new AppError(409, 'DUPLICATE_BOOKING', 'A doctor with this MCI number already exists');
  }

  const doctor = await prisma.doctor.create({
    data: { user_id: userId, ...data, languages: data.languages ?? ['Hindi', 'English'] },
  });

  // Update user role to doctor
  await prisma.user.update({ where: { id: userId }, data: { role: 'doctor' } });
  return doctor;
}

export async function searchDoctors(req: Request) {
  const { page, limit, skip } = getPagination(req);
  const q = (req.query.q as string) || '';
  const pincode = (req.query.pincode ?? req.query.pin_code) as string | undefined;
  const specialization = req.query.specialization as string | undefined;
  const availableToday = req.query.available_today === 'true';
  const userLat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const userLng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

  const today = new Date().getDay(); // 0=Sun, 6=Sat

  const doctors = await prisma.doctor.findMany({
    where: {
      verification_status: 'approved',
      ...(q && {
        OR: [
          { full_name: { contains: q, mode: 'insensitive' } },
          { specialization: { contains: q, mode: 'insensitive' } },
        ],
      }),
      ...(specialization && { specialization: { contains: specialization, mode: 'insensitive' } }),
      ...(pincode && {
        chambers: {
          some: { shop: { pin_code: pincode }, status: 'active' },
        },
      }),
      ...(availableToday && {
        chambers: {
          some: {
            status: 'active',
            schedules: { some: { day_of_week: today, is_active: true } },
          },
        },
      }),
    },
    include: {
      chambers: {
        where: { status: 'active' },
        include: {
          shop: {
            select: {
              id: true, shop_name: true, address_line: true, city: true, pin_code: true,
              contact_phone: true, latitude: true, longitude: true,
            },
          },
          schedules: { where: { is_active: true } },
        },
      },
    },
    skip,
    take: limit,
  });

  // Add distance if user coordinates provided
  const result = doctors.map((doc) => ({
    ...doc,
    chambers: doc.chambers.map((c) => ({
      ...c,
      distance_km:
        userLat && userLng && c.shop.latitude && c.shop.longitude
          ? haversineDistance(
              userLat,
              userLng,
              Number(c.shop.latitude),
              Number(c.shop.longitude)
            )
          : undefined,
    })),
  }));

  const total = await prisma.doctor.count({
    where: { verification_status: 'approved' },
  });

  return { doctors: result, total, page, limit };
}

export async function getDoctorStats(userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor profile not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    prisma.appointment.count({
      where: {
        chamber: { doctor_id: doctor.id },
        appointment_date: { gte: today, lt: tomorrow },
        status: { notIn: ['cancelled', 'no_show'] },
      },
    }),
    prisma.appointment.count({
      where: {
        chamber: { doctor_id: doctor.id },
        appointment_date: { gte: weekStart },
        status: { notIn: ['cancelled', 'no_show'] },
      },
    }),
    prisma.appointment.count({
      where: {
        chamber: { doctor_id: doctor.id },
        appointment_date: { gte: monthStart },
        status: { notIn: ['cancelled', 'no_show'] },
      },
    }),
    prisma.appointment.count({
      where: {
        chamber: { doctor_id: doctor.id },
        status: { notIn: ['cancelled', 'no_show'] },
      },
    }),
  ]);

  return { today: todayCount, this_week: weekCount, this_month: monthCount, total: totalCount };
}

export async function updateDoctor(
  userId: string,
  data: {
    full_name?: string;
    specialization?: string;
    qualifications?: string[];
    experience_years?: number;
    gender?: 'male' | 'female' | 'other';
    languages?: string[];
    consultation_fee?: number;
  }
) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor profile not found');

  return prisma.doctor.update({
    where: { user_id: userId },
    data: {
      ...(data.full_name !== undefined && { full_name: data.full_name }),
      ...(data.specialization !== undefined && { specialization: data.specialization }),
      ...(data.qualifications !== undefined && { qualifications: data.qualifications }),
      ...(data.experience_years !== undefined && { experience_years: data.experience_years }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.languages !== undefined && { languages: data.languages }),
    },
  });
}
