import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export async function createTemplate(
  userId: string,
  data: {
    template_name: string;
    diagnosis: string;
    advice?: string;
    items: {
      medicine_id?: string;
      medicine_name: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
      quantity?: number;
    }[];
  }
) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(403, 'FORBIDDEN', 'Only doctors can create templates');

  if (!data.template_name) throw new AppError(400, 'VALIDATION_ERROR', 'Template name is required');
  if (!data.diagnosis) throw new AppError(400, 'VALIDATION_ERROR', 'Diagnosis is required');
  if (!data.items || data.items.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'At least one medicine is required');

  const template = await prisma.doctorTemplate.create({
    data: {
      doctor_id: doctor.id,
      template_name: data.template_name,
      diagnosis: data.diagnosis,
      advice: data.advice,
      items: {
        create: data.items.map((item, idx) => ({
          medicine_id: item.medicine_id || null,
          medicine_name: item.medicine_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          instructions: item.instructions,
          quantity: item.quantity ?? 1,
          sort_order: idx,
        })),
      },
    },
    include: { items: true },
  });

  return template;
}

export async function getTemplates(userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(403, 'FORBIDDEN', 'Only doctors can access templates');

  return prisma.doctorTemplate.findMany({
    where: { doctor_id: doctor.id },
    include: { items: { orderBy: { sort_order: 'asc' } } },
    orderBy: { template_name: 'asc' },
  });
}

export async function getTemplateById(templateId: string, userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(403, 'FORBIDDEN', 'Only doctors can access templates');

  const template = await prisma.doctorTemplate.findFirst({
    where: { id: templateId, doctor_id: doctor.id },
    include: { items: { orderBy: { sort_order: 'asc' } } },
  });

  if (!template) throw new AppError(404, 'NOT_FOUND', 'Template not found');

  return template;
}

export async function deleteTemplate(templateId: string, userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(403, 'FORBIDDEN', 'Only doctors can delete templates');

  const template = await prisma.doctorTemplate.findFirst({
    where: { id: templateId, doctor_id: doctor.id }
  });

  if (!template) throw new AppError(404, 'NOT_FOUND', 'Template not found');

  await prisma.doctorTemplate.delete({ where: { id: templateId } });
  return { success: true };
}
