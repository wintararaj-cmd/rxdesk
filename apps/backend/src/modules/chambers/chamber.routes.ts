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
    const chamber = await prisma.doctorChamber.findFirst({ where: { id: req.params.id, shop_id: shop.id } });
    if (!chamber) { res.status(404).json({ success: false, error: { message: 'Chamber not found' } }); return; }
    const updated = await prisma.doctorChamber.update({ where: { id: req.params.id }, data: { consultation_fee } });
    res.json({ success: true, data: updated, message: 'Fee updated' });
  } catch (err) { next(err); }
});

// GET /chambers/:id/stats  (shop owner views doctor performance)
router.get('/:id/stats', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) { res.status(404).json({ success: false, error: { message: 'Shop not found' } }); return; }
    const chamber = await prisma.doctorChamber.findFirst({ where: { id: req.params.id, shop_id: shop.id } });
    if (!chamber) { res.status(404).json({ success: false, error: { message: 'Chamber not found' } }); return; }

    const now = new Date();
    const todayStart = new Date(now.toISOString().slice(0, 10));
    const todayEnd   = new Date(todayStart.getTime() + 86_400_000);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [todayCount, monthCount, allTime] = await Promise.all([
      prisma.appointment.count({
        where: { chamber_id: req.params.id, appointment_date: { gte: todayStart, lt: todayEnd }, status: { notIn: ['cancelled', 'no_show'] } },
      }),
      prisma.appointment.count({
        where: { chamber_id: req.params.id, appointment_date: { gte: monthStart, lt: monthEnd }, status: { notIn: ['cancelled', 'no_show'] } },
      }),
      prisma.appointment.count({
        where: { chamber_id: req.params.id, status: { notIn: ['cancelled', 'no_show'] } },
      }),
    ]);

    // Revenue = completed appointments × consultation_fee  (this month)
    const completedThisMonth = await prisma.appointment.count({
      where: { chamber_id: req.params.id, appointment_date: { gte: monthStart, lt: monthEnd }, status: 'completed' },
    });
    const fee = Number(chamber.consultation_fee);
    const monthRevenue = completedThisMonth * fee;

    res.json({
      success: true,
      data: {
        today_count: todayCount,
        month_count: monthCount,
        all_time_count: allTime,
        month_revenue: monthRevenue,
        consultation_fee: fee,
        completed_this_month: completedThisMonth,
      },
    });
  } catch (err) { next(err); }
});

// DELETE /chambers/:id  (shop deactivates / removes doctor link)
router.delete('/:id', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) { res.status(404).json({ success: false, error: { message: 'Shop not found' } }); return; }
    const chamber = await prisma.doctorChamber.findFirst({ where: { id: req.params.id, shop_id: shop.id } });
    if (!chamber) { res.status(404).json({ success: false, error: { message: 'Chamber not found' } }); return; }
    await prisma.doctorChamber.update({ where: { id: req.params.id }, data: { status: 'inactive' } });
    res.json({ success: true, data: null, message: 'Doctor removed from shop' });
  } catch (err) { next(err); }
});

export default router;
