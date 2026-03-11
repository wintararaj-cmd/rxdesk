import { Router } from 'express';
import { requireRole, authenticate } from '../../middleware/auth';
import { createShopSchema } from '@rxdesk/shared';
import * as service from './shop.service';

const router = Router();

// POST /shops  (mobile setup-profile uses this)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = createShopSchema.parse(req.body);
    const shop = await service.registerShop(req.user!.id, data);
    res.status(201).json({ success: true, data: shop, message: 'Shop registered — pending admin approval' });
  } catch (err) { next(err); }
});

// POST /shops/register  (original path kept for compatibility)
router.post('/register', authenticate, async (req, res, next) => {
  try {
    const data = createShopSchema.parse(req.body);
    const shop = await service.registerShop(req.user!.id, data);
    res.status(201).json({ success: true, data: shop, message: 'Shop registered — pending admin approval' });
  } catch (err) { next(err); }
});

// GET /shops/me  (mobile client uses this)
router.get('/me', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await service.getShopByOwnerId(req.user!.id);
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
});

// GET /shops/me/dashboard  (mobile client uses this)
router.get('/me/dashboard', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const data = await service.getTodayDashboard(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PUT /shops/me  (update shop profile)
router.put('/me', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await service.updateShop(req.user!.id, req.body);
    res.json({ success: true, data: shop, message: 'Shop profile updated' });
  } catch (err) { next(err); }
});

// PATCH /shops/me  (alias)
router.patch('/me', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await service.updateShop(req.user!.id, req.body);
    res.json({ success: true, data: shop, message: 'Shop profile updated' });
  } catch (err) { next(err); }
});

// GET /shops/me/analytics?days=30  (web dashboard reports)
router.get('/me/analytics', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10), 7), 90);
    const data = await service.getShopAnalytics(req.user!.id, days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /shops/profile  (kept for backward compatibility)
router.get('/profile', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await service.getShopByOwnerId(req.user!.id);
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
});

router.get('/dashboard/today', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const data = await service.getTodayDashboard(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/nearby', async (req, res, next) => {
  try {
    const shops = await service.getNearbyShops(req);
    res.json({ success: true, data: shops });
  } catch (err) { next(err); }
});

// GET /shops/search?q=&city=&pin_code=  (authenticated — used by doctors to find shops to link)
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, city, pin_code } = req.query as Record<string, string>;
    const shops = await service.searchShops(q, city, pin_code);
    res.json({ success: true, data: shops });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const shop = await service.getShopById(req.params.id);
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
});

export default router;
