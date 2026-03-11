import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { bookAppointmentSchema, updateAppointmentStatusSchema } from '@rxdesk/shared';
import * as service from './appointment.service';

const router = Router();

// POST /appointments  — patient books
router.post('/', requireRole('patient'), async (req, res, next) => {
  try {
    const data = bookAppointmentSchema.parse(req.body);
    const appointment = await service.bookAppointment(req.user!.id, data);

    // Emit real-time event to shop via socket.io if available
    const io = req.app.get('io');
    if (io && appointment.chamber?.shop) {
      const shopId = (appointment.chamber as { shop?: { id?: string } }).shop?.id;
      if (shopId) io.to(`shop:${shopId}`).emit('appointment:new', appointment);
    }

    res.status(201).json({ success: true, data: appointment, message: 'Appointment booked successfully' });
  } catch (err) { next(err); }
});

// POST /appointments/walk-in  — shop books for a walk-in / existing patient
router.post('/walk-in', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const { chamber_id, appointment_date, slot_start_time, patient_phone, patient_name, chief_complaint } = req.body;
    if (!chamber_id || !appointment_date || !slot_start_time || !patient_phone) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'chamber_id, appointment_date, slot_start_time and patient_phone are required' } });
      return;
    }
    const appointment = await service.bookWalkInAppointment(req.user!.id, {
      chamber_id, appointment_date, slot_start_time, patient_phone, patient_name, chief_complaint,
    });
    const io = req.app.get('io');
    if (io) {
      const shopId = (appointment as any).chamber?.shop?.id;
      if (shopId) io.to(`shop:${shopId}`).emit('appointment:new', appointment);
    }
    res.status(201).json({ success: true, data: appointment, message: 'Walk-in appointment booked' });
  } catch (err) { next(err); }
});

// GET /appointments/today  — doctor or shop (optionally ?chamber_id=)
router.get('/today', requireRole('doctor', 'shop_owner'), async (req, res, next) => {
  try {
    if (req.user!.role === 'doctor') {
      const chamberId = req.query.chamber_id as string | undefined;
      const appointments = await service.getTodayAppointmentsForDoctor(req.user!.id, chamberId);
      res.json({ success: true, data: appointments });
    } else {
      const chamberId = req.query.chamber_id as string | undefined;
      const date = req.query.date as string | undefined;
      const appointments = await service.getTodayAppointmentsForShop(req.user!.id, chamberId, date);
      res.json({ success: true, data: appointments });
    }
  } catch (err) { next(err); }
});

// GET /appointments/history  — doctor appointment history with pagination
router.get('/history', requireRole('doctor'), async (req, res, next) => {
  try {
    const result = await service.getDoctorAppointmentHistory(req.user!.id, {
      chamber_id: req.query.chamber_id as string | undefined,
      status:     req.query.status as string | undefined,
      page:       req.query.page  ? Number(req.query.page)  : undefined,
      limit:      req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// GET /appointments/:id
router.get('/:id', requireRole('patient', 'doctor', 'shop_owner'), async (req, res, next) => {
  try {
    const appointment = await service.getAppointmentById(req.params.id, req.user!.id, req.user!.role);
    res.json({ success: true, data: appointment });
  } catch (err) { next(err); }
});

// PATCH /appointments/:id/status
router.patch('/:id/status', requireRole('patient', 'doctor', 'shop_owner'), async (req, res, next) => {
  try {
    const { status, cancel_reason } = updateAppointmentStatusSchema.parse(req.body);
    const appointment = await service.updateAppointmentStatus(
      req.params.id, req.user!.id, req.user!.role, status, cancel_reason
    );

    // Emit status change to the correct shop room
    const io = req.app.get('io');
    if (io) {
      const shopId = (appointment as any).chamber?.shop?.id;
      if (shopId) io.to(`shop:${shopId}`).emit('appointment:status_updated', { id: appointment.id, status });
    }

    res.json({ success: true, data: appointment });
  } catch (err) { next(err); }
});

export default router;
