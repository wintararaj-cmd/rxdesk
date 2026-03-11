import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import prisma from '../../config/database';

const router = Router();

// GET /admin/doctors/pending
router.get('/doctors/pending', requireRole('admin'), async (_req, res, next) => {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { verification_status: 'pending' },
      include: { user: { select: { phone: true, created_at: true } } },
      orderBy: { created_at: 'asc' },
    });
    res.json({ success: true, data: doctors });
  } catch (err) { next(err); }
});

// PATCH /admin/doctors/:id/verify
router.patch('/doctors/:id/verify', requireRole('admin'), async (req, res, next) => {
  try {
    const { status, rejection_reason } = req.body as { status: 'approved' | 'rejected'; rejection_reason?: string };
    const doctor = await prisma.doctor.update({
      where: { id: req.params.id },
      data: {
        verification_status: status,
        rejection_reason: status === 'rejected' ? rejection_reason : null,
        verified_by: req.user!.id,
        verified_at: new Date(),
      },
    });
    // Also mark user as verified if approved
    if (status === 'approved') {
      await prisma.user.update({ where: { id: doctor.user_id }, data: { is_verified: true } });
    }
    res.json({ success: true, data: doctor });
  } catch (err) { next(err); }
});

// GET /admin/shops/pending
router.get('/shops/pending', requireRole('admin'), async (_req, res, next) => {
  try {
    const shops = await prisma.medicalShop.findMany({
      where: { verification_status: 'pending' },
      include: { owner: { select: { phone: true } } },
      orderBy: { created_at: 'asc' },
    });
    res.json({ success: true, data: shops });
  } catch (err) { next(err); }
});

// PATCH /admin/shops/:id/verify
router.patch('/shops/:id/verify', requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.body as { status: 'approved' | 'rejected' };
    const shop = await prisma.medicalShop.update({
      where: { id: req.params.id },
      data: { verification_status: status },
    });
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
});

// GET /admin/doctors?status=pending|approved|rejected  (all if omitted)
router.get('/doctors', requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const doctors = await prisma.doctor.findMany({
      where: status ? { verification_status: status as any } : undefined,
      include: { user: { select: { phone: true, created_at: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: doctors });
  } catch (err) { next(err); }
});

// GET /admin/shops?status=pending|approved|rejected  (all if omitted)
router.get('/shops', requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const shops = await prisma.medicalShop.findMany({
      where: status ? { verification_status: status as any } : undefined,
      include: { owner: { select: { phone: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: shops });
  } catch (err) { next(err); }
});

// GET /admin/users?role=patient|doctor|shop_owner  (all if omitted)
router.get('/users', requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.query as { role?: string };
    const users = await prisma.user.findMany({
      where: role ? { role: role as any } : undefined,
      select: { id: true, phone: true, role: true, is_verified: true, is_active: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// GET /admin/analytics
router.get('/analytics', requireRole('admin'), async (_req, res, next) => {
  try {
    const [totalDoctors, pendingDoctors, totalShops, pendingShops, totalPatients, totalAppointments] =
      await Promise.all([
        prisma.doctor.count(),
        prisma.doctor.count({ where: { verification_status: 'pending' } }),
        prisma.medicalShop.count(),
        prisma.medicalShop.count({ where: { verification_status: 'pending' } }),
        prisma.patient.count(),
        prisma.appointment.count(),
      ]);

    res.json({
      success: true,
      data: {
        doctors: { total: totalDoctors, pending: pendingDoctors },
        shops: { total: totalShops, pending: pendingShops },
        patients: { total: totalPatients },
        appointments: { total: totalAppointments },
      },
    });
  } catch (err) { next(err); }
});

export default router;
