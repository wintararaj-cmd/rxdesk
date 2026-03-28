import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import * as InsightsService from './insights.service';
import prisma from '../../config/database';

const router = Router();

/**
 * @route   GET /api/v1/inventory/insights/dead-stock
 * @desc    Get dead stock items (unsold for >3 months)
 * @access  Private (Shop Owner)
 */
router.get('/dead-stock', requireRole('shop_owner'), async (req: any, res, next) => {
  try {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) throw new Error('Shop not found');

    const deadStock = await InsightsService.getDeadStock(shop.id);
    res.json({
      success: true,
      data: deadStock,
    });
  } catch (err) { next(err); }
});

/**
 * @route   GET /api/v1/inventory/insights/predictive-orders
 * @desc    Get suggested medicine orders based on past 30-day run rate
 * @access  Private (Shop Owner)
 */
router.get('/predictive-orders', requireRole('shop_owner'), async (req: any, res, next) => {
  try {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) throw new Error('Shop not found');

    const suggestions = await InsightsService.getPredictiveOrderingDetails(shop.id);
    res.json({
      success: true,
      data: suggestions,
    });
  } catch (err) { next(err); }
});

/**
 * @route   GET /api/v1/inventory/insights/refill-reminders
 * @desc    Get upcoming medicine refill reminders for patients
 * @access  Private (Shop Owner)
 */
router.get('/refill-reminders', requireRole('shop_owner'), async (req: any, res, next) => {
  try {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) throw new Error('Shop not found');

    const reminders = await InsightsService.getRefillReminders(shop.id);
    res.json({
      success: true,
      data: reminders,
    });
  } catch (err) { next(err); }
});

export default router;
