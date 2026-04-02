import { Router } from 'express';
import { requireRole, authenticate } from '../../middleware/auth';
import { createDoctorSchema } from '@rxdesk/shared';
import * as service from './doctor.service';
import * as templateService from '../prescriptions/template.service';
import { buildPaginatedResponse } from '../../utils/pagination';
import { searchRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// GET /doctors/search  (public)
router.get('/search', searchRateLimiter, async (req, res, next) => {
  try {
    const { doctors, total, page, limit } = await service.searchDoctors(req);
    res.json(buildPaginatedResponse(doctors, total, page, limit));
  } catch (err) { next(err); }
});

// GET /doctors/me  (mobile uses this)
router.get('/me', requireRole('doctor'), async (req, res, next) => {
  try {
    const doctor = await service.getDoctorByUserId(req.user!.id);
    res.json({ success: true, data: doctor });
  } catch (err) { next(err); }
});

// GET /doctors/me/stats  (mobile uses this)
router.get('/me/stats', requireRole('doctor'), async (req, res, next) => {
  try {
    const stats = await service.getDoctorStats(req.user!.id);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// GET /doctors/profile  (authenticated doctor)
router.get('/profile', requireRole('doctor'), async (req, res, next) => {
  try {
    const doctor = await service.getDoctorByUserId(req.user!.id);
    res.json({ success: true, data: doctor });
  } catch (err) { next(err); }
});

// GET /doctors/dashboard/stats  (original path kept for compatibility)
router.get('/dashboard/stats', requireRole('doctor'), async (req, res, next) => {
  try {
    const stats = await service.getDoctorStats(req.user!.id);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// GET /doctors/me/earnings
router.get('/me/earnings', requireRole('doctor'), async (req, res, next) => {
  try {
    const earnings = await service.getDoctorEarnings(req.user!.id);
    res.json({ success: true, data: earnings });
  } catch (err) { next(err); }
});

// GET /doctors/me/templates
router.get('/me/templates', requireRole('doctor'), async (req, res, next) => {
  try {
    const templates = await templateService.getTemplates(req.user!.id);
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
});

// POST /doctors/me/templates
router.post('/me/templates', requireRole('doctor'), async (req, res, next) => {
  try {
    const template = await templateService.createTemplate(req.user!.id, req.body);
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
});

// DELETE /doctors/me/templates/:id
router.delete('/me/templates/:id', requireRole('doctor'), async (req, res, next) => {
  try {
    await templateService.deleteTemplate(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
});

// POST /doctors  (mobile setup-profile uses this)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = createDoctorSchema.parse(req.body);
    const doctor = await service.createDoctor(req.user!.id, data);
    res.status(201).json({ success: true, data: doctor, message: 'Doctor registered — pending admin approval' });
  } catch (err) { next(err); }
});

// POST /doctors/register  (original path kept for backward compat)
router.post('/register', authenticate, async (req, res, next) => {
  try {
    const data = createDoctorSchema.parse(req.body);
    const doctor = await service.createDoctor(req.user!.id, data);
    res.status(201).json({ success: true, data: doctor, message: 'Doctor registered — pending admin approval' });
  } catch (err) { next(err); }
});

// PUT /doctors/me  (mobile update profile)
router.put('/me', requireRole('doctor'), async (req, res, next) => {
  try {
    const doctor = await service.updateDoctor(req.user!.id, req.body);
    res.json({ success: true, data: doctor });
  } catch (err) { next(err); }
});

// GET /doctors/:id  (public)
router.get('/:id', async (req, res, next) => {
  try {
    const doctor = await service.getDoctorById(req.params.id);
    res.json({ success: true, data: doctor });
  } catch (err) { next(err); }
});

export default router;
