import { Router } from 'express';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
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
        sm.hsn_code,
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

// GET /inventory/reports/batch-supplier — Detailed report for batch-wise and supplier-wise stock
router.get('/reports/batch-supplier', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    
    // We use a LATERAL JOIN (emulated via subquery in Postgres) to find the LATEST supplier for each batch.
    // If no purchase record exists (manual entry), supplier fields will be null.
    const items = await prisma.$queryRaw<any[]>`
      SELECT 
        si.id as inventory_id,
        si.medicine_name,
        si.batch_number,
        si.expiry_date,
        si.stock_qty,
        si.mrp,
        si.purchase_price,
        si.unit,
        sm.rack_location,
        sm.hsn_code,
        m.generic_name,
        latest_purchase.supplier_name,
        latest_purchase.invoice_number,
        latest_purchase.invoice_date
      FROM shop_inventory si
      LEFT JOIN shop_medicines sm ON si.shop_medicine_id = sm.id
      LEFT JOIN medicines m ON si.medicine_id = m.id
      LEFT JOIN LATERAL (
        SELECT s.name as supplier_name, pe.invoice_number, pe.invoice_date
        FROM purchase_items pi
        JOIN purchase_entries pe ON pi.purchase_id = pe.id
        LEFT JOIN suppliers s ON pe.supplier_id = s.id
        WHERE pi.medicine_name = si.medicine_name 
          AND pi.batch_number = si.batch_number
          AND pe.shop_id = si.shop_id
        ORDER BY pe.invoice_date DESC
        LIMIT 1
      ) latest_purchase ON true
      WHERE si.shop_id = ${shop.id}
        AND si.stock_qty > 0
        ${q ? Prisma.sql`AND si.medicine_name ILIKE ${'%' + q + '%'}` : Prisma.empty}
      ORDER BY si.medicine_name ASC, si.expiry_date ASC
    `;

    const formatted = items.map(it => ({
      ...it,
      stock_qty: Number(it.stock_qty),
      mrp: Number(it.mrp),
      purchase_price: Number(it.purchase_price || 0),
      total_purchase_value: Number(it.stock_qty) * Number(it.purchase_price || 0),
      total_mrp_value: Number(it.stock_qty) * Number(it.mrp),
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
      const items = await prisma.$queryRaw<any[]>`
        SELECT 
          sm.id,
          sm.medicine_name,
          COALESCE(SUM(si.stock_qty), 0) as stock_qty,
          sm.reorder_level,
          sm.rack_location
        FROM shop_medicines sm
        LEFT JOIN shop_inventory si ON si.shop_medicine_id = sm.id
        WHERE sm.shop_id = ${shop.id}
        GROUP BY sm.id, sm.medicine_name, sm.reorder_level, sm.rack_location
        HAVING COALESCE(SUM(si.stock_qty), 0) <= sm.reorder_level
        ORDER BY sm.medicine_name ASC
      `;
      // Convert BigInt
      const formatted = items.map(it => ({ ...it, stock_qty: Number(it.stock_qty) }));
      res.json({ success: true, data: formatted }); return;
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
        include: { 
          medicine: { select: { generic_name: true, form: true, strength: true, gst_rate: true } },
          shop_medicine: { select: { rack_location: true, reorder_level: true } }
        },
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
    const { rack_location, reorder_level, hsn_code } = req.body;

    const updated = await prisma.shopMedicine.update({
      where: { id, shop_id: shop.id },
      data: {
        ...(rack_location !== undefined ? { rack_location } : {}),
        ...(hsn_code !== undefined ? { hsn_code } : {}),
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

// GET /inventory/purchase-order-suggestions  — auto-generate purchase orders from low stock
router.get('/purchase-order-suggestions', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);

    // 1. Get all low-stock medicines (total stock <= reorder level)
    const lowStockItems = await prisma.$queryRaw<any[]>`
      SELECT 
        sm.id as shop_medicine_id,
        sm.medicine_name,
        sm.unit,
        sm.reorder_level,
        sm.hsn_code,
        COALESCE(SUM(si.stock_qty), 0) as current_stock,
        MAX(si.mrp) as last_mrp,
        MAX(si.purchase_price) as last_purchase_price
      FROM shop_medicines sm
      LEFT JOIN shop_inventory si ON si.shop_medicine_id = sm.id
      WHERE sm.shop_id = ${shop.id}
        AND sm.is_active = true
      GROUP BY sm.id, sm.medicine_name, sm.unit, sm.reorder_level, sm.hsn_code
      HAVING COALESCE(SUM(si.stock_qty), 0) <= sm.reorder_level
      ORDER BY COALESCE(SUM(si.stock_qty), 0) ASC
    `;

    if (lowStockItems.length === 0) {
      return res.json({ success: true, data: { suppliers: [], unassigned: [], total_items: 0 } });
    }

    // 2. For each low-stock item, find the last supplier from purchase history
    const medicineNames = lowStockItems.map(i => i.medicine_name);

    const supplierHistory = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON (pi.medicine_name)
        pi.medicine_name,
        s.id as supplier_id,
        s.name as supplier_name,
        s.phone as supplier_phone,
        s.city as supplier_city,
        pe.invoice_date as last_purchase_date,
        pi.purchase_price as last_purchase_price,
        pi.mrp as last_mrp,
        pi.quantity as last_order_qty
      FROM purchase_items pi
      JOIN purchase_entries pe ON pi.purchase_id = pe.id
      LEFT JOIN suppliers s ON pe.supplier_id = s.id
      WHERE pe.shop_id = ${shop.id}
        AND pi.medicine_name = ANY(${medicineNames}::text[])
        AND s.id IS NOT NULL
        AND s.is_active = true
      ORDER BY pi.medicine_name, pe.invoice_date DESC
    `;

    // Build lookup: medicine_name -> supplier info
    const supplierMap = new Map<string, any>();
    for (const sh of supplierHistory) {
      supplierMap.set(sh.medicine_name.toLowerCase(), sh);
    }

    // 3. Build order suggestions
    type OrderItem = {
      shop_medicine_id: string;
      medicine_name: string;
      unit: string;
      hsn_code: string | null;
      current_stock: number;
      reorder_level: number;
      suggested_qty: number;
      last_purchase_price: number | null;
      last_mrp: number | null;
      estimated_cost: number;
    };

    type SupplierGroup = {
      supplier_id: string;
      supplier_name: string;
      supplier_phone: string | null;
      supplier_city: string | null;
      items: OrderItem[];
      total_estimated_cost: number;
    };

    const supplierGroups = new Map<string, SupplierGroup>();
    const unassigned: OrderItem[] = [];

    for (const item of lowStockItems) {
      const currentStock = Number(item.current_stock);
      const reorderLevel = Number(item.reorder_level);
      // Suggest ordering at least 2x the reorder level minus current stock
      const suggestedQty = Math.max(reorderLevel * 2 - currentStock, reorderLevel);

      const history = supplierMap.get(item.medicine_name.toLowerCase());
      const purchasePrice = history ? Number(history.last_purchase_price) : (item.last_purchase_price ? Number(item.last_purchase_price) : null);
      const mrp = history ? Number(history.last_mrp) : (item.last_mrp ? Number(item.last_mrp) : null);

      const orderItem: OrderItem = {
        shop_medicine_id: item.shop_medicine_id,
        medicine_name: item.medicine_name,
        unit: item.unit || 'strip',
        hsn_code: item.hsn_code,
        current_stock: currentStock,
        reorder_level: reorderLevel,
        suggested_qty: suggestedQty,
        last_purchase_price: purchasePrice,
        last_mrp: mrp,
        estimated_cost: purchasePrice ? suggestedQty * purchasePrice : 0,
      };

      if (history?.supplier_id) {
        const sid = history.supplier_id;
        if (!supplierGroups.has(sid)) {
          supplierGroups.set(sid, {
            supplier_id: sid,
            supplier_name: history.supplier_name || 'Unknown',
            supplier_phone: history.supplier_phone,
            supplier_city: history.supplier_city,
            items: [],
            total_estimated_cost: 0,
          });
        }
        const group = supplierGroups.get(sid)!;
        group.items.push(orderItem);
        group.total_estimated_cost += orderItem.estimated_cost;
      } else {
        unassigned.push(orderItem);
      }
    }

    const suppliers = Array.from(supplierGroups.values())
      .sort((a, b) => b.items.length - a.items.length);

    res.json({
      success: true,
      data: {
        suppliers,
        unassigned,
        total_items: lowStockItems.length,
        total_estimated_cost: suppliers.reduce((s, g) => s + g.total_estimated_cost, 0) + unassigned.reduce((s, i) => s + i.estimated_cost, 0),
      },
    });
  } catch (err) { next(err); }
});

// GET /inventory/low-stock
router.get('/low-stock', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const items = await prisma.$queryRaw<any[]>`
      SELECT 
        sm.id,
        sm.medicine_name,
        COALESCE(SUM(si.stock_qty), 0) as stock_qty,
        sm.reorder_level
      FROM shop_medicines sm
      LEFT JOIN shop_inventory si ON si.shop_medicine_id = sm.id
      WHERE sm.shop_id = ${shop.id}
      GROUP BY sm.id, sm.medicine_name, sm.reorder_level
      HAVING COALESCE(SUM(si.stock_qty), 0) <= sm.reorder_level
      ORDER BY stock_qty ASC
    `;
    // Format BigInt from SUM
    const formatted = items.map(it => ({ ...it, stock_qty: Number(it.stock_qty) }));
    res.json({ success: true, data: formatted });
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

// GET /inventory/reports/expiry-excel
router.get('/reports/expiry-excel', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const days = Math.max(1, Math.min(365, req.query.days ? Number(req.query.days) : 90));
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 86_400_000);

    const items = await prisma.shopInventory.findMany({
      where: {
        shop_id: shop.id,
        expiry_date: { not: null, lte: cutoff },
        stock_qty: { gt: 0 },
      },
      orderBy: { expiry_date: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expiring Medicines');
    sheet.columns = [
      { header: 'Medicine Name', key: 'name', width: 35 },
      { header: 'Batch Number', key: 'batch', width: 15 },
      { header: 'Expiry Date', key: 'expiry', width: 15 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Days Left', key: 'days_left', width: 12 },
      { header: 'MRP (₹)', key: 'mrp', width: 12 },
    ];

    items.forEach((i) => {
      const expiry = i.expiry_date as Date;
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
      sheet.addRow({
        name: i.medicine_name,
        batch: i.batch_number,
        expiry: expiry.toISOString().split('T')[0],
        qty: i.stock_qty,
        unit: i.unit,
        days_left: daysLeft,
        mrp: Number(i.mrp),
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FFEFEFEF' } 
    };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expiring_Medicines_${days}days.xlsx`);
    res.send(buffer as any);
  } catch (err) { next(err); }
});

// POST /inventory
router.post('/', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await getShopByUser(req.user!.id);
    const data = addInventoryItemSchema.parse(req.body);
    
    // 1. If medicine_id is missing, try to link by name
    let medicine_id = data.medicine_id;
    let hsn = data.hsn_code;
    let gst = data.gst_rate;

    if (!medicine_id) {
      const globalMed = await prisma.medicine.findFirst({
        where: { name: { equals: data.medicine_name.trim(), mode: 'insensitive' } }
      });
      if (globalMed) {
        medicine_id = globalMed.id;
        if (!hsn) hsn = globalMed.hsn_code || undefined;
        if (gst === undefined || gst === 12 || gst === 5) gst = Number(globalMed.gst_rate);
      }
    } else if (!hsn || !gst) {
      // If medicine_id is provided, pull HSN/GST if they're missing
      const globalMed = await prisma.medicine.findUnique({ where: { id: medicine_id } });
      if (globalMed) {
        if (!hsn) hsn = globalMed.hsn_code || undefined;
        if (gst === undefined || gst === 12 || gst === 5) gst = Number(globalMed.gst_rate);
      }
    }

    // 2. Ensure parent ShopMedicine exists/updated
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
        hsn_code: hsn || undefined,
        medicine_id: medicine_id || undefined,
      },
      create: {
        shop_id: shop.id,
        medicine_id: medicine_id || undefined,
        medicine_name: data.medicine_name.trim(),
        hsn_code: hsn || undefined,
        unit: data.unit || 'strip',
        reorder_level: data.reorder_level || 10,
        rack_location: data.rack_location || undefined,
      }
    });

    // 3. Create the batch record
    const item = await prisma.shopInventory.create({
      data: {
        shop_id: shop.id,
        shop_medicine_id: shopMed.id,
        medicine_name: data.medicine_name.trim(),
        hsn_code: hsn || undefined,
        gst_rate: gst ?? 5,
        batch_number: data.batch_number,
        expiry_date: data.expiry_date ? new Date(data.expiry_date) : undefined,
        mrp: data.mrp,
        purchase_price: data.purchase_price,
        stock_qty: data.stock_qty,
        unit: data.unit || 'strip',
        reorder_level: data.reorder_level || 10,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        medicine_id: medicine_id || undefined,
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
    
    let shopMedId = (existing as any).shop_medicine_id;

    // If medicine name or unit changed, ensure matching ShopMedicine exists
    if ((data.medicine_name && data.medicine_name.trim().toLowerCase() !== existing.medicine_name.toLowerCase()) || 
        (data.unit && data.unit.toLowerCase() !== existing.unit?.toLowerCase())) {
      
      const mName = (data.medicine_name || existing.medicine_name).trim();
      const unit = (data.unit || existing.unit || 'strip').trim();

      const shopMed = await prisma.shopMedicine.upsert({
        where: {
          shop_id_medicine_name_unit: {
            shop_id: shop.id,
            medicine_name: mName,
            unit: unit,
          }
        },
        update: {
          rack_location: data.rack_location || undefined,
          hsn_code: data.hsn_code || undefined,
        },
        create: {
          shop_id: shop.id,
          medicine_name: mName,
          hsn_code: data.hsn_code || undefined,
          unit: unit,
          reorder_level: data.reorder_level || existing.reorder_level || 10,
          rack_location: data.rack_location || undefined,
        }
      });
      shopMedId = shopMed.id;
    } else if (data.rack_location !== undefined || data.reorder_level !== undefined || data.hsn_code !== undefined) {
      // Update rack/reorder/hsn on existing master
      if (shopMedId) {
        await prisma.shopMedicine.update({
          where: { id: shopMedId },
          data: {
            rack_location: data.rack_location || undefined,
            reorder_level: data.reorder_level || undefined,
            hsn_code: data.hsn_code || undefined,
          }
        });
      }
    }

    const item = await prisma.shopInventory.update({
      where: { id: req.params.id },
      data: { 
        ...data, 
        shop_medicine_id: shopMedId || undefined,
        expiry_date: data.expiry_date ? new Date(data.expiry_date) : undefined 
      },
    });

    // ── Low-stock notification (Based on Total Stock) ────────────────────────
    if (shopMedId) {
      const summary = await prisma.shopInventory.aggregate({
        where: { shop_medicine_id: shopMedId },
        _sum: { stock_qty: true }
      });
      const totalStock = Number(summary._sum.stock_qty || 0);
      const reorderLevel = data.reorder_level || existing.reorder_level || 10;

      if (totalStock <= reorderLevel) {
        prisma.notification.create({
          data: {
            user_id: req.user!.id,
            title: 'Low Stock Alert',
            body: `${item.medicine_name} is running low — only ${totalStock} unit(s) left in total across all batches (reorder level: ${reorderLevel}). Please restock soon.`,
            type: 'push',
            category: 'stock_alert',
            reference_id: shopMedId,
            reference_type: 'inventory',
          },
        }).catch((e: Error) => logger.warn(`Stock alert notification failed: ${e?.message}`));
      }
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
        gst_rate:       row.gst_rate       != null ? Number(row.gst_rate)    : 5,
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
