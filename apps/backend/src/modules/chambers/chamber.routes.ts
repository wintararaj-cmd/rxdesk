import { Router } from 'express';
import prisma from '../../config/database';
import { requireRole, authenticate } from '../../middleware/auth';
import { createChamberSchema, setScheduleSchema } from '@rxdesk/shared';
import * as service from './chamber.service';

const router = Router();

// GET /chambers/mine  (mobile client uses this)
router.get('/mine', requireRole('doctor'), async (req, res, next) => {
  try {
    const chambers = await service.getMyChambers(req.user!.id);
    res.json({ success: true, data: chambers });
  } catch (err) { next(err); }
});

// GET /chambers/shop-mine?status=pending  (shop sees their chambers / pending requests)
router.get('/shop-mine', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const chambers = await service.getShopChambers(req.user!.id, status);
    res.json({ success: true, data: chambers });
  } catch (err) { next(err); }
});

// GET /chambers/:id/slots?date=YYYY-MM-DD  (public)
router.get('/:id/slots', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'date is required' } }); return; }
    const slots = await service.getAvailableSlots(req.params.id, date as string);
    res.json({ success: true, data: { chamber_id: req.params.id, date, slots } });
  } catch (err) { next(err); }
});

// POST /chambers/shop-add-doctor  (shop owner links a doctor by MCI number)
router.post('/shop-add-doctor', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const { mci_number, consultation_fee } = req.body as { mci_number: string; consultation_fee?: number };
    if (!mci_number) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'mci_number is required' } });
      return;
    }
    const chamber = await service.linkDoctorByShop(req.user!.id, { mci_number, consultation_fee });
    res.status(201).json({ success: true, data: chamber, message: 'Doctor linked to your shop' });
  } catch (err) { next(err); }
});

// POST /chambers  (doctor creates chamber link with shop)
router.post('/', requireRole('doctor'), async (req, res, next) => {
  try {
    const data = createChamberSchema.parse(req.body);
    const chamber = await service.createChamber(req.user!.id, data);
    res.status(201).json({ success: true, data: chamber, message: 'Chamber link request sent to shop' });
  } catch (err) { next(err); }
});

// POST /chambers/:id/approve  (shop approves)
router.post('/:id/approve', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const chamber = await service.approveChamber(req.params.id, req.user!.id);
    res.json({ success: true, data: chamber, message: 'Chamber approved' });
  } catch (err) { next(err); }
});

// PUT /chambers/:id/schedule  (mobile uses PUT)
router.put('/:id/schedule', requireRole('doctor'), async (req, res, next) => {
  try {
    const schedules = setScheduleSchema.parse(req.body);
    const result = await service.setSchedule(req.params.id, req.user!.id, schedules);
    res.json({ success: true, data: result, message: 'Schedule updated' });
  } catch (err) { next(err); }
});

// POST /chambers/:id/schedule  (original path kept for compatibility)
router.post('/:id/schedule', requireRole('doctor'), async (req, res, next) => {
  try {
    const schedules = setScheduleSchema.parse(req.body);
    const result = await service.setSchedule(req.params.id, req.user!.id, schedules);
    res.json({ success: true, data: result, message: 'Schedule updated' });
  } catch (err) { next(err); }
});

// POST /chambers/:id/leave  (doctor marks leave)
router.post('/:id/leave', requireRole('doctor'), async (req, res, next) => {
  try {
    const { leave_date, reason } = req.body as { leave_date: string; reason?: string };
    const leave = await service.markLeave(req.params.id, req.user!.id, leave_date, reason);
    res.status(201).json({ success: true, data: leave, message: 'Leave marked' });
  } catch (err) { next(err); }
});

// PATCH /chambers/:id/fee  (shop updates consultation fee)
router.patch('/:id/fee', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const { consultation_fee } = req.body as { consultation_fee: number };
    if (typeof consultation_fee !== 'number' || consultation_fee < 0) {
      res.status(400).json({ success: false, error: { message: 'Invalid fee' } }); return;
    }
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) { res.status(404).json({ success: false, error: { message: 'Shop not found' } }); return; }
    const chamber = await prisma.chamber.findFirst({ where: { id: req.params.id, shop_id: shop.id } });
    if (!chamber) { res.status(404).json({ success: false, error: { message: 'Chamber not found' } }); return; }
    const updated = await prisma.chamber.update({ where: { id: req.params.id }, data: { consultation_fee } });
    res.json({ success: true, data: updated, message: 'Fee updated' });
  } catch (err) { next(err); }
});

export default router;
