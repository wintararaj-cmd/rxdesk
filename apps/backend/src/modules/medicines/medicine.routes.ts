import { Router } from 'express';
import { searchRateLimiter } from '../../middleware/rateLimit';
import prisma from '../../config/database';

const router = Router();

// GET /medicines?page=1&q=paracetamol  — paginated catalog list (shop_owner)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const PAGE_SIZE = 50;
    const page = Math.max(1, req.query.page ? Number(req.query.page) : 1);
    const skip = (page - 1) * PAGE_SIZE;

    const where = {
      is_active: true,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { generic_name: { contains: q, mode: 'insensitive' as const } },
          { brand_name: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [medicines, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        select: { id: true, name: true, generic_name: true, brand_name: true, form: true, strength: true, manufacturer: true, gst_rate: true, is_schedule_h: true, hsn_code: true },
        orderBy: { name: 'asc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.medicine.count({ where }),
    ]);

    res.json({
      success: true,
      data: medicines,
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    });
  } catch (err) { next(err); }
});

// GET /medicines/search?q=paracetamol
router.get('/search', searchRateLimiter, async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const medicines = await prisma.medicine.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { generic_name: { contains: q, mode: 'insensitive' } },
          { brand_name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 30,
      select: { id: true, name: true, generic_name: true, brand_name: true, form: true, strength: true, is_schedule_h: true },
    });
    res.json({ success: true, data: medicines });
  } catch (err) { next(err); }
});

// GET /medicines/availability?name=Crocin&pincode=411001
// Also accepts: ?medicine=Crocin&pin_code=411001  (mobile client format)
router.get('/availability', searchRateLimiter, async (req, res, next) => {
  try {
    const name = ((req.query.name ?? req.query.medicine) as string) || '';
    const pincode = (req.query.pincode ?? req.query.pin_code) as string | undefined;

    const inventory = await prisma.shopInventory.findMany({
      where: {
        medicine_name: { contains: name, mode: 'insensitive' },
        stock_qty: { gt: 0 },
        ...(pincode && { shop: { pin_code: pincode } }),
      },
      include: {
        shop: {
          select: { id: true, shop_name: true, address_line: true, city: true, pin_code: true, contact_phone: true, latitude: true, longitude: true },
        },
      },
      orderBy: { stock_qty: 'desc' },
      take: 20,
    });

    const result = inventory.map((i) => ({
      shop_name: i.shop.shop_name,
      shop_id: i.shop.id,
      address: i.shop.address_line,
      city: i.shop.city,
      contact: i.shop.contact_phone,
      latitude: i.shop.latitude,
      longitude: i.shop.longitude,
      stock_qty: i.stock_qty,
      mrp: i.mrp,
      unit: i.unit,
    }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /medicines/:id
router.get('/:id', async (req, res, next) => {
  try {
    const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id } });
    if (!medicine) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Medicine not found' } }); return; }
    res.json({ success: true, data: medicine });
  } catch (err) { next(err); }
});

export default router;
