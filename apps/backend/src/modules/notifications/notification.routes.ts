import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import prisma from '../../config/database';

const router = Router();

// GET /notifications
router.get('/', requireRole('patient', 'doctor', 'shop_owner'), async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user!.id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (err) { next(err); }
});

// PATCH /notifications/read-all  — must be BEFORE /:id/read to avoid id='read-all' match
router.patch('/read-all', requireRole('patient', 'doctor', 'shop_owner'), async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { user_id: req.user!.id, is_read: false },
      data: { is_read: true },
    });
    res.json({ success: true, data: null, message: 'All marked as read' });
  } catch (err) { next(err); }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', requireRole('patient', 'doctor', 'shop_owner'), async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, user_id: req.user!.id },
      data: { is_read: true },
    });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

export default router;
