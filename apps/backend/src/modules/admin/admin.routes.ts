import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import prisma from '../../config/database';
import redis from '../../config/redis';

const router = Router();

// â”€â”€â”€ Doctors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

router.patch('/doctors/:id/verify', requireRole('admin'), async (req, res, next) => {
  try {
    const { status, rejection_reason } = req.body as { status: 'approved' | 'rejected'; rejection_reason?: string };
    const doctor = await prisma.doctor.update({
      where: { id: req.params.id },
      data: { verification_status: status, rejection_reason: status === 'rejected' ? rejection_reason : null, verified_by: req.user!.id, verified_at: new Date() },
    });
    if (status === 'approved') {
      await prisma.user.update({ where: { id: doctor.user_id }, data: { is_verified: true } });
    }
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: `doctor_${status}`, target_type: 'doctor', target_id: req.params.id, notes: rejection_reason } }).catch(() => {});
    res.json({ success: true, data: doctor });
  } catch (err) { next(err); }
});

// GET /admin/doctors?status=&q=
router.get('/doctors', requireRole('admin'), async (req, res, next) => {
  try {
    const { status, q } = req.query as { status?: string; q?: string };
    const doctors = await prisma.doctor.findMany({
      where: {
        ...(status ? { verification_status: status as any } : {}),
        ...(q ? { OR: [{ full_name: { contains: q, mode: 'insensitive' } }, { user: { phone: { contains: q } } }] } : {}),
      },
      include: { user: { select: { phone: true, created_at: true, is_active: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: doctors });
  } catch (err) { next(err); }
});

// POST /admin/doctors/bulk-action
router.post('/doctors/bulk-action', requireRole('admin'), async (req, res, next) => {
  try {
    const { ids, status } = req.body as { ids: string[]; status: 'approved' | 'rejected' };
    if (!ids?.length) return res.status(400).json({ success: false, error: 'ids required' });
    const result = await prisma.doctor.updateMany({ where: { id: { in: ids } }, data: { verification_status: status, verified_by: req.user!.id, verified_at: new Date() } });
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: `bulk_doctor_${status}`, target_type: 'doctor', target_id: ids.join(','), notes: `${ids.length} doctors` } }).catch(() => {});
    res.json({ success: true, data: { updated: result.count } });
  } catch (err) { next(err); }
});

// â”€â”€â”€ Shops â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

router.patch('/shops/:id/verify', requireRole('admin'), async (req, res, next) => {
  try {
    const { status, rejection_reason } = req.body as { status: 'approved' | 'rejected'; rejection_reason?: string };
    const shop = await prisma.medicalShop.update({ where: { id: req.params.id }, data: { verification_status: status } });
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: `shop_${status}`, target_type: 'shop', target_id: req.params.id, notes: rejection_reason } }).catch(() => {});
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
});

// GET /admin/shops?status=&q=
router.get('/shops', requireRole('admin'), async (req, res, next) => {
  try {
    const { status, q } = req.query as { status?: string; q?: string };
    const shops = await prisma.medicalShop.findMany({
      where: {
        ...(status ? { verification_status: status as any } : {}),
        ...(q ? { OR: [{ shop_name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }, { owner: { phone: { contains: q } } }] } : {}),
      },
      include: { owner: { select: { phone: true } }, subscriptions: { include: { plan: true }, take: 1, orderBy: { created_at: 'desc' } } },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: shops });
  } catch (err) { next(err); }
});

// GET /admin/shops/:id â€” full shop detail
router.get('/shops/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const shop = await prisma.medicalShop.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { phone: true, created_at: true, is_active: true } },
        subscriptions: { include: { plan: true }, take: 1, orderBy: { created_at: 'desc' } },
        _count: { select: { purchase_entries: true, suppliers: true } },
      },
    });
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
});

// POST /admin/shops/bulk-action
router.post('/shops/bulk-action', requireRole('admin'), async (req, res, next) => {
  try {
    const { ids, status } = req.body as { ids: string[]; status: 'approved' | 'rejected' };
    if (!ids?.length) return res.status(400).json({ success: false, error: 'ids required' });
    const result = await prisma.medicalShop.updateMany({ where: { id: { in: ids } }, data: { verification_status: status } });
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: `bulk_shop_${status}`, target_type: 'shop', target_id: ids.join(','), notes: `${ids.length} shops` } }).catch(() => {});
    res.json({ success: true, data: { updated: result.count } });
  } catch (err) { next(err); }
});

// POST /admin/shops/:id/recharge
router.post('/shops/:id/recharge', requireRole('admin'), async (req, res, next) => {
  try {
    const { plan_id, months } = req.body as { plan_id: string; months: number };
    const shopId = req.params.id;
    if (!plan_id || !months) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'plan_id and months are required' } });
    let sub = await prisma.shopSubscription.findFirst({ where: { shop_id: shopId } });
    const rechargeMs = months * 30 * 24 * 60 * 60 * 1000;
    const now = new Date();
    if (sub) {
      let currentEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : now.getTime();
      if (currentEnd < now.getTime()) currentEnd = now.getTime();
      sub = await prisma.shopSubscription.update({ where: { id: sub.id }, data: { plan_id, status: 'active', current_period_end: new Date(currentEnd + rechargeMs), current_period_start: sub.current_period_start ?? now } });
    } else {
      sub = await prisma.shopSubscription.create({ data: { shop_id: shopId, plan_id, status: 'active', current_period_start: now, current_period_end: new Date(now.getTime() + rechargeMs) } });
    }
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: 'shop_recharge', target_type: 'shop', target_id: shopId, notes: `Plan: ${plan_id}, ${months} months` } }).catch(() => {});
    res.json({ success: true, data: sub, message: `Recharged shop successfully for ${months} month(s)` });
  } catch (err) { next(err); }
});

// â”€â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /admin/users/export-csv   (must be BEFORE /users/:id)
router.get('/users/export-csv', requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.query as { role?: string };
    const users = await prisma.user.findMany({
      where: role ? { role: role as any } : undefined,
      select: { id: true, phone: true, role: true, is_verified: true, is_active: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    const header = 'id,phone,role,is_verified,is_active,joined';
    const rows = users.map(u => `${u.id},${u.phone},${u.role},${u.is_verified},${u.is_active},${u.created_at.toISOString()}`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users_${role ?? 'all'}.csv`);
    res.send([header, ...rows].join('\n'));
  } catch (err) { next(err); }
});

// GET /admin/users?role=&q=
router.get('/users', requireRole('admin'), async (req, res, next) => {
  try {
    const { role, q } = req.query as { role?: string; q?: string };
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as any } : {}),
        ...(q ? { phone: { contains: q } } : {}),
      },
      select: { id: true, phone: true, role: true, is_verified: true, is_active: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 300,
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// PATCH /admin/users/:id/toggle-active
router.patch('/users/:id/toggle-active', requireRole('admin'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { is_active: !user.is_active } });
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: updated.is_active ? 'user_activated' : 'user_deactivated', target_type: 'user', target_id: req.params.id } }).catch(() => {});
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/analytics', requireRole('admin'), async (_req, res, next) => {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [totalDoctors, pendingDoctors, totalShops, pendingShops, totalPatients, totalAppointments, newShopsThisMonth, newUsersThisMonth, activeSubscriptions, expiredSubscriptions] = await Promise.all([
      prisma.doctor.count(),
      prisma.doctor.count({ where: { verification_status: 'pending' } }),
      prisma.medicalShop.count(),
      prisma.medicalShop.count({ where: { verification_status: 'pending' } }),
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.medicalShop.count({ where: { created_at: { gte: monthStart } } }),
      prisma.user.count({ where: { created_at: { gte: monthStart } } }),
      prisma.shopSubscription.count({ where: { status: 'active', current_period_end: { gte: today } } }),
      prisma.shopSubscription.count({ where: { OR: [{ status: 'expired' }, { current_period_end: { lt: today } }] } }),
    ]);
    res.json({
      success: true,
      data: {
        doctors: { total: totalDoctors, pending: pendingDoctors },
        shops: { total: totalShops, pending: pendingShops, new_this_month: newShopsThisMonth },
        patients: { total: totalPatients },
        appointments: { total: totalAppointments },
        users: { new_this_month: newUsersThisMonth },
        subscriptions: { active: activeSubscriptions, expired: expiredSubscriptions },
      },
    });
  } catch (err) { next(err); }
});

// â”€â”€â”€ Subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/subscriptions', requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const now = new Date();
    const where: any = {};
    if (status === 'active') { where.status = 'active'; where.current_period_end = { gte: now }; }
    else if (status === 'expired') { where.OR = [{ status: 'expired' }, { current_period_end: { lt: now } }]; }
    const subs = await prisma.shopSubscription.findMany({
      where,
      include: { shop: { select: { id: true, shop_name: true, city: true, owner: { select: { phone: true } } } }, plan: { select: { id: true, name: true, price_monthly: true } } },
      orderBy: { current_period_end: 'asc' },
    });
    res.json({ success: true, data: subs });
  } catch (err) { next(err); }
});

// â”€â”€â”€ Medicine Catalog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/medicine-catalog', requireRole('admin'), async (req, res, next) => {
  try {
    const { q, page = '1' } = req.query as { q?: string; page?: string };
    const PAGE_SIZE = 50;
    const skip = (Number(page) - 1) * PAGE_SIZE;
    const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' as any } }, { generic_name: { contains: q, mode: 'insensitive' as any } }, { manufacturer: { contains: q, mode: 'insensitive' as any } }] } : {};
    const [data, total] = await Promise.all([prisma.medicine.findMany({ where, skip, take: PAGE_SIZE, orderBy: { name: 'asc' } }), prisma.medicine.count({ where })]);
    res.json({ success: true, data, pagination: { total, page: Number(page), pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) } });
  } catch (err) { next(err); }
});

router.post('/medicine-catalog', requireRole('admin'), async (req, res, next) => {
  try {
    const med = await prisma.medicine.create({ data: req.body });
    res.status(201).json({ success: true, data: med });
  } catch (err) { next(err); }
});

router.put('/medicine-catalog/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const med = await prisma.medicine.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: med });
  } catch (err) { next(err); }
});

router.delete('/medicine-catalog/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.medicine.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// â”€â”€â”€ Activity Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/activity-log', requireRole('admin'), async (req, res, next) => {
  try {
    const { page = '1' } = req.query as { page?: string };
    const PAGE_SIZE = 50;
    const skip = (Number(page) - 1) * PAGE_SIZE;
    const [logs, total] = await Promise.all([
      prisma.adminActivityLog.findMany({ skip, take: PAGE_SIZE, orderBy: { created_at: 'desc' }, include: { admin: { select: { phone: true } } } }),
      prisma.adminActivityLog.count(),
    ]);
    res.json({ success: true, data: logs, pagination: { total, page: Number(page), totalPages: Math.ceil(total / PAGE_SIZE) } });
  } catch (err) { next(err); }
});

// â”€â”€â”€ Broadcast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/broadcast', requireRole('admin'), async (req, res, next) => {
  try {
    const { title, body, target_role } = req.body as { title: string; body: string; target_role?: string };
    if (!title || !body) return res.status(400).json({ success: false, error: 'title and body are required' });
    const users = await prisma.user.findMany({ where: { ...(target_role ? { role: target_role as any } : {}), is_active: true }, select: { id: true } });
    await prisma.notification.createMany({ data: users.map(u => ({ user_id: u.id, title, body, type: 'push', category: 'general', is_read: false })), skipDuplicates: true });

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      if (target_role) {
        io.to(`role:${target_role}`).emit('new_notification');
      } else {
        io.emit('new_notification');
      }
    }
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: 'broadcast', target_type: 'all', target_id: target_role ?? 'all', notes: `"${title}" â†’ ${users.length} users` } }).catch(() => {});
    res.json({ success: true, data: { sent: users.length }, message: `Notification sent to ${users.length} users` });
  } catch (err) { next(err); }
});

// ─── Subscription Plans ───────────────────────────────────────────────────────

// GET /admin/plans — list all plans
router.get('/plans', requireRole('admin'), async (_req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price_monthly: 'asc' },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// POST /admin/plans — create a new plan
router.post('/plans', requireRole('admin'), async (req, res, next) => {
  try {
    const { 
      name, price_monthly, price_quarterly, price_halfyearly, price_yearly,
      max_doctors, max_appointments_per_month, max_sessions, features 
    } = req.body;
    if (!name || price_monthly === undefined) {
      return res.status(400).json({ success: false, error: { message: 'name and price_monthly are required' } });
    }
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price_monthly: parseFloat(price_monthly),
        price_quarterly: price_quarterly ? parseFloat(price_quarterly) : null,
        price_halfyearly: price_halfyearly ? parseFloat(price_halfyearly) : null,
        price_yearly: price_yearly ? parseFloat(price_yearly) : null,
        max_doctors: parseInt(max_doctors ?? '1'),
        max_appointments_per_month: parseInt(max_appointments_per_month ?? '50'),
        max_sessions: parseInt(max_sessions ?? '2'),
        features: features ?? null,
        is_active: true,
      },
    });
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: 'plan_created', target_type: 'subscription_plan', target_id: plan.id, notes: name } }).catch(() => {});
    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// PATCH /admin/plans/:id — update plan fields
router.patch('/plans/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { 
      name, price_monthly, price_quarterly, price_halfyearly, price_yearly, 
      max_doctors, max_appointments_per_month, max_sessions, features, is_active 
    } = req.body;
    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(price_monthly !== undefined && { price_monthly: parseFloat(price_monthly) }),
        ...(price_quarterly !== undefined && { price_quarterly: price_quarterly ? parseFloat(price_quarterly) : null }),
        ...(price_halfyearly !== undefined && { price_halfyearly: price_halfyearly ? parseFloat(price_halfyearly) : null }),
        ...(price_yearly !== undefined && { price_yearly: price_yearly ? parseFloat(price_yearly) : null }),
        ...(max_doctors !== undefined && { max_doctors: parseInt(max_doctors) }),
        ...(max_appointments_per_month !== undefined && { max_appointments_per_month: parseInt(max_appointments_per_month) }),
        ...(max_sessions !== undefined && { max_sessions: parseInt(max_sessions) }),
        ...(features !== undefined && { features }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    await prisma.adminActivityLog.create({ data: { admin_id: req.user!.id, action: 'plan_updated', target_type: 'subscription_plan', target_id: plan.id, notes: plan.name } }).catch(() => {});
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

router.post('/sessions/flush', requireRole('admin'), async (_req, res, next) => {
  try {
    const keys = await redis.keys('refresh:*');
    const deleted = keys.length ? await redis.del(...keys) : 0;
    res.json({ success: true, data: { deleted }, message: `Cleared ${deleted} active session(s)` });
  } catch (err) { next(err); }
});

// ─── Recharges ────────────────────────────────────────────────────────────────

router.get('/recharges/report', requireRole('admin'), async (_req, res, next) => {
  try {
    const payments = await prisma.subscriptionPayment.findMany({
      include: {
        shop: { select: { shop_name: true, contact_phone: true } },
        plan: { select: { name: true } }
      },
      orderBy: { created_at: 'desc' },
    });
    
    const summary = await prisma.subscriptionPayment.aggregate({
      _sum: { amount: true },
      _count: { id: true }
    });

    res.json({ 
      success: true, 
      data: {
        payments,
        total_collected: summary._sum.amount || 0,
        total_count: summary._count.id
      }
    });
  } catch (err) { next(err); }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

// GET /admin/audit-logs?action=&shop_id=&actor_role=&from=&to=&page=
// Must be before /audit-logs/export-csv to prevent param capture issues
router.get('/audit-logs/export-csv', requireRole('admin'), async (req, res, next) => {
  try {
    const { action, shop_id, actor_role, from, to } = req.query as Record<string, string | undefined>;
    const where: any = {
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(shop_id && { shop_id }),
      ...(actor_role && { actor_role }),
      ...((from || to) && { created_at: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 10000,
      include: { user: { select: { phone: true } }, shop: { select: { shop_name: true } } },
    });
    const header = 'timestamp,action,actor_phone,actor_role,shop,resource,resource_id,ip,metadata';
    const rows = logs.map(l =>
      [
        l.created_at.toISOString(),
        l.action,
        l.user?.phone ?? '',
        l.actor_role ?? '',
        l.shop?.shop_name ?? '',
        l.resource ?? '',
        l.resource_id ?? '',
        l.ip_address ?? '',
        JSON.stringify(l.metadata ?? {}),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send([header, ...rows].join('\n'));
  } catch (err) { next(err); }
});

router.get('/audit-logs', requireRole('admin'), async (req, res, next) => {
  try {
    const { action, shop_id, actor_role, from, to, page = '1' } = req.query as Record<string, string | undefined>;
    const PAGE_SIZE = 50;
    const skip = (Number(page) - 1) * PAGE_SIZE;
    const where: any = {
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(shop_id && { shop_id }),
      ...(actor_role && { actor_role }),
      ...((from || to) && { created_at: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: PAGE_SIZE,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { phone: true, role: true } },
          shop: { select: { shop_name: true, city: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, data: logs, pagination: { total, page: Number(page), totalPages: Math.ceil(total / PAGE_SIZE) } });
  } catch (err) { next(err); }
});

export default router;



