import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { createPatientSchema, updatePatientSchema } from '@rxdesk/shared';
import * as service from './patient.service';
import { buildPaginatedResponse } from '../../utils/pagination';
import { NextFunction, Request, Response } from 'express';

const router = Router();

// GET /patients/me  (alias for /profile)
router.get('/me', requireRole('patient'), async (req, res, next) => {
  try {
    const profile = await service.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// GET /patients/me/appointments
router.get('/me/appointments', requireRole('patient'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await service.getProfile(req.user!.id);
    const { appointments, total, page, limit } = await service.getPatientAppointments(patient.id, req);
    res.json(buildPaginatedResponse(appointments, total, page, limit));
  } catch (err) { next(err); }
});

// GET /patients/profile
router.get('/profile', requireRole('patient', 'admin'), async (req, res, next) => {
  try {
    const profile = await service.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// POST /patients/profile
router.post('/profile', requireRole('patient'), async (req, res, next) => {
  try {
    const data = createPatientSchema.parse(req.body);
    const patient = await service.createOrUpdateProfile(req.user!.id, data);
    res.status(201).json({ success: true, data: patient, message: 'Profile created' });
  } catch (err) { next(err); }
});

// PUT /patients/profile  (mobile client uses PUT)
router.put('/profile', requireRole('patient'), async (req, res, next) => {
  try {
    const data = updatePatientSchema.parse(req.body);
    const patient = await service.createOrUpdateProfile(req.user!.id, data as Parameters<typeof service.createOrUpdateProfile>[1]);
    res.json({ success: true, data: patient, message: 'Profile updated' });
  } catch (err) { next(err); }
});

// PATCH /patients/profile
router.patch('/profile', requireRole('patient'), async (req, res, next) => {
  try {
    const data = updatePatientSchema.parse(req.body);
    const patient = await service.createOrUpdateProfile(req.user!.id, data as Parameters<typeof service.createOrUpdateProfile>[1]);
    res.json({ success: true, data: patient, message: 'Profile updated' });
  } catch (err) { next(err); }
});

// GET /patients/:id/appointments
router.get('/:id/appointments', requireRole('patient', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.id;
    const { appointments, total, page, limit } = await service.getPatientAppointments(patientId, req);
    res.json(buildPaginatedResponse(appointments, total, page, limit));
  } catch (err) { next(err); }
});

// DELETE /patients/account
router.delete('/account', requireRole('patient'), async (req, res, next) => {
  try {
    await service.deletePatientAccount(req.user!.id);
    res.json({ success: true, data: null, message: 'Account deleted' });
  } catch (err) { next(err); }
});

export default router;
