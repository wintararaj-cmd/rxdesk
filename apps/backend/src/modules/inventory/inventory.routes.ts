import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireRole } from '../../middleware/auth';
import { addInventoryItemSchema, updateInventorySchema } from '@rxdesk/shared';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import logger from '../../utils/logger';

const router = Router();

async function getShopByUser(userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
  return shop;
}

// GET /inventory/master (Hierarchical Rack System Level 1)
router.get('/master', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    
    // Using $queryRaw to perform efficient aggregation
    // This returns one row per medicine with total stock and nearest expiry
    const items = await prisma.$queryRaw<any[]>`
      SELECT 
        sm.id,
        sm.medicine_id,
        sm.medicine_name,
        sm.unit,
        sm.rack_location,
        sm.reorder_level,
        COALESCE(SUM(si.stock_qty), 0) as total_stock,
        MIN(CASE WHEN si.stock_qty > 0 THEN si.expiry_date ELSE NULL END) as nearest_expiry,
        MAX(si.mrp) as max_mrp,
        MIN(si.mrp) as min_mrp
      FROM shop_medicines sm
      LEFT JOIN shop_inventory si ON si.shop_medicine_id = sm.id
      WHERE sm.shop_id = ${shop.id}
      ${q ? Prisma.sql`AND sm.medicine_name ILIKE ${'%' + q + '%'}` : Prisma.empty}
      GROUP BY sm.id
      ORDER BY sm.medicine_name ASC
    `;

    // Process BigInt/Decimal issues from raw query if any
    const formatted = items.map(it => ({
      ...it,
      total_stock: Number(it.total_stock),
      max_mrp: Number(it.max_mrp),
      min_mrp: Number(it.min_mrp),
    }));

    res.json({ success: true, data: formatted });
  } catch (err) { next(err); }
});

// GET /inventory  — paginated
router.get('/', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const lowStock = req.query.low_stock === 'true';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (lowStock) {
      const items = await prisma.$queryRaw<unknown[]>`
        SELECT i.*, m.generic_name, m.form, m.strength
        FROM shop_inventory i
        LEFT JOIN medicines m ON m.id = i.medicine_id
        WHERE i.shop_id = ${shop.id}::uuid
          AND i.stock_qty <= i.reorder_level
        ORDER BY i.medicine_name ASC
      `;
      res.json({ success: true, data: items }); return;
    }

    const PAGE_SIZE = 50;
    const page = Math.max(1, req.query.page ? Number(req.query.page) : 1);
    const skip = (page - 1) * PAGE_SIZE;

    const where = {
      shop_id: shop.id,
      ...(q ? { medicine_name: { contains: q, mode: 'insensitive' as const } } : {}),
    };

    const [inventory, total] = await Promise.all([
      prisma.shopInventory.findMany({
        where,
        include: { medicine: { select: { generic_name: true, form: true, strength: true, gst_rate: true } } },
        orderBy: { medicine_name: 'asc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.shopInventory.count({ where }),
    ]);

    res.json({
      success: true,
      data: inventory,
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    });
  } catch (err) { next(err); }
});

// PATCH /inventory/master/:id - Update rack or reorder level
router.patch('/master/:id', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const id = req.params.id;
    const { rack_location, reorder_level } = req.body;

    const updated = await prisma.shopMedicine.update({
      where: { id, shop_id: shop.id },
      data: {
        ...(rack_location !== undefined ? { rack_location } : {}),
        ...(reorder_level !== undefined ? { reorder_level: Number(reorder_level) } : {}),
      }
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// GET /inventory/master/:id/batches
router.get('/master/:id/batches', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const id = req.params.id;
    const batches = await prisma.shopInventory.findMany({
      where: { shop_id: shop.id, shop_medicine_id: id },
      orderBy: { expiry_date: 'asc' },
    });
    res.json({ success: true, data: batches });
  } catch (err) { next(err); }
});

// GET /inventory/low-stock
router.get('/low-stock', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const items = await prisma.$queryRaw<{ id: string; medicine_name: string; stock_qty: number; reorder_level: number }[]>`
      SELECT id, medicine_name, stock_qty, reorder_level
      FROM shop_inventory
      WHERE shop_id = ${shop.id}::uuid
        AND stock_qty <= reorder_level
      ORDER BY stock_qty ASC
    `;
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

// GET /inventory/expiring  — items expiring within ?days (default 90)
router.get('/expiring', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const days = Math.max(1, Math.min(365, req.query.days ? Number(req.query.days) : 90));
    const now   = new Date();
    const cutoff = new Date(now.getTime() + days * 86_400_000);

    const items = await prisma.shopInventory.findMany({
      where: {
        shop_id: shop.id,
        expiry_date: { not: null, lte: cutoff },
        stock_qty: { gt: 0 },
      },
      orderBy: { expiry_date: 'asc' },
      select: {
        id: true,
        medicine_name: true,
        batch_number: true,
        expiry_date: true,
        stock_qty: true,
        mrp: true,
      },
    });

    // Fire-and-forget: create in-app notifications for items expiring in <=30 days
    const criticalItems = items.filter((i) => {
      if (!i.expiry_date) return false;
      const daysLeft = Math.ceil((i.expiry_date.getTime() - now.getTime()) / 86_400_000);
      return daysLeft <= 30 && daysLeft >= 0;
    });
    if (criticalItems.length > 0) {
      prisma.notification.createMany({
        data: criticalItems.map((i) => {
          const daysLeft = Math.ceil((i.expiry_date!.getTime() - now.getTime()) / 86_400_000);
          return {
            user_id: req.user!.id,
            title: 'Expiry Alert',
            body: `${i.medicine_name} (Batch: ${i.batch_number ?? 'N/A'}) expires in ${daysLeft} day(s). Qty: ${i.stock_qty}.`,
            type: 'push' as const,
            category: 'stock_alert' as const,
            reference_id: i.id,
            reference_type: 'inventory',
          };
        }),
        skipDuplicates: false,
      }).catch((e: Error) => logger.warn(`Expiry notification failed: ${e?.message}`));
    }

    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

// POST /inventory
router.post('/', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const data = addInventoryItemSchema.parse(req.body);
    
    // Ensure parent ShopMedicine exists
    const shopMed = await prisma.shopMedicine.upsert({
      where: {
        shop_id_medicine_name_unit: {
          shop_id: shop.id,
          medicine_name: data.medicine_name.trim(),
          unit: data.unit || 'strip',
        }
      },
      update: {
        rack_location: data.rack_location || undefined,
      },
      create: {
        shop_id: shop.id,
        medicine_name: data.medicine_name.trim(),
        unit: data.unit || 'strip',
        reorder_level: data.reorder_level || 10,
        rack_location: data.rack_location || undefined,
      }
    });

    const item = await prisma.shopInventory.create({
      data: {
        shop_id: shop.id,
        shop_medicine_id: shopMed.id,
        ...data,
        expiry_date: data.expiry_date ? new Date(data.expiry_date) : undefined,
      },
    });
    res.status(201).json({ success: true, data: item, message: 'Medicine added to inventory' });
  } catch (err) { next(err); }
});

// PATCH /inventory/:id  (also aliased as PUT for mobile client)
async function handleInventoryUpdate(req: any, res: any, next: any) {
  try {
    const shop = await getShopByUser(req.user!.id);
    const existing = await prisma.shopInventory.findFirst({ where: { id: req.params.id, shop_id: shop.id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');

    const data = updateInventorySchema.parse(req.body);
    const item = await prisma.shopInventory.update({
      where: { id: req.params.id },
      data: { ...data, expiry_date: data.expiry_date ? new Date(data.expiry_date) : undefined },
    });

    // ── Low-stock notification ───────────────────────────────────────────────
    if (item.stock_qty <= item.reorder_level) {
      prisma.notification.create({
        data: {
          user_id: req.user!.id,
          title: 'Low Stock Alert',
          body: `${item.medicine_name} is running low — only ${item.stock_qty} unit(s) left (reorder level: ${item.reorder_level}). Please restock soon.`,
          type: 'push',
          category: 'stock_alert',
          reference_id: item.id,
          reference_type: 'inventory',
        },
      }).catch((e: Error) => logger.warn(`Stock alert notification failed: ${e?.message}`));
    }

    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}
router.patch('/:id', requireRole('shop_owner'), handleInventoryUpdate);
router.put('/:id', requireRole('shop_owner'), handleInventoryUpdate);

// POST /inventory/import  — bulk import from JSON array
// Each row: { medicine_name, mrp, stock_qty?, purchase_price?, batch_number?, expiry_date?, gst_rate?, reorder_level?, unit? }
router.post('/import', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const rows: Record<string, unknown>[] = req.body.items;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'items array is required and must not be empty');
    }
    if (rows.length > 2000) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Maximum 2000 rows per import');
    }

    // ── Step 1: parse & validate all rows in-memory (no DB calls) ──────────
    type ParsedPayload = {
      shop_id: string;
      medicine_name: string;
      mrp: number;
      stock_qty: number;
      purchase_price?: number;
      batch_number?: string;
      gst_rate: number;
      reorder_level: number;
      unit: string;
      expiry_date?: Date;
      hsn_code?: string;
      discount_type?: 'percentage' | 'amount';
      discount_value?: number;
      rack_location?: string;
    };

    const errors: { row: number; error: string }[] = [];
    const valid: Array<ParsedPayload & { rowIndex: number }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const medicineName = String(row.medicine_name ?? row.name ?? row.medicine ?? '').trim();
      if (!medicineName) { errors.push({ row: i + 1, error: 'medicine_name is required' }); continue; }
      const mrp = Number(row.mrp);
      if (!mrp || isNaN(mrp) || mrp <= 0) { errors.push({ row: i + 1, error: 'mrp must be a positive number' }); continue; }

      // Map "percent" to "percentage" if present
      let dType = row.discount_type ? String(row.discount_type).toLowerCase().trim() : undefined;
      if (dType === 'percent') dType = 'percentage';

      const p: ParsedPayload = {
        shop_id:        shop.id,
        medicine_name:  medicineName,
        mrp,
        stock_qty:      Number(row.stock_qty ?? row.stock ?? row.quantity ?? 0),
        purchase_price: row.purchase_price != null ? Number(row.purchase_price) : undefined,
        batch_number:   row.batch_number   ? String(row.batch_number).trim() : undefined,
        gst_rate:       row.gst_rate       != null ? Number(row.gst_rate)    : 12,
        reorder_level:  row.reorder_level  != null ? Number(row.reorder_level) : 10,
        unit:           row.unit           ? String(row.unit).trim()          : 'strip',
        hsn_code:       row.hsn_code       ? String(row.hsn_code).trim()      : undefined,
        discount_type:  (dType === 'amount' || dType === 'percentage') ? (dType as any) : undefined,
        discount_value: row.discount_value != null ? Number(row.discount_value) : undefined,
        rack_location:  row.rack_location ? String(row.rack_location).trim() : undefined,
      };
      if (row.expiry_date) {
        const d = new Date(String(row.expiry_date));
        if (!isNaN(d.getTime())) p.expiry_date = d;
      }
      valid.push({ ...p, rowIndex: i });
    }

    // Look up key: "lower_name||unit"
    const uniqueMedicineKeys = [...new Set(valid.map(r => `${r.medicine_name.toLowerCase().trim()}||${r.unit.toLowerCase().trim()}`))];
    const shopMedMapping = new Map<string, string>();

    // Step 2: Ensure all parent ShopMedicine records exist
    await prisma.$transaction(async (tx) => {
      for (const key of uniqueMedicineKeys) {
        const [mName, unit] = key.split('||');
        const rowIndex = valid.find(r => r.medicine_name.toLowerCase().trim() === mName && r.unit.toLowerCase().trim() === unit);
        const reorderLevel = rowIndex?.reorder_level ?? 10;
        const rackLocation = rowIndex?.rack_location;

        const sm = await tx.shopMedicine.upsert({
          where: {
            shop_id_medicine_name_unit: {
              shop_id: shop.id,
              medicine_name: mName.toUpperCase(), // Normalize for mapping if needed, but match input mostly
              unit: unit,
            }
          },
          update: {
            rack_location: rackLocation || undefined,
          },
          create: {
            shop_id: shop.id,
            medicine_name: mName.toUpperCase(),
            unit: unit,
            reorder_level: reorderLevel,
            rack_location: rackLocation || undefined,
          }
        });
        shopMedMapping.set(key, sm.id);
      }
    });

    // Step 3: Single bulk-fetch of all possibly-matching existing inventory batches
    const uniqueNames = [...new Set(valid.map((r) => r.medicine_name.toLowerCase()))];
    const existing = await prisma.shopInventory.findMany({
      where: {
        shop_id:       shop.id,
        medicine_name: { in: uniqueNames, mode: 'insensitive' },
      },
      select: { id: true, medicine_name: true, batch_number: true, unit: true },
    });

    // Lookup key: "lower_name||unit||batch_or_empty"
    const existingMap = new Map<string, string>(
      existing.map((e) => [`${e.medicine_name.toLowerCase().trim()}||${e.unit.toLowerCase().trim()}||${e.batch_number ?? ''}`, e.id])
    );

    // Step 4: Classify each row as insert or update
    const toInsert: any[] = [];
    const toUpdate: Array<{ id: string; data: any }> = [];

    for (const r of valid) {
      const medKey = `${r.medicine_name.toLowerCase().trim()}||${r.unit.toLowerCase().trim()}`;
      const batchKey = `${medKey}||${r.batch_number ?? ''}`;
      
      const shopMedId = shopMedMapping.get(medKey);
      const existingId = existingMap.get(batchKey);
      
      const updateData = {
        mrp:            r.mrp,
        stock_qty:      r.stock_qty,
        purchase_price: r.purchase_price,
        gst_rate:       r.gst_rate,
        reorder_level:  r.reorder_level,
        unit:           r.unit,
        expiry_date:    r.expiry_date,
        hsn_code:       r.hsn_code,
        discount_type:  r.discount_type,
        discount_value: r.discount_value,
        shop_medicine_id: shopMedId,
      };

      if (existingId) {
        toUpdate.push({ id: existingId, data: updateData });
      } else {
        toInsert.push({
          shop_id:        r.shop_id,
          medicine_name:  r.medicine_name,
          batch_number:   r.batch_number,
          ...updateData,
        });
      }
    }

    // Step 5: Execute as a transaction
    await prisma.$transaction(
      async (tx) => {
        if (toInsert.length > 0) {
          await tx.shopInventory.createMany({ data: toInsert, skipDuplicates: true });
        }
        const CHUNK = 100;
        for (let i = 0; i < toUpdate.length; i += CHUNK) {
          await Promise.all(
            toUpdate.slice(i, i + CHUNK).map(({ id, data }) =>
              tx.shopInventory.update({ where: { id }, data })
            )
          );
        }
      },
      { timeout: 90_000 }
    );

    const result = { inserted: toInsert.length, updated: toUpdate.length, errors };
    logger.info(`Bulk import rack-system shop=${shop.id}: +${result.inserted} inserted, ~${result.updated} updated, ${result.errors.length} errors`);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// DELETE /inventory/:id
router.delete('/:id', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const existing = await prisma.shopInventory.findFirst({ where: { id: req.params.id, shop_id: shop.id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');
    await prisma.shopInventory.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null, message: 'Item removed' });
  } catch (err) { next(err); }
});

export default router;
