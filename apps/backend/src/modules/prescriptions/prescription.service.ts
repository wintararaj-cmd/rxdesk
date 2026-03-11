import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { signPrescriptionQR } from '../../utils/qrSigner';
import { PrescriptionItemInput, VitalsData } from '@rxdesk/shared';
import logger from '../../utils/logger';
import { uploadToS3 } from '../../config/s3';

export async function createPrescription(
  userId: string,
  data: {
    appointment_id: string;
    diagnosis: string;
    chief_complaint?: string;
    vitals?: VitalsData;
    items: PrescriptionItemInput[];
    advice?: string;
    follow_up_date?: string;
  }
) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(403, 'FORBIDDEN', 'Only doctors can create prescriptions');

  const appointment = await prisma.appointment.findUnique({
    where: { id: data.appointment_id },
    include: { chamber: { include: { shop: true } }, prescription: { select: { id: true } } },
  });
  if (!appointment) throw new AppError(404, 'NOT_FOUND', 'Appointment not found');
  if (appointment.prescription) throw new AppError(409, 'DUPLICATE_BOOKING', 'Prescription already issued for this appointment');

  // Validate doctor owns this appointment
  const chamber = await prisma.doctorChamber.findUnique({ where: { id: appointment.chamber_id } });
  if (chamber?.doctor_id !== doctor.id) throw new AppError(403, 'FORBIDDEN', 'Not your patient');

  const prescription = await prisma.prescription.create({
    data: {
      appointment_id: data.appointment_id,
      doctor_id: doctor.id,
      patient_id: appointment.patient_id,
      shop_id: appointment.chamber.shop.id,
      diagnosis: data.diagnosis,
      chief_complaint: data.chief_complaint,
      vitals: data.vitals as never,
      advice: data.advice,
      follow_up_date: data.follow_up_date ? new Date(data.follow_up_date) : undefined,
      items: {
        create: data.items.map((item, idx) => ({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          instructions: item.instructions,
          quantity: item.quantity,
          sort_order: idx,
        })),
      },
    },
    include: {
      items: true,
      doctor: { select: { full_name: true, specialization: true, qualifications: true } },
      patient: { select: { full_name: true, age: true, gender: true } },
      shop: { select: { shop_name: true, address_line: true, contact_phone: true } },
    },
  });

  // Sign QR code
  const qrHash = signPrescriptionQR(prescription.id, prescription.created_at);
  await prisma.prescription.update({ where: { id: prescription.id }, data: { qr_code_hash: qrHash } });

  // Mark appointment as completed
  await prisma.appointment.update({
    where: { id: data.appointment_id },
    data: { status: 'completed' },
  });

  // ── In-app notification: prescription issued → patient ───────────────────
  prisma.patient.findUnique({ where: { id: prescription.patient_id }, select: { user_id: true } })
    .then((p) => {
      if (!p) return;
      return prisma.notification.create({
        data: {
          user_id: p.user_id,
          title: 'Prescription Ready',
          body: `Dr. ${prescription.doctor.full_name} has issued a prescription for ${data.diagnosis}. Open the Prescriptions tab to view and download your PDF.`,
          type: 'push',
          category: 'prescription_ready',
          reference_id: prescription.id,
          reference_type: 'prescription',
        },
      });
    })
    .catch((e) => logger.warn(`Prescription notification failed: ${e?.message}`));

  logger.info(`Prescription issued: ${prescription.id} by doctor ${doctor.id}`);
  return { ...prescription, qr_code_hash: qrHash };
}

export async function getPrescriptionById(prescriptionId: string, userId: string, role: string) {
  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: {
      items: { orderBy: { sort_order: 'asc' } },
      doctor: { select: { full_name: true, specialization: true, qualifications: true, mci_number: true } },
      patient: { select: { full_name: true, age: true, gender: true, blood_group: true } },
      shop:   { select: { shop_name: true, address_line: true, city: true, contact_phone: true } },
      appointment: { select: { appointment_date: true, slot_start_time: true } },
    },
  });
  if (!prescription) throw new AppError(404, 'NOT_FOUND', 'Prescription not found');

  // Access control
  if (role === 'patient') {
    const patient = await prisma.patient.findUnique({ where: { user_id: userId } });
    if (prescription.patient_id !== patient?.id) throw new AppError(403, 'FORBIDDEN', 'Not your prescription');
  } else if (role === 'doctor') {
    const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
    if (prescription.doctor_id !== doctor?.id) throw new AppError(403, 'FORBIDDEN', 'Not your prescription');
  } else if (role === 'shop_owner') {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
    if (prescription.shop_id !== shop?.id) throw new AppError(403, 'FORBIDDEN', 'Not your shop prescription');
  }

  return prescription;
}

export async function getPatientPrescriptions(userId: string) {
  const patient = await prisma.patient.findUnique({ where: { user_id: userId } });
  if (!patient) throw new AppError(404, 'NOT_FOUND', 'Patient not found');

  return prisma.prescription.findMany({
    where: { patient_id: patient.id },
    include: {
      items: { orderBy: { sort_order: 'asc' } },
      doctor: { select: { full_name: true, specialization: true } },
      shop:   { select: { shop_name: true, city: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getDoctorPrescriptions(userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { user_id: userId } });
  if (!doctor) throw new AppError(404, 'NOT_FOUND', 'Doctor not found');

  return prisma.prescription.findMany({
    where: { doctor_id: doctor.id },
    include: {
      items: { orderBy: { sort_order: 'asc' } },
      patient: { select: { full_name: true, age: true, gender: true } },
      shop:    { select: { shop_name: true, city: true } },
      appointment: { select: { appointment_date: true, slot_start_time: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
}


export async function verifyPrescriptionForShop(prescriptionId: string, userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can verify prescriptions');

  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: {
      items: { orderBy: { sort_order: 'asc' } },
      patient: { select: { full_name: true, age: true } },
      doctor: { select: { full_name: true, specialization: true } },
    },
  });
  if (!prescription) throw new AppError(404, 'NOT_FOUND', 'Prescription not found');
  if (!prescription.is_valid) throw new AppError(409, 'PRESCRIPTION_DISPENSED', 'This prescription has been invalidated');

  return {
    valid: true,
    already_dispensed: prescription.dispensed,
    prescription,
  };
}

function buildPrescriptionHtml(rx: Awaited<ReturnType<typeof getPrescriptionById>>): string {
  const date = rx.appointment
    ? new Date(rx.appointment.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(rx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const itemRows = rx.items.map((item) => `
    <tr>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#111">${item.medicine_name}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;color:#444">${item.dosage}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;color:#444">${item.frequency}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;color:#444">${item.duration ?? '—'}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;color:#666;font-size:12px">${item.instructions ?? ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 14px; color: #222; padding: 32px; }
    .header { border-bottom: 3px solid #0EA5E9; padding-bottom: 16px; margin-bottom: 20px; }
    .shop-name { font-size: 22px; font-weight: 700; color: #0EA5E9; }
    .shop-meta { font-size: 12px; color: #666; margin-top: 4px; }
    .rx-symbol { font-size: 36px; color: #0EA5E9; float: right; margin-top: -10px; }
    .meta-box { display: flex; gap: 32px; background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .meta-item label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
    .meta-item span { font-weight: 600; color: #111; }
    .section-title { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; font-size: 12px; color: #888; text-transform: uppercase; padding: 6px 4px; border-bottom: 2px solid #e5e7eb; }
    .advice-box { background: #eff6ff; border-left: 3px solid #0EA5E9; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 16px; font-size: 13px; color: #333; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 12px; color: #888; display: flex; justify-content: space-between; }
    .sign-area { text-align: right; }
    .sign-area .line { border-bottom: 1px solid #888; width: 160px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <span class="rx-symbol">&#x211E;</span>
    <div class="shop-name">${rx.shop.shop_name}</div>
    <div class="shop-meta">${rx.shop.address_line ?? ''}, ${(rx.shop as any).city ?? ''} &nbsp;|&nbsp; ${rx.shop.contact_phone ?? ''}</div>
  </div>

  <div class="meta-box">
    <div class="meta-item"><label>Patient</label><span>${rx.patient.full_name ?? '—'}</span></div>
    <div class="meta-item"><label>Age / Gender</label><span>${rx.patient.age ?? '—'} / ${rx.patient.gender ?? '—'}</span></div>
    <div class="meta-item"><label>Doctor</label><span>Dr. ${rx.doctor.full_name}</span></div>
    <div class="meta-item"><label>Specialization</label><span>${rx.doctor.specialization ?? '—'}</span></div>
    <div class="meta-item"><label>Date</label><span>${date}</span></div>
  </div>

  ${rx.diagnosis ? `<p class="section-title">Diagnosis</p><p style="margin-bottom:16px;font-weight:600">${rx.diagnosis}</p>` : ''}

  <p class="section-title">Medications</p>
  <table>
    <thead>
      <tr>
        <th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  ${rx.advice ? `<p class="section-title">Advice / Notes</p><div class="advice-box">${rx.advice}</div>` : ''}
  ${rx.follow_up_date ? `<p style="font-size:13px;color:#555;margin-bottom:12px">&#128197; Follow-up: ${new Date(rx.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : ''}

  <div class="footer">
    <div>Prescription ID: ${rx.id}</div>
    <div class="sign-area">
      <div class="line"></div>
      <div>Dr. ${rx.doctor.full_name}</div>
      <div style="color:#888;font-size:11px">${rx.doctor.specialization ?? ''}</div>
    </div>
  </div>
</body>
</html>`;
}

/** Runs Puppeteer to turn a prescription object into a PDF buffer (no S3 upload). */
export async function generatePdfBuffer(
  prescription: Awaited<ReturnType<typeof getPrescriptionById>>
): Promise<Buffer> {
  const html = buildPrescriptionHtml(prescription);
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function generatePrescriptionPdf(
  prescriptionId: string,
  userId: string,
  role: string
): Promise<string> {
  // Return cached URL if already generated
  const existing = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    select: { pdf_url: true },
  });
  if (existing?.pdf_url) return existing.pdf_url;

  const prescription = await getPrescriptionById(prescriptionId, userId, role);
  const html = buildPrescriptionHtml(prescription);

  // Dynamic import so puppeteer doesn't crash in test environments that don't need PDF
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      printBackground: true,
    });
    await browser.close();

    const key = `prescriptions/${prescriptionId}/prescription.pdf`;
    await uploadToS3(key, Buffer.from(pdfBuffer), 'application/pdf');

    await prisma.prescription.update({ where: { id: prescriptionId }, data: { pdf_url: key } });
    logger.info(`Prescription PDF generated: ${key}`);
    return key;
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}
