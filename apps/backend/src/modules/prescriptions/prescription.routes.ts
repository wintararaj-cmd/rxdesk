import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { createPrescriptionSchema } from '@rxdesk/shared';
import * as service from './prescription.service';
import { pdfRateLimiter } from '../../middleware/rateLimit';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';

// ── Dev-mode in-memory PDF token cache (bypasses S3 when credentials are dummy) ──
const devPdfCache = new Map<string, { buffer: Buffer; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of devPdfCache) if (val.expiresAt < now) devPdfCache.delete(key);
}, 5 * 60 * 1000).unref();

const router = Router();

// POST /prescriptions  — doctor issues prescription
router.post('/', requireRole('doctor'), async (req, res, next) => {
  try {
    const data = createPrescriptionSchema.parse(req.body);
    const prescription = await service.createPrescription(req.user!.id, data);

    // Notify shop & patient via socket
    const io = req.app.get('io');
    if (io) io.to(`shop:${prescription.shop_id}`).emit('prescription.issued', { prescription });

    res.status(201).json({ success: true, data: prescription, message: 'Prescription issued' });
  } catch (err) { next(err); }
});

// GET /prescriptions/my  (mobile uses this, alias for patient/history)
router.get('/my', requireRole('patient'), async (req, res, next) => {
  try {
    const prescriptions = await service.getPatientPrescriptions(req.user!.id);
    res.json({ success: true, data: prescriptions });
  } catch (err) { next(err); }
});

// POST /prescriptions/verify  (shop scans QR content)
router.post('/verify', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const { qr_content } = req.body as { qr_content: string };
    if (!qr_content) { res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'qr_content is required' } }); return; }

    const { verifyPrescriptionQR } = await import('../../utils/qrSigner');
    const prescriptionId = verifyPrescriptionQR(qr_content);
    if (!prescriptionId) { res.status(400).json({ success: false, error: { code: 'INVALID_QR', message: 'QR code is invalid or has been tampered with' } }); return; }

    const result = await service.verifyPrescriptionForShop(prescriptionId, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /prescriptions/patient/history
router.get('/patient/history', requireRole('patient'), async (req, res, next) => {
  try {
    const prescriptions = await service.getPatientPrescriptions(req.user!.id);
    res.json({ success: true, data: prescriptions });
  } catch (err) { next(err); }
});

// GET /prescriptions/:id/verify  — shop scans QR
router.get('/:id/verify', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const result = await service.verifyPrescriptionForShop(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /prescriptions/pdf-stream/:token  — dev-only; streams a single-use cached PDF buffer
// IMPORTANT: must appear before /:id to avoid param capture
router.get('/pdf-stream/:token', async (req, res, next) => {
  try {
    const entry = devPdfCache.get(req.params.token);
    if (!entry || entry.expiresAt < Date.now()) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'PDF link expired or not found' } });
      return;
    }
    devPdfCache.delete(req.params.token); // single-use
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="prescription.pdf"');
    res.send(entry.buffer);
  } catch (err) { next(err); }
});

// GET /prescriptions/my-issued  — doctor lists their issued prescriptions
router.get('/my-issued', requireRole('doctor'), async (req, res, next) => {
  try {
    const prescriptions = await service.getDoctorPrescriptions(req.user!.id);
    res.json({ success: true, data: prescriptions });
  } catch (err) { next(err); }
});

// GET /prescriptions/:id  — view prescription
router.get('/:id', requireRole('patient', 'doctor', 'shop_owner', 'admin'), async (req, res, next) => {
  try {
    const prescription = await service.getPrescriptionById(req.params.id, req.user!.id, req.user!.role);
    res.json({ success: true, data: prescription });
  } catch (err) { next(err); }
});

// GET /prescriptions/:id/pdf  — generate PDF download URL
router.get('/:id/pdf', pdfRateLimiter, requireRole('patient', 'doctor', 'shop_owner'), async (req, res, next) => {
  try {
    const isDevS3 = !env.S3_BUCKET_NAME || env.AWS_ACCESS_KEY_ID === 'dev-placeholder';

    if (isDevS3) {
      // Dev mode: generate PDF with Puppeteer and cache it server-side; return a short-lived direct URL
      const prescription = await service.getPrescriptionById(req.params.id, req.user!.id, req.user!.role);
      const buffer = await service.generatePdfBuffer(prescription);
      const token = randomUUID();
      devPdfCache.set(token, { buffer, expiresAt: Date.now() + 15 * 60 * 1000 });
      // Use the same host the device used to reach this server (works for both emulator & LAN)
      const host = req.headers.host ?? 'localhost:3000';
      const url = `http://${host}/api/v1/prescriptions/pdf-stream/${token}`;
      res.json({ success: true, data: { url } });
      return;
    }

    const key = await service.generatePrescriptionPdf(req.params.id, req.user!.id, req.user!.role);
    const { getPresignedUrl } = await import('../../config/s3');
    const url = await getPresignedUrl(key);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

export default router;
