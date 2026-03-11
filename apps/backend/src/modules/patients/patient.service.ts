import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getPagination } from '../../utils/pagination';
import { Request } from 'express';

export async function getProfile(userId: string) {
  const patient = await prisma.patient.findUnique({
    where: { user_id: userId },
    include: { user: { select: { phone: true } } },
  });
  if (!patient) throw new AppError(404, 'NOT_FOUND', 'Patient profile not found');
  return patient;
}

export async function createOrUpdateProfile(
  userId: string,
  data: {
    full_name: string;
    age?: number;
    gender?: 'male' | 'female' | 'other';
    date_of_birth?: string;
    blood_group?: string;
    address_line?: string;
    city?: string;
    pin_code?: string;
    state?: string;
    emergency_contact?: string;
  }
) {
  const patient = await prisma.patient.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      ...data,
      date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
    },
    update: {
      ...data,
      date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
    },
  });
  return patient;
}

export async function getPatientAppointments(patientId: string, req: Request) {
  const { page, limit, skip } = getPagination(req);
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where: { patient_id: patientId },
      include: {
        chamber: {
          include: {
            doctor: { select: { full_name: true, specialization: true, profile_photo: true } },
            shop: { select: { shop_name: true, address_line: true, city: true, contact_phone: true } },
          },
        },
        prescription: { select: { id: true, diagnosis: true, pdf_url: true } },
      },
      orderBy: { appointment_date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.appointment.count({ where: { patient_id: patientId } }),
  ]);
  return { appointments, total, page, limit };
}

export async function deletePatientAccount(userId: string) {
  // DPDP Act compliance: delete user and all related data (CASCADE handles relations)
  await prisma.user.delete({ where: { id: userId } });
}
