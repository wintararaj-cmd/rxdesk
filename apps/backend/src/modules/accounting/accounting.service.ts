import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { Prisma } from '@prisma/client';
import logger from '../../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';

const STATE_MAP: Record<string, string> = {
  'wb': 'west bengal', 'mh': 'maharashtra', 'ka': 'karnataka', 'tn': 'tamil nadu',
  'dl': 'delhi', 'up': 'uttar pradesh', 'ap': 'andhra pradesh', 'ts': 'telangana',
  'tg': 'telangana', 'gj': 'gujarat', 'rj': 'rajasthan', 'mp': 'madhya pradesh',
  'br': 'bihar', 'hr': 'haryana', 'pb': 'punjab', 'jk': 'jammu and kashmir',
  'kl': 'kerala', 'od': 'odisha', 'as': 'assam', 'ct': 'chhattisgarh',
  'jh': 'jharkhand', 'uk': 'uttarakhand', 'hp': 'himachal pradesh', 'ga': 'goa',
  'tr': 'tripura', 'ml': 'meghalaya', 'mn': 'manipur', 'nl': 'nagaland',
  'ar': 'arunachal pradesh', 'sk': 'sikkim', 'mz': 'mizoram', 'py': 'puducherry',
  'an': 'andaman and nicobar islands', 'ch': 'chandigarh',
  'dn': 'dadra and nagar haveli and daman and diu', 'ld': 'lakshadweep'
};

function normalizeState(s?: string | null): string {
  if (!s) return '';
  const cleaned = s.trim().toLowerCase();
  return STATE_MAP[cleaned] || cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getShopOrThrow(userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can access accounting');
  return shop;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Suppliers
// ─────────────────────────────────────────────────────────────────────────────

export async function listSuppliers(userId: string) {
  const shop = await getShopOrThrow(userId);
  return prisma.supplier.findMany({
    where: { shop_id: shop.id, is_active: true },
    include: {
      _count: { select: { purchases: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createSupplier(userId: string, data: {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gst_number?: string;
  drug_license_no?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  credit_limit?: number;
  payment_terms?: string;
  notes?: string;
  opening_balance?: number;
  city?: string;
  state?: string;
}) {
  const shop = await getShopOrThrow(userId);
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        shop_id: shop.id,
        name: data.name,
        contact_person: data.contact_person,
        phone: data.phone,
        email: data.email,
        address: data.address,
        gst_number: data.gst_number,
        drug_license_no: data.drug_license_no,
        bank_name: data.bank_name,
        bank_account: data.bank_account,
        bank_ifsc: data.bank_ifsc,
        credit_limit: data.credit_limit ?? 0,
        payment_terms: data.payment_terms,
        notes: data.notes,
        city: data.city,
        state: data.state,
      },
    });

    const balance = Number(data.opening_balance || 0);
    if (balance > 0) {
      await tx.purchaseEntry.create({
        data: {
          shop_id: shop.id,
          supplier_id: supplier.id,
          invoice_number: 'OPEN_BAL',
          invoice_date: new Date(),
          received_date: new Date(),
          subtotal: balance,
          gst_amount: 0,
          total_amount: balance,
          amount_paid: 0,
          payment_status: 'unpaid',
          notes: 'Opening balance',
          created_by: userId,
        },
      });
    }

    return supplier;
  });
}

export async function getSupplierWithLedger(userId: string, supplierId: string) {
  const shop = await getShopOrThrow(userId);
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, shop_id: shop.id },
    include: {
      purchases: {
        orderBy: { invoice_date: 'desc' },
        take: 20,
        select: {
          id: true, invoice_number: true, invoice_date: true,
          total_amount: true, amount_paid: true, payment_status: true,
        },
      },
      payments: {
        orderBy: { payment_date: 'desc' },
        take: 30,
        select: {
          id: true, amount: true, payment_method: true,
          payment_date: true, reference_no: true,
        },
      },
      purchase_returns: {
        orderBy: { return_date: 'desc' },
        take: 20,
        select: {
          id: true, return_number: true, return_date: true,
          total_amount: true, reason: true,
        },
      },
    },
  });
  if (!supplier) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');

  const [totalPurchases, totalPaid, totalReturned] = await Promise.all([
    prisma.purchaseEntry.aggregate({
      where: { supplier_id: supplierId, shop_id: shop.id },
      _sum: { total_amount: true },
    }),
    prisma.supplierPayment.aggregate({
      where: { supplier_id: supplierId, shop_id: shop.id },
      _sum: { amount: true },
    }),
    prisma.purchaseReturn.aggregate({
      where: { supplier_id: supplierId, shop_id: shop.id },
      _sum: { total_amount: true },
    }),
  ]);

  const purchased = Number(totalPurchases._sum.total_amount ?? 0);
  const paid = Number(totalPaid._sum.amount ?? 0);
  const returned = Number(totalReturned._sum.total_amount ?? 0);

  return {
    ...supplier,
    total_purchases: purchased,
    total_paid: paid,
    total_returned: returned,
    outstanding: purchased - paid - returned,
  };
}

export async function updateSupplier(userId: string, supplierId: string, data: Partial<Prisma.SupplierUpdateInput>) {
  const shop = await getShopOrThrow(userId);
  const exists = await prisma.supplier.findFirst({ where: { id: supplierId, shop_id: shop.id } });
  if (!exists) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  return prisma.supplier.update({ where: { id: supplierId }, data });
}

export async function deactivateSupplier(userId: string, supplierId: string) {
  const shop = await getShopOrThrow(userId);
  const exists = await prisma.supplier.findFirst({ where: { id: supplierId, shop_id: shop.id } });
  if (!exists) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  return prisma.supplier.update({ where: { id: supplierId }, data: { is_active: false } });
}

export async function importSuppliers(userId: string, suppliers: any[]) {
  const shop = await getShopOrThrow(userId);

  return prisma.$transaction(async (tx) => {
    const results: any[] = [];
    for (const s of suppliers) {
      if (!s.name) continue;

      // Check if supplier already exists by name for this shop
      const existing = await tx.supplier.findFirst({
        where: { shop_id: shop.id, name: s.name },
      });

      let supplier;
      if (existing) {
        supplier = await tx.supplier.update({
          where: { id: existing.id },
          data: {
            contact_person: s.contact_person,
            phone: s.phone,
            email: s.email,
            address: s.address,
            city: s.city,
            state: s.state,
            gst_number: s.gst_number,
            notes: s.notes,
          },
        });
      } else {
        supplier = await tx.supplier.create({
          data: {
            shop_id: shop.id,
            name: s.name,
            contact_person: s.contact_person,
            phone: s.phone,
            email: s.email,
            address: s.address,
            city: s.city,
            state: s.state,
            gst_number: s.gst_number,
            notes: s.notes,
          },
        });
      }

      // Handle opening balance
      const balance = Number(s.opening_balance || 0);
      if (balance > 0) {
        // Check if an opening balance already exists to prevent duplicates on re-import
        const existingVal = await tx.purchaseEntry.findFirst({
          where: { supplier_id: supplier.id, invoice_number: 'OPEN_BAL' },
        });

        if (!existingVal) {
          await tx.purchaseEntry.create({
            data: {
              shop_id: shop.id,
              supplier_id: supplier.id,
              invoice_number: 'OPEN_BAL',
              invoice_date: new Date(),
              received_date: new Date(),
              subtotal: balance,
              gst_amount: 0,
              total_amount: balance,
              amount_paid: 0,
              payment_status: 'unpaid',
              notes: 'Opening balance from migration',
              created_by: userId,
            },
          });
        }
      }
      results.push(supplier);
    }
    return results;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Purchase Entries
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePurchaseInput {
  supplier_id?: string;
  invoice_number?: string;
  invoice_date: string;
  received_date?: string;
  notes?: string;
  items: {
    medicine_id?: string;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    free_qty?: number;
    purchase_price: number;
    mrp: number;
    discount_pct?: number;
    gst_rate?: number;
    hsn_code?: string;
    unit?: string;
  }[];
}

export async function createPurchaseEntry(userId: string, input: CreatePurchaseInput) {
  const shop = await getShopOrThrow(userId);

  // Calculate totals
  const itemsWithTotals = input.items.map((item): any => {
    const discountPct = item.discount_pct ?? 0;
    const gstRate = item.gst_rate ?? 12;
    const baseTotal = item.purchase_price * item.quantity;
    const discountAmt = baseTotal * (discountPct / 100);
    const taxableVal = baseTotal - discountAmt;
    const gstAmt = taxableVal * (gstRate / 100);
    const lineTotal = taxableVal + gstAmt;
    return { ...item, discount_pct: discountPct, gst_rate: gstRate, line_total: lineTotal, gst_amount: gstAmt };
  });

  const subtotal = itemsWithTotals.reduce((s, i) => s + i.purchase_price * i.quantity, 0);
  const totalGst = itemsWithTotals.reduce((s, i) => s + i.gst_amount, 0);
  const totalAmount = itemsWithTotals.reduce((s, i) => s + i.line_total, 0);

  const purchase = await prisma.$transaction(async (tx) => {
    // Create purchase entry
    const pe = await tx.purchaseEntry.create({
      data: {
        shop_id: shop.id,
        supplier_id: input.supplier_id ?? null,
        invoice_number: input.invoice_number,
        invoice_date: new Date(input.invoice_date),
        received_date: new Date(input.received_date ?? input.invoice_date),
        subtotal,
        gst_amount: totalGst,
        total_amount: totalAmount,
        created_by: userId,
        items: {
          create: itemsWithTotals.map((item) => ({
            medicine_id: item.medicine_id ?? null,
            medicine_name: item.medicine_name,
            batch_number: (item.batch_number || '').trim(),
            expiry_date: new Date(item.expiry_date),
            quantity: item.quantity,
            free_qty: item.free_qty ?? 0,
            purchase_price: item.purchase_price,
            mrp: item.mrp,
            discount_pct: item.discount_pct,
            gst_rate: item.gst_rate,
            line_total: item.line_total,
          })),
        },
      },
      include: { items: true },
    });

    // Upsert inventory for each item
    for (const item of itemsWithTotals) {
      const totalQty = item.quantity + (item.free_qty ?? 0);
      const mName = item.medicine_name.trim();
      const bNumber = (item.batch_number || '').trim();

      const existing = await tx.shopInventory.findFirst({
        where: {
          shop_id: shop.id,
          AND: [
            {
              OR: [
                ...(item.medicine_id ? [{ medicine_id: item.medicine_id }] : []),
                { medicine_name: { equals: mName, mode: 'insensitive' } }
              ]
            },
            bNumber === ''
              ? { OR: [{ batch_number: '' }, { batch_number: null }] }
              : { batch_number: { equals: bNumber, mode: 'insensitive' } }
          ]
        },
      });

      if (existing) {
        await tx.shopInventory.update({
          where: { id: existing.id },
          data: {
            stock_qty: { increment: totalQty },
            mrp: item.mrp,
            purchase_price: item.purchase_price,
            unit: item.unit ?? existing.unit,
            expiry_date: new Date(item.expiry_date),
            hsn_code: item.hsn_code ?? existing.hsn_code,
            ...(item.medicine_id ? { medicine_id: item.medicine_id } : {}),
          },
        });
      } else {
        await tx.shopInventory.create({
          data: {
            shop_id: shop.id,
            medicine_id: item.medicine_id ?? null,
            medicine_name: mName,
            batch_number: bNumber,
            expiry_date: new Date(item.expiry_date),
            mrp: item.mrp,
            purchase_price: item.purchase_price,
            stock_qty: totalQty,
            gst_rate: item.gst_rate,
            unit: item.unit ?? 'strip',
            hsn_code: item.hsn_code,
          },
        });
      }
    }

    // Auto-create expense entry
    await tx.expenseEntry.create({
      data: {
        shop_id: shop.id,
        category: 'medicine_purchase',
        description: `Purchase from ${input.supplier_id ? 'supplier' : 'unregistered supplier'} — ${input.invoice_number ?? pe.id}`,
        amount: totalAmount,
        payment_method: 'cash',
        entry_date: new Date(input.received_date ?? input.invoice_date),
        linked_purchase_id: pe.id,
        created_by: userId,
      },
    });

    return pe;
  });

  return purchase;
}

export async function updatePurchaseEntry(userId: string, id: string, input: CreatePurchaseInput) {
  const shop = await getShopOrThrow(userId);

  return await prisma.$transaction(async (tx) => {
    const oldPurchase = await tx.purchaseEntry.findUnique({
      where: { id, shop_id: shop.id },
      include: { items: true },
    });

    if (!oldPurchase) throw new AppError(404, 'NOT_FOUND', 'Purchase record not found');

    // 1. Reverse Old Inventory
    for (const item of oldPurchase.items) {
      const bNo = (item.batch_number || '').trim();
      const existing = await tx.shopInventory.findFirst({
        where: {
          shop_id: shop.id,
          AND: [
            {
              OR: [
                ...(item.medicine_id ? [{ medicine_id: item.medicine_id }] : []),
                { medicine_name: { equals: item.medicine_name.trim(), mode: 'insensitive' } }
              ]
            },
            bNo === ''
              ? { OR: [{ batch_number: '' }, { batch_number: null }] }
              : { batch_number: { equals: bNo, mode: 'insensitive' } }
          ]
        },
      });
      if (existing) {
        await tx.shopInventory.update({
          where: { id: existing.id },
          data: {
            stock_qty: { decrement: item.quantity + (item.free_qty || 0) },
          },
        });
      }
    }

    // 2. Clear old items
    await tx.purchaseItem.deleteMany({ where: { purchase_id: id } });

    // 3. New Totals
    const itemsWithTotals = input.items.map((item): any => {
      const discountPct = item.discount_pct ?? 0;
      const gstRate = item.gst_rate ?? 12;
      const baseTotal = item.purchase_price * item.quantity;
      const discountAmt = baseTotal * (discountPct / 100);
      const taxableVal = baseTotal - discountAmt;
      const gstAmt = taxableVal * (gstRate / 100);
      const lineTotal = taxableVal + gstAmt;
      return { ...item, discount_pct: discountPct, gst_rate: gstRate, line_total: lineTotal, gst_amount: gstAmt };
    });

    const subtotal = itemsWithTotals.reduce((s, i) => s + i.purchase_price * i.quantity, 0);
    const totalGst = itemsWithTotals.reduce((s, i) => s + i.gst_amount, 0);
    const totalAmount = itemsWithTotals.reduce((s, i) => s + i.line_total, 0);

    // 4. Update the entry
    const updatedPe = await tx.purchaseEntry.update({
      where: { id },
      data: {
        supplier_id: input.supplier_id ?? null,
        invoice_number: input.invoice_number,
        invoice_date: new Date(input.invoice_date),
        received_date: new Date(input.received_date ?? input.invoice_date),
        subtotal,
        gst_amount: totalGst,
        total_amount: totalAmount,
        items: {
          create: itemsWithTotals.map((item) => ({
            medicine_id: item.medicine_id ?? null,
            medicine_name: item.medicine_name,
            batch_number: (item.batch_number || '').trim(),
            expiry_date: new Date(item.expiry_date),
            quantity: item.quantity,
            free_qty: item.free_qty ?? 0,
            purchase_price: item.purchase_price,
            mrp: item.mrp,
            discount_pct: item.discount_pct,
            gst_rate: item.gst_rate,
            line_total: item.line_total,
          })),
        },
      },
      include: { items: true },
    });

    // 5. Update inventory for each NEW item
    for (const item of itemsWithTotals) {
      const totalQty = item.quantity + (item.free_qty ?? 0);
      const mName = item.medicine_name.trim();
      const bNumber = (item.batch_number || '').trim();

      const existing = await tx.shopInventory.findFirst({
        where: {
          shop_id: shop.id,
          AND: [
            {
              OR: [
                ...(item.medicine_id ? [{ medicine_id: item.medicine_id }] : []),
                { medicine_name: { equals: mName, mode: 'insensitive' } }
              ]
            },
            bNumber === ''
              ? { OR: [{ batch_number: '' }, { batch_number: null }] }
              : { batch_number: { equals: bNumber, mode: 'insensitive' } }
          ]
        },
      });

      if (existing) {
        await tx.shopInventory.update({
          where: { id: existing.id },
          data: {
            stock_qty: { increment: totalQty },
            mrp: item.mrp,
            purchase_price: item.purchase_price,
            unit: item.unit ?? existing.unit,
            expiry_date: new Date(item.expiry_date),
            hsn_code: item.hsn_code ?? existing.hsn_code,
            ...(item.medicine_id ? { medicine_id: item.medicine_id } : {}),
          },
        });
      } else {
        await tx.shopInventory.create({
          data: {
            shop_id: shop.id,
            medicine_id: item.medicine_id ?? null,
            medicine_name: mName,
            batch_number: bNumber,
            expiry_date: new Date(item.expiry_date),
            mrp: item.mrp,
            purchase_price: item.purchase_price,
            stock_qty: totalQty,
            gst_rate: item.gst_rate,
            unit: item.unit ?? 'strip',
            hsn_code: item.hsn_code,
          },
        });
      }
    }

    // 6. Update linked expense
    await tx.expenseEntry.updateMany({
      where: { linked_purchase_id: id },
      data: {
        amount: totalAmount,
        description: `Purchase from ${input.supplier_id ? 'supplier' : 'unregistered'} — ${input.invoice_number ?? id} (EDITED)`,
        entry_date: new Date(input.received_date ?? input.invoice_date),
      },
    });

    return updatedPe;
  });
}

export async function listPurchaseEntries(userId: string, opts: { page?: number; limit?: number; supplier_id?: string; from?: string; to?: string }) {
  const shop = await getShopOrThrow(userId);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const where: Prisma.PurchaseEntryWhereInput = {
    shop_id: shop.id,
    ...(opts.supplier_id ? { supplier_id: opts.supplier_id } : {}),
    ...(opts.from || opts.to
      ? {
        invoice_date: {
          ...(opts.from ? { gte: new Date(opts.from) } : {}),
          ...(opts.to ? { lte: new Date(opts.to) } : {}),
        },
      }
      : {}),
  };
  const [total, items, aggregations, topSupplierData] = await Promise.all([
    prisma.purchaseEntry.count({ where }),
    prisma.purchaseEntry.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { invoice_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseEntry.aggregate({
      where,
      _sum: { total_amount: true, amount_paid: true },
    }),
    prisma.purchaseEntry.groupBy({
      by: ['supplier_id'],
      where: { ...where, supplier_id: { not: null } },
      _sum: { total_amount: true },
      orderBy: { _sum: { total_amount: 'desc' } },
      take: 1,
    }),
  ]);

  let topSupplierName = 'N/A';
  if (topSupplierData.length > 0 && topSupplierData[0].supplier_id) {
    const s = await prisma.supplier.findUnique({ where: { id: topSupplierData[0].supplier_id }, select: { name: true } });
    if (s) topSupplierName = s.name;
  }

  const totalAmountSum = Number(aggregations._sum.total_amount ?? 0);
  const totalPaidSum = Number(aggregations._sum.amount_paid ?? 0);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    total_amount_sum: totalAmountSum,
    total_due_sum: totalAmountSum - totalPaidSum,
    top_supplier: topSupplierName,
  };
}

export async function getPurchaseEntryById(userId: string, purchaseId: string) {
  const shop = await getShopOrThrow(userId);
  const entry = await prisma.purchaseEntry.findFirst({
    where: { id: purchaseId, shop_id: shop.id },
    include: {
      items: true,
      supplier: true,
      payments: { orderBy: { payment_date: 'desc' } },
    },
  });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'Purchase entry not found');
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Supplier Payments
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordSupplierPaymentInput {
  supplier_id: string;
  purchase_id?: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'neft' | 'cheque' | 'card';
  payment_date?: string;
  reference_no?: string;
  notes?: string;
}

export async function recordSupplierPayment(userId: string, input: RecordSupplierPaymentInput) {
  const shop = await getShopOrThrow(userId);

  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplier_id, shop_id: shop.id } });
  if (!supplier) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');

  return prisma.$transaction(async (tx) => {
    const payment = await tx.supplierPayment.create({
      data: {
        shop_id: shop.id,
        supplier_id: input.supplier_id,
        purchase_id: input.purchase_id ?? null,
        amount: input.amount,
        payment_method: input.payment_method as any,
        payment_date: new Date(input.payment_date ?? new Date().toISOString()),
        reference_no: input.reference_no,
        notes: input.notes,
        created_by: userId,
      },
    });

    // Update purchase amount_paid if linked
    if (input.purchase_id) {
      const purchase = await tx.purchaseEntry.findFirst({ where: { id: input.purchase_id, shop_id: shop.id } });
      if (purchase) {
        const newPaid = Number(purchase.amount_paid) + input.amount;
        const status = newPaid >= Number(purchase.total_amount) ? 'paid' : 'partial';
        await tx.purchaseEntry.update({
          where: { id: input.purchase_id },
          data: { amount_paid: newPaid, payment_status: status as any },
        });
        // Update linked expense payment method
        await tx.expenseEntry.updateMany({
          where: { linked_purchase_id: input.purchase_id },
          data: { payment_method: input.payment_method as any, reference_no: input.reference_no },
        });
      }
    }

    return payment;
  });
}

export async function listSupplierPayments(userId: string, opts: { supplier_id?: string; from?: string; to?: string }) {
  const shop = await getShopOrThrow(userId);
  const where: Prisma.SupplierPaymentWhereInput = {
    shop_id: shop.id,
    ...(opts.supplier_id ? { supplier_id: opts.supplier_id } : {}),
    ...(opts.from || opts.to
      ? {
        payment_date: {
          ...(opts.from ? { gte: new Date(opts.from) } : {}),
          ...(opts.to ? { lte: new Date(opts.to) } : {}),
        },
      }
      : {}),
  };
  return prisma.supplierPayment.findMany({
    where,
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { payment_date: 'desc' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Expenses
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateExpenseInput {
  category: 'medicine_purchase' | 'rent' | 'salary' | 'utilities' | 'transport' | 'maintenance' | 'miscellaneous';
  description?: string;
  amount: number;
  payment_method?: 'cash' | 'upi' | 'neft' | 'cheque' | 'card';
  reference_no?: string;
  entry_date?: string;
}

export async function createExpense(userId: string, input: CreateExpenseInput) {
  const shop = await getShopOrThrow(userId);
  return prisma.expenseEntry.create({
    data: {
      shop_id: shop.id,
      category: input.category as any,
      description: input.description,
      amount: input.amount,
      payment_method: (input.payment_method ?? 'cash') as any,
      reference_no: input.reference_no,
      entry_date: new Date(input.entry_date ?? new Date().toISOString()),
      created_by: userId,
    },
  });
}

export async function listExpenses(userId: string, opts: { category?: string; from?: string; to?: string; page?: number; limit?: number }) {
  const shop = await getShopOrThrow(userId);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 30;
  const where: Prisma.ExpenseEntryWhereInput = {
    shop_id: shop.id,
    // Skip auto-generated medicine_purchase entries (they come from purchases)
    NOT: { linked_purchase_id: { not: null } },
    ...(opts.category ? { category: opts.category as any } : {}),
    ...(opts.from || opts.to
      ? {
        entry_date: {
          ...(opts.from ? { gte: new Date(opts.from) } : {}),
          ...(opts.to ? { lte: new Date(opts.to) } : {}),
        },
      }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.expenseEntry.count({ where }),
    prisma.expenseEntry.findMany({
      where,
      orderBy: { entry_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateExpense(userId: string, expenseId: string, data: Partial<CreateExpenseInput>) {
  const shop = await getShopOrThrow(userId);
  const existing = await prisma.expenseEntry.findFirst({
    where: { id: expenseId, shop_id: shop.id, linked_purchase_id: null },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Expense entry not found or is auto-generated');
  return prisma.expenseEntry.update({
    where: { id: expenseId },
    data: {
      ...(data.category ? { category: data.category as any } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.payment_method ? { payment_method: data.payment_method as any } : {}),
      ...(data.reference_no !== undefined ? { reference_no: data.reference_no } : {}),
      ...(data.entry_date ? { entry_date: new Date(data.entry_date) } : {}),
    },
  });
}

export async function deleteExpense(userId: string, expenseId: string) {
  const shop = await getShopOrThrow(userId);
  const existing = await prisma.expenseEntry.findFirst({
    where: { id: expenseId, shop_id: shop.id, linked_purchase_id: null },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Expense entry not found or is auto-generated');
  return prisma.expenseEntry.delete({ where: { id: expenseId } });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Income
// ─────────────────────────────────────────────────────────────────────────────

export async function listIncome(userId: string, opts: { from?: string; to?: string; page?: number; limit?: number }) {
  const shop = await getShopOrThrow(userId);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 30;
  const where: Prisma.IncomeEntryWhereInput = {
    shop_id: shop.id,
    ...(opts.from || opts.to
      ? {
        entry_date: {
          ...(opts.from ? { gte: new Date(opts.from) } : {}),
          ...(opts.to ? { lte: new Date(opts.to) } : {}),
        },
      }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.incomeEntry.count({ where }),
    prisma.incomeEntry.findMany({
      where,
      orderBy: { entry_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createManualIncome(userId: string, input: { entry_type: string; amount: number; payment_method?: string; entry_date?: string; notes?: string }) {
  const shop = await getShopOrThrow(userId);
  return prisma.incomeEntry.create({
    data: {
      shop_id: shop.id,
      entry_type: input.entry_type as any,
      amount: input.amount,
      payment_method: (input.payment_method ?? 'cash') as any,
      entry_date: new Date(input.entry_date ?? new Date().toISOString()),
      notes: input.notes,
      created_by: userId,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Credit Customers
// ─────────────────────────────────────────────────────────────────────────────

export async function listCreditCustomers(userId: string) {
  const shop = await getShopOrThrow(userId);
  const customers = await prisma.creditCustomer.findMany({
    where: { shop_id: shop.id, is_active: true },
    orderBy: { total_outstanding: 'desc' },
  });

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Check for overdue (last credit transaction > 30 days ago)
  const customersWithOverdue = await Promise.all(
    customers.map(async (c) => {
      const lastCredit = await prisma.creditTransaction.findFirst({
        where: { customer_id: c.id, type: 'credit_given' },
        orderBy: { transaction_date: 'desc' },
      });
      return {
        ...c,
        overdue: lastCredit ? lastCredit.transaction_date < thirtyDaysAgo && Number(c.total_outstanding) > 0 : false,
      };
    })
  );

  const totalOutstanding = customers.reduce((s, c) => s + Number(c.total_outstanding), 0);
  return { customers: customersWithOverdue, total_customers: customers.length, total_outstanding: totalOutstanding };
}

export async function createCreditCustomer(userId: string, data: { name: string; phone?: string; address?: string; credit_limit?: number; patient_id?: string; notes?: string; opening_balance?: number }) {
  const shop = await getShopOrThrow(userId);
  return prisma.$transaction(async (tx) => {
    const balance = Number(data.opening_balance || 0);
    const customer = await tx.creditCustomer.create({
      data: {
        shop_id: shop.id,
        name: data.name,
        phone: data.phone,
        address: data.address,
        credit_limit: data.credit_limit ?? 0,
        patient_id: data.patient_id ?? null,
        notes: data.notes,
        total_outstanding: balance,
      },
    });

    if (balance > 0) {
      await tx.creditTransaction.create({
        data: {
          customer_id: customer.id,
          shop_id: shop.id,
          type: 'credit_given',
          amount: balance,
          transaction_date: new Date(),
          notes: 'Opening balance',
          created_by: userId,
        },
      });
    }

    return customer;
  });
}

export async function importCreditCustomers(userId: string, customers: any[]) {
  const shop = await getShopOrThrow(userId);

  return prisma.$transaction(async (tx) => {
    const results: any[] = [];
    for (const c of customers) {
      if (!c.name) continue;

      // Check for existing customer by name + phone
      const existing = await tx.creditCustomer.findFirst({
        where: {
          shop_id: shop.id,
          name: c.name,
          ...(c.phone ? { phone: c.phone } : {}),
        },
      });

      const balance = Number(c.opening_balance || 0);
      let customer;

      if (existing) {
        // Just update details, don't overwrite outstanding directly if it was already set
        customer = await tx.creditCustomer.update({
          where: { id: existing.id },
          data: {
            address: c.address,
            credit_limit: c.credit_limit ? Number(c.credit_limit) : undefined,
            notes: c.notes,
          },
        });
      } else {
        customer = await tx.creditCustomer.create({
          data: {
            shop_id: shop.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            credit_limit: Number(c.credit_limit || 0),
            notes: c.notes,
            total_outstanding: balance,
          },
        });
      }

      if (balance > 0) {
        // Only create opening transaction if none exists
        const txExists = await tx.creditTransaction.findFirst({
          where: { customer_id: customer.id, notes: 'Opening balance from migration' },
        });

        if (!txExists) {
          // If customer was updated (existing), we need to increment their outstanding
          if (existing) {
            await tx.creditCustomer.update({
              where: { id: customer.id },
              data: { total_outstanding: { increment: balance } },
            });
          }

          await tx.creditTransaction.create({
            data: {
              customer_id: customer.id,
              shop_id: shop.id,
              type: 'credit_given',
              amount: balance,
              transaction_date: new Date(),
              notes: 'Opening balance from migration',
              created_by: userId,
            },
          });
        }
      }
      results.push(customer);
    }
    return results;
  });
}

export async function getCreditCustomerLedger(userId: string, customerId: string) {
  const shop = await getShopOrThrow(userId);
  let customer: any = null;
  let pendingBills: any[] = [];

  if (customerId.startsWith('pending-')) {
    const identifier = customerId.replace('pending-', '');
    // Virtual customer for pending bills
    pendingBills = await prisma.bill.findMany({
      where: {
        shop_id: shop.id,
        payment_status: 'pending',
        OR: [
          { customer_phone: identifier },
          { customer_name: identifier }
        ]
      },
      orderBy: { created_at: 'desc' },
      include: { items: { select: { medicine_name: true, quantity: true } } }
    });

    if (pendingBills.length === 0) throw new AppError(404, 'NOT_FOUND', 'Pending customer record not found');

    const amount = pendingBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
    return {
      id: customerId,
      name: identifier,
      phone: /^[0-9]+$/.test(identifier) ? identifier : undefined,
      total_outstanding: amount,
      transactions: pendingBills.map(b => ({
        id: b.id,
        transaction_date: b.created_at,
        notes: `Pending Bill: ${b.bill_number}`,
        type: 'credit_given',
        amount: Number(b.total_amount),
        bill: { id: b.id, bill_number: b.bill_number, total_amount: b.total_amount }
      }))
    };
  }

  customer = await prisma.creditCustomer.findFirst({
    where: { id: customerId, shop_id: shop.id },
    include: {
      transactions: {
        orderBy: { transaction_date: 'desc' },
        include: { bill: { select: { id: true, bill_number: true, total_amount: true } } },
      },
    },
  });

  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Credit customer not found');

  // Also fetch any "Pay Later" bills for this real customer that aren't yet in the credit_transactions
  pendingBills = await prisma.bill.findMany({
    where: {
      shop_id: shop.id,
      payment_status: 'pending',
      OR: [
        (customer.phone ? { customer_phone: customer.phone } : {}),
        { customer_name: customer.name }
      ].filter(o => Object.keys(o).length > 0) as any,
      credit_transactions: { none: {} } // only those not already linked to a credit txn
    },
    orderBy: { created_at: 'desc' }
  });

  const virtualTxns = pendingBills.map(b => ({
    id: `v-${b.id}`,
    transaction_date: b.created_at,
    notes: `Pending Bill: ${b.bill_number}`,
    type: 'credit_given',
    amount: Number(b.total_amount),
    bill: { id: b.id, bill_number: b.bill_number, total_amount: b.total_amount }
  }));

  // Combine real and virtual transactions
  const allTxns = [...(customer.transactions || []), ...virtualTxns].sort(
    (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
  );

  return {
    ...customer,
    total_outstanding: Number(customer.total_outstanding) + pendingBills.reduce((s, b) => s + Number(b.total_amount), 0),
    transactions: allTxns
  };
}

export async function recordCreditPayment(userId: string, customerId: string, data: { amount: number; payment_method?: string; reference_no?: string; notes?: string }) {
  const shop = await getShopOrThrow(userId);
  let customer: any = null;
  let pendingBills: any[] = [];
  let totalPending = 0;

  if (customerId.startsWith('pending-')) {
    const identifier = customerId.replace('pending-', '');
    // Find bills matching this identifier (as phone or name)
    pendingBills = await prisma.bill.findMany({
      where: {
        shop_id: shop.id,
        payment_status: 'pending',
        OR: [
          { customer_phone: identifier },
          { customer_name: identifier }
        ]
      },
      orderBy: { created_at: 'asc' }
    });
    totalPending = pendingBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  } else {
    customer = await prisma.creditCustomer.findFirst({ where: { id: customerId, shop_id: shop.id } });
    if (!customer) throw new AppError(404, 'NOT_FOUND', 'Credit customer not found');

    // Also check for pending bills for this real customer
    pendingBills = await prisma.bill.findMany({
      where: {
        shop_id: shop.id,
        payment_status: 'pending',
        OR: [
          (customer.phone ? { customer_phone: customer.phone } : {}),
          { customer_name: customer.name }
        ].filter(o => Object.keys(o).length > 0) as any
      },
      orderBy: { created_at: 'asc' }
    });
    totalPending = pendingBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  }

  const combinedOutstanding = Number(customer?.total_outstanding || 0) + totalPending;
  
  // Allow small floating point variations? Better to round.
  if (data.amount > (combinedOutstanding + 0.01)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Payment exceeds outstanding balance (Current: ${combinedOutstanding.toFixed(2)})`);
  }

  return prisma.$transaction(async (tx) => {
    let remaining = data.amount;

    // 1. Ensure CreditCustomer exists for tracking
    if (!customer) {
      const identifier = customerId.replace('pending-', '');
      // Try to find by phone/name in case they were created meanwhile
      customer = await tx.creditCustomer.findFirst({
        where: {
          shop_id: shop.id,
          OR: [
            { phone: identifier },
            { name: identifier }
          ]
        }
      });

      if (!customer) {
        customer = await tx.creditCustomer.create({
          data: {
            shop_id: shop.id,
            name: identifier,
            phone: /^[0-9]+$/.test(identifier) ? identifier : undefined,
            total_outstanding: 0,
          }
        });
      }
    }

    // 2. Settle the Ledger first (if any positive balance)
    let ledgerSettlement = 0;
    if (Number(customer.total_outstanding) > 0) {
      ledgerSettlement = Math.min(Number(customer.total_outstanding), remaining);
      await tx.creditCustomer.update({
        where: { id: customer.id },
        data: { total_outstanding: { decrement: ledgerSettlement } }
      });
      remaining -= ledgerSettlement;
    }

    // 3. Settle Pending Bills (Greedy)
    for (const bill of pendingBills) {
      if (remaining <= 0) break;
      const billAmt = Number(bill.total_amount);
      
      // We only mark as 'paid' if the remaining payment covers the FULL bill
      // Partial payments stay in the ledger as a credit (negative balance)
      if (remaining >= (billAmt - 0.01)) {
        await tx.bill.update({
          where: { id: bill.id },
          data: { 
            payment_status: 'paid', 
            payment_method: (data.payment_method ?? 'cash') as any,
            updated_at: new Date()
          }
        });
        remaining -= billAmt;
      } else {
        // Can't settle this bill fully, stop settling bills and put the rest in ledger
        break;
      }
    }

    // 4. Any leftover amount goes to the ledger (reduces outstanding or becomes credit)
    if (remaining > 0) {
      await tx.creditCustomer.update({
        where: { id: customer.id },
        data: { total_outstanding: { decrement: remaining } }
      });
    }

    const txn = await tx.creditTransaction.create({
      data: {
        customer_id: customer.id,
        shop_id: shop.id,
        type: 'payment_received',
        amount: data.amount,
        payment_method: (data.payment_method ?? 'cash') as any,
        reference_no: data.reference_no,
        notes: data.notes || `Settle dues for ${customer.name}`,
        transaction_date: new Date(),
        created_by: userId,
      },
    });

    await tx.incomeEntry.create({
      data: {
        shop_id: shop.id,
        entry_type: 'sale_income' as any,
        amount: data.amount,
        payment_method: (data.payment_method ?? 'cash') as any,
        entry_date: new Date(),
        notes: `Credit Repayment - ${customer.name}`,
        created_by: userId,
      }
    });

    return txn;
  });
}

export async function updateCreditCustomer(userId: string, id: string, data: any) {
  const shop = await getShopOrThrow(userId);
  const exists = await prisma.creditCustomer.findFirst({ where: { id, shop_id: shop.id } });
  if (!exists) throw new AppError(404, 'NOT_FOUND', 'Credit customer not found');

  return prisma.creditCustomer.update({
    where: { id },
    data: {
      name: data.name ?? exists.name,
      phone: data.phone ?? exists.phone,
      address: data.address ?? exists.address,
      notes: data.notes ?? exists.notes,
    },
  });
}


// ─────────────────────────────────────────────────────────────────────────────
//  Outstandings (Unified)
// ─────────────────────────────────────────────────────────────────────────────

export async function listOutstandings(userId: string) {
  try {
    const shop = await getShopOrThrow(userId);

    // 1. Credit Customers (Receivables)
    const rawCustomers = await prisma.creditCustomer.findMany({
      where: { shop_id: shop.id },
      orderBy: { total_outstanding: 'desc' },
    });

    const customers = rawCustomers.map(c => ({
      ...c,
      total_outstanding: Number(c.total_outstanding || 0)
    }));

    // 1.1 Pending Bills (Direct Receivables)
    const pendingBills = await prisma.bill.groupBy({
      by: ['customer_name', 'customer_phone'],
      where: { shop_id: shop.id, payment_status: 'pending' },
      _sum: { total_amount: true },
    });

    for (const pb of pendingBills) {
      const name = pb.customer_name || 'Walk-in Customer';
      const phone = pb.customer_phone;
      const amount = Number(pb._sum.total_amount || 0);

      // Check for overlap with existing CreditCustomer (by phone if available, or exact name)
      const match = customers.find(c =>
        (phone && c.phone === phone) || (!phone && !c.phone && c.name === name)
      );

      if (match) {
        match.total_outstanding += amount;
      } else {
        customers.push({
          id: `pending-${phone || name}`,
          name: name,
          phone: phone,
          total_outstanding: amount,
          notes: 'Pending bills',
          updated_at: new Date(),
        } as any);
      }
    }

    // 2. Suppliers (Payables)
    const suppliers = await prisma.supplier.findMany({
      where: { shop_id: shop.id, is_active: true },
      select: { id: true, name: true, phone: true, address: true, updated_at: true },
    });

    const purchaseSums = await prisma.purchaseEntry.groupBy({
      by: ['supplier_id'],
      where: { shop_id: shop.id, supplier_id: { not: null } },
      _sum: { total_amount: true },
    });

    const paymentSums = await prisma.supplierPayment.groupBy({
      by: ['supplier_id'],
      where: { shop_id: shop.id },
      _sum: { amount: true },
    });

    const returnSums = await prisma.purchaseReturn.groupBy({
      by: ['supplier_id'],
      where: { shop_id: shop.id, supplier_id: { not: null } },
      _sum: { total_amount: true },
    });

    const suppliersWithStats = suppliers.map((s) => {
      const totalPurchased = Number(purchaseSums.find((p) => p.supplier_id === s.id)?._sum.total_amount ?? 0);
      const totalPaid = Number(paymentSums.find((p) => p.supplier_id === s.id)?._sum.amount ?? 0);
      const totalReturned = Number(returnSums.find((p) => p.supplier_id === s.id)?._sum.total_amount ?? 0);
      return {
        ...s,
        total_outstanding: totalPurchased - totalPaid - totalReturned,
      };
    }).filter(s => Math.abs(s.total_outstanding) > 0.01);

    return {
      receivables: customers,
      payables: suppliersWithStats.sort((a, b) => b.total_outstanding - a.total_outstanding),
    };
  } catch (err) {
    logger.error('Error in listOutstandings:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Reports
// ─────────────────────────────────────────────────────────────────────────────

export async function getProfitAndLoss(userId: string, from: string, to: string) {
  const shop = await getShopOrThrow(userId);
  const dateFilter = { gte: new Date(from), lte: new Date(to) };

  const [salesIncome, otherIncome, allPurchasesInRange, allReturnsInRange, allExpenses] = await Promise.all([
    // Revenue: bill payments received in range
    prisma.incomeEntry.aggregate({
      where: { shop_id: shop.id, entry_type: 'sale_income', entry_date: dateFilter },
      _sum: { amount: true },
    }),
    // Other income
    prisma.incomeEntry.aggregate({
      where: { shop_id: shop.id, entry_type: { not: 'sale_income' }, entry_date: dateFilter },
      _sum: { amount: true },
    }),
    // COGS — sum of purchase total_amount for received_date in range
    prisma.purchaseEntry.aggregate({
      where: { shop_id: shop.id, received_date: dateFilter },
      _sum: { total_amount: true },
    }),
    // Returns adjustment for COGS
    prisma.purchaseReturn.aggregate({
      where: { shop_id: shop.id, return_date: dateFilter },
      _sum: { total_amount: true },
    }),
    // Expenses (manual only)
    prisma.expenseEntry.groupBy({
      by: ['category'],
      where: { shop_id: shop.id, entry_date: dateFilter, linked_purchase_id: null },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(salesIncome._sum.amount ?? 0) + Number(otherIncome._sum.amount ?? 0);
  const costOfPurchases = Number(allPurchasesInRange._sum.total_amount ?? 0);
  const costOfReturns = Number(allReturnsInRange._sum.total_amount ?? 0);
  const cogs = costOfPurchases - costOfReturns;
  const grossProfit = totalRevenue - cogs;

  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  for (const e of allExpenses) {
    const amt = Number(e._sum.amount ?? 0);
    expensesByCategory[e.category] = amt;
    totalExpenses += amt;
  }

  const netProfit = grossProfit - totalExpenses;

  return {
    period: { from, to },
    revenue: {
      sales_income: Number(salesIncome._sum.amount ?? 0),
      other_income: Number(otherIncome._sum.amount ?? 0),
      total: totalRevenue,
    },
    cogs: { medicine_purchase_cost: cogs },
    gross_profit: grossProfit,
    gross_margin_pct: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0,
    expenses: { ...expensesByCategory, total: totalExpenses },
    net_profit: netProfit,
    net_margin_pct: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0,
  };
}

export async function getSalesSummary(userId: string, month: number, year: number) {
  const shop = await getShopOrThrow(userId);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const [totalSales, billCount, paymentSplit, topMedicines] = await Promise.all([
    prisma.incomeEntry.aggregate({
      where: { shop_id: shop.id, entry_type: 'sale_income', entry_date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.bill.count({
      where: { shop_id: shop.id, payment_status: 'paid', created_at: { gte: start, lte: end } },
    }),
    prisma.incomeEntry.groupBy({
      by: ['payment_method'],
      where: { shop_id: shop.id, entry_type: 'sale_income', entry_date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.billItem.groupBy({
      by: ['medicine_name'],
      where: { bill: { shop_id: shop.id, payment_status: 'paid', created_at: { gte: start, lte: end } } },
      _sum: { quantity: true, line_total: true },
      orderBy: { _sum: { line_total: 'desc' } },
      take: 10,
    }),
  ]);

  return {
    period: { month, year },
    total_sales: Number(totalSales._sum.amount ?? 0),
    bill_count: billCount,
    payment_split: paymentSplit.map((p) => ({ method: p.payment_method, amount: Number(p._sum.amount ?? 0) })),
    top_medicines: topMedicines.map((m) => ({
      name: m.medicine_name,
      qty_sold: Number(m._sum.quantity ?? 0),
      revenue: Number(m._sum.line_total ?? 0),
    })),
  };
}

export async function getDetailedSalesReport(userId: string, from: string, to: string) {
  const shop = await getShopOrThrow(userId);
  const startDate = new Date(from);
  const endDate = new Date(to);
  endDate.setHours(23, 59, 59, 999);

  // Get all bills in the date range
  const bills = await prisma.bill.findMany({
    where: {
      shop_id: shop.id,
      created_at: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      bill_number: true,
      subtotal: true,
      gst_amount: true,
      discount_amount: true,
      total_amount: true,
      payment_status: true,
      payment_method: true,
      created_at: true,
      customer_name: true,
      customer_phone: true,
    },
    orderBy: { created_at: 'desc' },
  });

  // Aggregate calculations
  const totalBills = bills.length;
  const paidBills = bills.filter((b) => b.payment_status === 'paid').length;
  const pendingBills = bills.filter((b) => b.payment_status === 'pending').length;
  const partialBills = bills.filter((b) => b.payment_status === 'partial').length;

  const totalSales = bills.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const totalGst = bills.reduce((sum, b) => sum + Number(b.gst_amount), 0);
  const totalDiscount = bills.reduce((sum, b) => sum + Number(b.discount_amount), 0);
  const totalSubtotal = bills.reduce((sum, b) => sum + Number(b.subtotal), 0);

  // Payment method breakdown
  const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
  bills.forEach((bill) => {
    const method = bill.payment_method || 'unknown';
    if (!paymentBreakdown[method]) {
      paymentBreakdown[method] = { count: 0, amount: 0 };
    }
    paymentBreakdown[method].count++;
    paymentBreakdown[method].amount += Number(bill.total_amount);
  });

  // Daily breakdown
  const dailyBreakdown: Record<string, { bills: number; sales: number; gst: number; discount: number }> = {};
  bills.forEach((bill) => {
    const dateKey = bill.created_at.toISOString().split('T')[0];
    if (!dailyBreakdown[dateKey]) {
      dailyBreakdown[dateKey] = { bills: 0, sales: 0, gst: 0, discount: 0 };
    }
    dailyBreakdown[dateKey].bills++;
    dailyBreakdown[dateKey].sales += Number(bill.total_amount);
    dailyBreakdown[dateKey].gst += Number(bill.gst_amount);
    dailyBreakdown[dateKey].discount += Number(bill.discount_amount);
  });

  // Top medicines sold
  const topMedicines = await prisma.billItem.groupBy({
    by: ['medicine_name'],
    where: { bill: { shop_id: shop.id, created_at: { gte: startDate, lte: endDate } } },
    _sum: { quantity: true, line_total: true, mrp: true },
    orderBy: { _sum: { line_total: 'desc' } },
    take: 20,
  });

  // Bill status breakdown
  const statusBreakdown = {
    paid: paidBills,
    pending: pendingBills,
    partial: partialBills,
  };

  return {
    date_range: { from, to },
    summary: {
      total_bills: totalBills,
      total_sales: totalSales,
      total_gst_collected: totalGst,
      total_discount_given: totalDiscount,
      average_bill_value: totalBills > 0 ? totalSales / totalBills : 0,
    },
    status_breakdown: statusBreakdown,
    payment_breakdown: Object.entries(paymentBreakdown).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
    })),
    daily_sales: Object.entries(dailyBreakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        bills: data.bills,
        sales: data.sales,
        gst: data.gst,
        discount: data.discount,
      })),
    top_medicines: topMedicines.map((m) => ({
      name: m.medicine_name,
      quantity_sold: Number(m._sum.quantity ?? 0),
      revenue: Number(m._sum.line_total ?? 0),
    })),
  };
}

export async function getStockValuation(userId: string) {
  const shop = await getShopOrThrow(userId);
  const inventory = await prisma.shopInventory.findMany({
    where: { shop_id: shop.id, stock_qty: { gt: 0 } },
    select: {
      medicine_name: true,
      batch_number: true,
      stock_qty: true,
      purchase_price: true,
      mrp: true,
      expiry_date: true,
    },
    orderBy: { medicine_name: 'asc' },
  });

  const items = inventory.map((inv) => ({
    medicine_name: inv.medicine_name,
    batch_number: inv.batch_number,
    in_stock: inv.stock_qty,
    purchase_price: Number(inv.purchase_price ?? 0),
    mrp: Number(inv.mrp),
    stock_value_cost: Number(inv.purchase_price ?? 0) * inv.stock_qty,
    stock_value_mrp: Number(inv.mrp) * inv.stock_qty,
    expiry_date: inv.expiry_date,
  }));

  const totalCostValue = items.reduce((s, i) => s + i.stock_value_cost, 0);
  const totalMrpValue = items.reduce((s, i) => s + i.stock_value_mrp, 0);

  return { items, total_cost_value: totalCostValue, total_mrp_value: totalMrpValue, item_count: items.length };
}

export async function getGstSummary(userId: string, month: number, year: number) {
  const shop = await getShopOrThrow(userId);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  // Outward supplies — sales bills
  const billItems = await prisma.billItem.findMany({
    where: { bill: { shop_id: shop.id, payment_status: 'paid', created_at: { gte: start, lte: end } } },
    select: { mrp: true, quantity: true, gst_rate: true, line_total: true },
  });

  // Group by GST rate
  const outwardByRate: Record<string, { taxable: number; gst: number; count: number }> = {};
  let totalOutwardTaxable = 0;
  let totalGstCollected = 0;

  for (const item of billItems) {
    const rate = String(Number(item.gst_rate));
    // In our system, line_total is the taxable value (price after discount, before GST)
    const taxable = Number(item.line_total);
    const gst = taxable * (Number(item.gst_rate) / 100);
    if (!outwardByRate[rate]) outwardByRate[rate] = { taxable: 0, gst: 0, count: 0 };
    outwardByRate[rate].taxable += taxable;
    outwardByRate[rate].gst += gst;
    outwardByRate[rate].count += 1;
    totalOutwardTaxable += taxable;
    totalGstCollected += gst;
  }

  // Inward supplies — purchases (ITC)
  const purchaseItems = await prisma.purchaseItem.findMany({
    where: { purchase: { shop_id: shop.id, received_date: { gte: start, lte: end } } },
    select: { purchase_price: true, quantity: true, discount_pct: true, gst_rate: true },
  });

  let totalITC = 0;
  for (const item of purchaseItems) {
    const base = Number(item.purchase_price) * item.quantity * (1 - Number(item.discount_pct) / 100);
    const gst = base * (Number(item.gst_rate) / 100);
    totalITC += gst;
  }

  const netTaxPayable = Math.max(0, totalGstCollected - totalITC);

  return {
    period: { month, year },
    outward_supplies: {
      taxable_value: Math.round(totalOutwardTaxable * 100) / 100,
      gst_collected: {
        cgst: Math.round((totalGstCollected / 2) * 100) / 100,
        sgst: Math.round((totalGstCollected / 2) * 100) / 100,
        igst: 0,
      },
      total_gst_collected: Math.round(totalGstCollected * 100) / 100,
    },
    inward_supplies: {
      itc_available: {
        cgst: Math.round((totalITC / 2) * 100) / 100,
        sgst: Math.round((totalITC / 2) * 100) / 100,
      },
      total_itc: Math.round(totalITC * 100) / 100,
    },
    net_tax_payable: Math.round(netTaxPayable * 100) / 100,
    rate_wise_summary: Object.entries(outwardByRate).map(([rate, data]) => ({
      gst_rate: Number(rate),
      taxable_value: Math.round(data.taxable * 100) / 100,
      gst_amount: Math.round(data.gst * 100) / 100,
    })),
  };
}

export async function getDailyCashRegister(userId: string, date: string) {
  const shop = await getShopOrThrow(userId);
  const registerDate = new Date(date);
  const nextDay = new Date(registerDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const [existing, cashSales, cashExpenses, cashSupplierPaid] = await Promise.all([
    prisma.dailyCashRegister.findUnique({ where: { shop_id_register_date: { shop_id: shop.id, register_date: registerDate } } }),
    prisma.incomeEntry.aggregate({
      where: { shop_id: shop.id, payment_method: 'cash', entry_date: { gte: registerDate, lt: nextDay } },
      _sum: { amount: true },
    }),
    prisma.expenseEntry.aggregate({
      where: { shop_id: shop.id, payment_method: 'cash', entry_date: { gte: registerDate, lt: nextDay } },
      _sum: { amount: true },
    }),
    prisma.supplierPayment.aggregate({
      where: { shop_id: shop.id, payment_method: 'cash', payment_date: { gte: registerDate, lt: nextDay } },
      _sum: { amount: true },
    }),
  ]);

  const cashSalesTotal = Number(cashSales._sum.amount ?? 0);
  const cashExpensesTotal = Number(cashExpenses._sum.amount ?? 0);
  const cashSupplierTotal = Number(cashSupplierPaid._sum.amount ?? 0);
  const openingBalance = Number(existing?.opening_balance ?? 0);
  const expectedClosing = openingBalance + cashSalesTotal - cashExpensesTotal - cashSupplierTotal;

  return {
    register_date: date,
    existing: existing ?? null,
    computed: {
      opening_balance: openingBalance,
      cash_sales_total: cashSalesTotal,
      cash_expenses_total: cashExpensesTotal,
      cash_supplier_paid: cashSupplierTotal,
      expected_closing_balance: Math.round(expectedClosing * 100) / 100,
    },
  };
}

export async function closeCashRegister(userId: string, date: string, actual_closing_bal: number, notes?: string) {
  const shop = await getShopOrThrow(userId);
  const registerDate = new Date(date);
  const nextDay = new Date(registerDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const [cashSales, cashExpenses, cashSupplierPaid] = await Promise.all([
    prisma.incomeEntry.aggregate({
      where: { shop_id: shop.id, payment_method: 'cash', entry_date: { gte: registerDate, lt: nextDay } },
      _sum: { amount: true },
    }),
    prisma.expenseEntry.aggregate({
      where: { shop_id: shop.id, payment_method: 'cash', entry_date: { gte: registerDate, lt: nextDay }, linked_purchase_id: null },
      _sum: { amount: true },
    }),
    prisma.supplierPayment.aggregate({
      where: { shop_id: shop.id, payment_method: 'cash', payment_date: { gte: registerDate, lt: nextDay } },
      _sum: { amount: true },
    }),
  ]);

  // Get opening balance from previous day's register
  const prevDate = new Date(registerDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevRegister = await prisma.dailyCashRegister.findUnique({
    where: { shop_id_register_date: { shop_id: shop.id, register_date: prevDate } },
  });

  const openingBalance = Number(prevRegister?.actual_closing_bal ?? 0);
  const cashSalesTotal = Number(cashSales._sum.amount ?? 0);
  const cashExpensesTotal = Number(cashExpenses._sum.amount ?? 0);
  const cashSupplierTotal = Number(cashSupplierPaid._sum.amount ?? 0);
  const expectedClosing = openingBalance + cashSalesTotal - cashExpensesTotal - cashSupplierTotal;
  const variance = actual_closing_bal - expectedClosing;

  return prisma.dailyCashRegister.upsert({
    where: { shop_id_register_date: { shop_id: shop.id, register_date: registerDate } },
    create: {
      shop_id: shop.id,
      register_date: registerDate,
      opening_balance: openingBalance,
      cash_sales_total: cashSalesTotal,
      cash_expenses_total: cashExpensesTotal,
      cash_supplier_paid: cashSupplierTotal,
      expected_closing_bal: expectedClosing,
      actual_closing_bal,
      variance,
      closed_by: userId,
      closed_at: new Date(),
      notes,
    },
    update: {
      actual_closing_bal,
      variance,
      closed_by: userId,
      closed_at: new Date(),
      notes,
    },
  });
}

export async function getPaymentSplit(userId: string, from: string, to: string) {
  const shop = await getShopOrThrow(userId);
  const dateFilter = { gte: new Date(from), lte: new Date(to) };

  const split = await prisma.incomeEntry.groupBy({
    by: ['payment_method'],
    where: { shop_id: shop.id, entry_date: dateFilter },
    _sum: { amount: true },
    _count: { id: true },
  });

  const total = split.reduce((s, p) => s + Number(p._sum.amount ?? 0), 0);

  return {
    period: { from, to },
    total,
    breakdown: split.map((p) => ({
      method: p.payment_method,
      amount: Number(p._sum.amount ?? 0),
      transaction_count: p._count.id,
      percentage: total > 0 ? Math.round((Number(p._sum.amount ?? 0) / total) * 1000) / 10 : 0,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sale Returns
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSaleReturnInput {
  bill_id?: string;
  customer_name?: string;
  return_date?: string;
  refund_method?: string;
  reason?: string;
  notes?: string;
  items: {
    medicine_name: string;
    batch_number?: string;
    quantity: number;
    mrp: number;
    gst_rate?: number;
    discount_pct?: number;
  }[];
}

export async function createSaleReturn(userId: string, input: CreateSaleReturnInput) {
  const shop = await getShopOrThrow(userId);
  const itemsWithTotals = input.items.map((item) => {
    const gstRate = item.gst_rate ?? 12;
    const discPct = item.discount_pct ?? 0;
    const lineTotal = item.mrp * item.quantity * (1 - discPct / 100);
    return { ...item, gst_rate: gstRate, discount_pct: discPct, line_total: lineTotal };
  });
  const totalAmount = itemsWithTotals.reduce((s, i) => s + i.line_total, 0);
  const seq = await prisma.saleReturn.count({ where: { shop_id: shop.id } });
  const returnNumber = `SR-${String(seq + 1).padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const ret = await tx.saleReturn.create({
      data: {
        shop_id: shop.id,
        return_number: returnNumber,
        bill_id: input.bill_id ?? null,
        customer_name: input.customer_name,
        return_date: new Date(input.return_date ?? new Date()),
        total_amount: totalAmount,
        refund_method: (input.refund_method ?? 'cash') as any,
        reason: input.reason,
        notes: input.notes,
        created_by: userId,
        items: {
          create: itemsWithTotals.map((i) => ({
            medicine_name: i.medicine_name,
            batch_number: i.batch_number ?? null,
            quantity: i.quantity,
            mrp: i.mrp,
            gst_rate: i.gst_rate,
            discount_pct: i.discount_pct,
            line_total: i.line_total,
          })),
        },
      },
      include: { items: true },
    });
    // Restock inventory for returned items
    for (const item of itemsWithTotals) {
      if (item.batch_number) {
        const inv = await tx.shopInventory.findFirst({
          where: { shop_id: shop.id, medicine_name: item.medicine_name, batch_number: item.batch_number },
        });
        if (inv) {
          await tx.shopInventory.update({ where: { id: inv.id }, data: { stock_qty: { increment: item.quantity } } });
        }
      }
    }
    return ret;
  });
}

export async function listSaleReturns(userId: string, opts: { from?: string; to?: string; page?: number; limit?: number }) {
  const shop = await getShopOrThrow(userId);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 30;
  const where: Prisma.SaleReturnWhereInput = {
    shop_id: shop.id,
    ...(opts.from || opts.to ? { return_date: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(opts.to) } : {}) } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.saleReturn.count({ where }),
    prisma.saleReturn.findMany({ where, include: { items: true }, orderBy: { return_date: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSaleReturnById(userId: string, id: string) {
  const shop = await getShopOrThrow(userId);
  return prisma.saleReturn.findFirst({
    where: { id, shop_id: shop.id },
    include: { items: true, shop: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Purchase Returns
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePurchaseReturnInput {
  supplier_id?: string;
  purchase_entry_id?: string;
  invoice_ref?: string;
  return_date?: string;
  reason?: string;
  notes?: string;
  items: {
    medicine_name: string;
    batch_number?: string;
    quantity: number;
    purchase_price: number;
    gst_rate?: number;
  }[];
}

export async function createPurchaseReturn(userId: string, input: CreatePurchaseReturnInput) {
  const shop = await getShopOrThrow(userId);
  const itemsWithTotals = input.items.map((item) => {
    const gstRate = item.gst_rate ?? 12;
    const lineTotal = item.purchase_price * item.quantity * (1 + gstRate / 100);
    return { ...item, gst_rate: gstRate, line_total: lineTotal };
  });
  const totalAmount = itemsWithTotals.reduce((s, i) => s + i.line_total, 0);
  const seq = await prisma.purchaseReturn.count({ where: { shop_id: shop.id } });
  const returnNumber = `PR-${String(seq + 1).padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const ret = await tx.purchaseReturn.create({
      data: {
        shop_id: shop.id,
        return_number: returnNumber,
        supplier_id: input.supplier_id ?? null,
        purchase_entry_id: input.purchase_entry_id ?? null,
        invoice_ref: input.invoice_ref,
        return_date: new Date(input.return_date ?? new Date()),
        total_amount: totalAmount,
        reason: input.reason,
        notes: input.notes,
        created_by: userId,
        items: {
          create: itemsWithTotals.map((i) => ({
            medicine_name: i.medicine_name,
            batch_number: i.batch_number ?? null,
            quantity: i.quantity,
            purchase_price: i.purchase_price,
            gst_rate: i.gst_rate,
            line_total: i.line_total,
          })),
        },
      },
      include: { items: true, supplier: { select: { id: true, name: true } } },
    });
    // Reduce stock for returned items
    for (const item of itemsWithTotals) {
      if (item.batch_number) {
        const inv = await tx.shopInventory.findFirst({
          where: { shop_id: shop.id, medicine_name: item.medicine_name, batch_number: item.batch_number },
        });
        if (inv) {
          await tx.shopInventory.update({ where: { id: inv.id }, data: { stock_qty: Math.max(0, inv.stock_qty - item.quantity) } });
        }
      }
    }
    return ret;
  });
}

export async function listPurchaseReturns(userId: string, opts: { from?: string; to?: string; page?: number; limit?: number }) {
  const shop = await getShopOrThrow(userId);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 30;
  const where: Prisma.PurchaseReturnWhereInput = {
    shop_id: shop.id,
    ...(opts.from || opts.to ? { return_date: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(opts.to) } : {}) } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.purchaseReturn.count({ where }),
    prisma.purchaseReturn.findMany({ where, include: { items: true, supplier: { select: { id: true, name: true } } }, orderBy: { return_date: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPurchaseReturnById(userId: string, id: string) {
  const shop = await getShopOrThrow(userId);
  const data = await prisma.purchaseReturn.findFirst({
    where: { id, shop_id: shop.id },
    include: {
      items: true,
      supplier: { select: { id: true, name: true, phone: true, address: true, city: true, state: true, gst_number: true } },
      purchase_entry: { select: { id: true, invoice_number: true, invoice_date: true } },
    },
  });
  if (!data) throw new AppError(404, 'NOT_FOUND', 'Purchase return not found');
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contra Entries
// ─────────────────────────────────────────────────────────────────────────────

export async function createContraEntry(userId: string, input: {
  from_account: string;
  to_account: string;
  amount: number;
  entry_date?: string;
  description?: string;
  reference_no?: string;
}) {
  const shop = await getShopOrThrow(userId);
  if (input.from_account === input.to_account) {
    throw new AppError(400, 'VALIDATION_ERROR', 'From and To account cannot be the same');
  }
  return prisma.contraEntry.create({
    data: {
      shop_id: shop.id,
      from_account: input.from_account as any,
      to_account: input.to_account as any,
      amount: input.amount,
      entry_date: new Date(input.entry_date ?? new Date()),
      description: input.description,
      reference_no: input.reference_no,
      created_by: userId,
    },
  });
}

export async function listContraEntries(userId: string, opts: { from?: string; to?: string; page?: number; limit?: number }) {
  const shop = await getShopOrThrow(userId);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const where: Prisma.ContraEntryWhereInput = {
    shop_id: shop.id,
    ...(opts.from || opts.to ? { entry_date: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(opts.to) } : {}) } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.contraEntry.count({ where }),
    prisma.contraEntry.findMany({ where, orderBy: { entry_date: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Cashbook
// ─────────────────────────────────────────────────────────────────────────────

type LedgerLine = { date: string; type: string; narration: string; debit: number; credit: number; method: string };

export async function getCashbook(userId: string, opts: { from: string; to: string }) {
  const shop = await getShopOrThrow(userId);
  const dateFilter = { gte: new Date(opts.from), lte: new Date(opts.to) };
  const [income, expenses, supplierPay, saleRets, contras] = await Promise.all([
    prisma.incomeEntry.findMany({ where: { shop_id: shop.id, payment_method: 'cash', entry_date: dateFilter }, orderBy: { entry_date: 'asc' } }),
    prisma.expenseEntry.findMany({ where: { shop_id: shop.id, payment_method: 'cash', entry_date: dateFilter }, orderBy: { entry_date: 'asc' } }),
    prisma.supplierPayment.findMany({ where: { shop_id: shop.id, payment_method: 'cash', payment_date: dateFilter }, include: { supplier: { select: { name: true } } }, orderBy: { payment_date: 'asc' } }),
    prisma.saleReturn.findMany({ where: { shop_id: shop.id, refund_method: 'cash', return_date: dateFilter }, orderBy: { return_date: 'asc' } }),
    prisma.contraEntry.findMany({ where: { shop_id: shop.id, entry_date: dateFilter }, orderBy: { entry_date: 'asc' } }),
  ]);
  const lines: LedgerLine[] = [];
  for (const e of income) lines.push({ date: e.entry_date.toISOString().slice(0, 10), type: 'income', narration: `Sales / ${e.entry_type}`, debit: 0, credit: Number(e.amount), method: 'cash' });
  for (const e of expenses) lines.push({ date: e.entry_date.toISOString().slice(0, 10), type: 'expense', narration: `Expense: ${e.category}${e.description ? ' — ' + e.description : ''}`, debit: Number(e.amount), credit: 0, method: 'cash' });
  for (const p of supplierPay) lines.push({ date: p.payment_date.toISOString().slice(0, 10), type: 'supplier_payment', narration: `Supplier Payment${p.supplier ? ' — ' + p.supplier.name : ''}`, debit: Number(p.amount), credit: 0, method: 'cash' });
  for (const r of saleRets) lines.push({ date: r.return_date.toISOString().slice(0, 10), type: 'sale_return', narration: `Sale Return ${r.return_number}${r.customer_name ? ' — ' + r.customer_name : ''}`, debit: Number(r.total_amount), credit: 0, method: 'cash' });
  for (const c of contras) {
    if (c.from_account === 'cash') lines.push({ date: c.entry_date.toISOString().slice(0, 10), type: 'contra', narration: `Contra: Cash → ${c.to_account}${c.description ? ' — ' + c.description : ''}`, debit: Number(c.amount), credit: 0, method: 'cash' });
    if (c.to_account === 'cash') lines.push({ date: c.entry_date.toISOString().slice(0, 10), type: 'contra', narration: `Contra: ${c.from_account} → Cash${c.description ? ' — ' + c.description : ''}`, debit: 0, credit: Number(c.amount), method: 'cash' });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return { from: opts.from, to: opts.to, lines, total_debit: Math.round(totalDebit * 100) / 100, total_credit: Math.round(totalCredit * 100) / 100, net: Math.round((totalCredit - totalDebit) * 100) / 100 };
}

export async function getBankbook(userId: string, opts: { from: string; to: string; method?: string }) {
  const shop = await getShopOrThrow(userId);
  const dateFilter = { gte: new Date(opts.from), lte: new Date(opts.to) };
  const bankMethods: any[] = opts.method ? [opts.method] : ['upi', 'neft', 'cheque', 'card'];
  const [income, expenses, supplierPay, contras] = await Promise.all([
    prisma.incomeEntry.findMany({ where: { shop_id: shop.id, payment_method: { in: bankMethods }, entry_date: dateFilter }, orderBy: { entry_date: 'asc' } }),
    prisma.expenseEntry.findMany({ where: { shop_id: shop.id, payment_method: { in: bankMethods }, entry_date: dateFilter }, orderBy: { entry_date: 'asc' } }),
    prisma.supplierPayment.findMany({ where: { shop_id: shop.id, payment_method: { in: bankMethods }, payment_date: dateFilter }, include: { supplier: { select: { name: true } } }, orderBy: { payment_date: 'asc' } }),
    prisma.contraEntry.findMany({ where: { shop_id: shop.id, entry_date: dateFilter }, orderBy: { entry_date: 'asc' } }),
  ]);
  const lines: LedgerLine[] = [];
  for (const e of income) lines.push({ date: e.entry_date.toISOString().slice(0, 10), type: 'income', narration: `Sales / ${e.entry_type}`, debit: 0, credit: Number(e.amount), method: e.payment_method });
  for (const e of expenses) lines.push({ date: e.entry_date.toISOString().slice(0, 10), type: 'expense', narration: `Expense: ${e.category}${e.description ? ' — ' + e.description : ''}`, debit: Number(e.amount), credit: 0, method: e.payment_method });
  for (const p of supplierPay) lines.push({ date: p.payment_date.toISOString().slice(0, 10), type: 'supplier_payment', narration: `Supplier Payment${p.supplier ? ' — ' + p.supplier.name : ''}`, debit: Number(p.amount), credit: 0, method: p.payment_method });
  for (const c of contras) {
    if (bankMethods.includes(c.from_account)) lines.push({ date: c.entry_date.toISOString().slice(0, 10), type: 'contra', narration: `Contra: ${c.from_account} → ${c.to_account}${c.description ? ' — ' + c.description : ''}`, debit: Number(c.amount), credit: 0, method: String(c.from_account) });
    if (bankMethods.includes(c.to_account)) lines.push({ date: c.entry_date.toISOString().slice(0, 10), type: 'contra', narration: `Contra: ${c.from_account} → ${c.to_account}${c.description ? ' — ' + c.description : ''}`, debit: 0, credit: Number(c.amount), method: String(c.to_account) });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return { from: opts.from, to: opts.to, lines, total_debit: Math.round(totalDebit * 100) / 100, total_credit: Math.round(totalCredit * 100) / 100, net: Math.round((totalCredit - totalDebit) * 100) / 100 };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Backup & Restore
// ─────────────────────────────────────────────────────────────────────────────

export async function exportAccountingData(userId: string) {
  const shop = await getShopOrThrow(userId);
  const [
    suppliers,
    purchases,
    payments,
    income,
    expenses,
    customers,
    cashRegisters,
    saleReturns,
    purchaseReturns,
    contras
  ] = await Promise.all([
    prisma.supplier.findMany({ where: { shop_id: shop.id } }),
    prisma.purchaseEntry.findMany({ where: { shop_id: shop.id }, include: { items: true } }),
    prisma.supplierPayment.findMany({ where: { shop_id: shop.id } }),
    prisma.incomeEntry.findMany({ where: { shop_id: shop.id } }),
    prisma.expenseEntry.findMany({ where: { shop_id: shop.id } }),
    prisma.creditCustomer.findMany({ where: { shop_id: shop.id }, include: { transactions: true } }),
    prisma.dailyCashRegister.findMany({ where: { shop_id: shop.id } }),
    prisma.saleReturn.findMany({ where: { shop_id: shop.id }, include: { items: true } }),
    prisma.purchaseReturn.findMany({ where: { shop_id: shop.id }, include: { items: true } }),
    prisma.contraEntry.findMany({ where: { shop_id: shop.id } }),
  ]);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    shop_id: shop.id,
    data: {
      suppliers,
      purchases,
      payments,
      income,
      expenses,
      customers,
      cashRegisters,
      saleReturns,
      purchaseReturns,
      contras
    }
  };
}

export async function restoreAccountingData(userId: string, backup: any) {
  const shop = await getShopOrThrow(userId);
  const data = backup.data;

  if (!data) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid backup format');

  return prisma.$transaction(async (tx) => {
    // 1. Delete ALL existing accounting records for this shop
    // Order matters for foreign keys
    await tx.saleReturnItem.deleteMany({ where: { return: { shop_id: shop.id } } });
    await tx.saleReturn.deleteMany({ where: { shop_id: shop.id } });
    await tx.purchaseReturnItem.deleteMany({ where: { return: { shop_id: shop.id } } });
    await tx.purchaseReturn.deleteMany({ where: { shop_id: shop.id } });
    await tx.contraEntry.deleteMany({ where: { shop_id: shop.id } });
    await tx.dailyCashRegister.deleteMany({ where: { shop_id: shop.id } });
    await tx.creditTransaction.deleteMany({ where: { shop_id: shop.id } });
    await tx.creditCustomer.deleteMany({ where: { shop_id: shop.id } });
    await tx.expenseEntry.deleteMany({ where: { shop_id: shop.id } });
    await tx.incomeEntry.deleteMany({ where: { shop_id: shop.id } });
    await tx.supplierPayment.deleteMany({ where: { shop_id: shop.id } });
    await tx.purchaseItem.deleteMany({ where: { purchase: { shop_id: shop.id } } });
    await tx.purchaseEntry.deleteMany({ where: { shop_id: shop.id } });
    await tx.supplier.deleteMany({ where: { shop_id: shop.id } });

    // 2. Restore data

    // Suppliers
    if (data.suppliers?.length) {
      await tx.supplier.createMany({
        data: data.suppliers.map((s: any) => ({ ...s, shop_id: shop.id }))
      });
    }

    // Purchase Entries & Items
    if (data.purchases?.length) {
      for (const p of data.purchases) {
        const { items, ...entryData } = p;
        await tx.purchaseEntry.create({
          data: {
            ...entryData,
            shop_id: shop.id,
            items: {
              create: items.map((i: any) => ({ ...i, id: undefined, purchase_id: undefined }))
            }
          }
        });
      }
    }

    // Payments
    if (data.payments?.length) {
      await tx.supplierPayment.createMany({
        data: data.payments.map((p: any) => ({ ...p, shop_id: shop.id }))
      });
    }

    // Income
    if (data.income?.length) {
      await tx.incomeEntry.createMany({
        data: data.income.map((i: any) => ({ ...i, shop_id: shop.id }))
      });
    }

    // Expenses
    if (data.expenses?.length) {
      await tx.expenseEntry.createMany({
        data: data.expenses.map((e: any) => ({ ...e, shop_id: shop.id }))
      });
    }

    // Credit Customers & Transactions
    if (data.customers?.length) {
      for (const c of data.customers) {
        const { transactions, ...customerData } = c;
        await tx.creditCustomer.create({
          data: {
            ...customerData,
            shop_id: shop.id,
            transactions: {
              create: transactions.map((t: any) => ({ ...t, id: undefined, customer_id: undefined, shop_id: shop.id }))
            }
          }
        });
      }
    }

    // Cash Registers
    if (data.cashRegisters?.length) {
      await tx.dailyCashRegister.createMany({
        data: data.cashRegisters.map((cr: any) => ({ ...cr, shop_id: shop.id }))
      });
    }

    // Sale Returns
    if (data.saleReturns?.length) {
      for (const sr of data.saleReturns) {
        const { items, ...returnData } = sr;
        await tx.saleReturn.create({
          data: {
            ...returnData,
            shop_id: shop.id,
            items: {
              create: items.map((i: any) => ({ ...i, id: undefined, return_id: undefined }))
            }
          }
        });
      }
    }

    // Purchase Returns
    if (data.purchaseReturns?.length) {
      for (const pr of data.purchaseReturns) {
        const { items, ...returnData } = pr;
        await tx.purchaseReturn.create({
          data: {
            ...returnData,
            shop_id: shop.id,
            items: {
              create: items.map((i: any) => ({ ...i, id: undefined, return_id: undefined }))
            }
          }
        });
      }
    }

    // Contras
    if (data.contras?.length) {
      await tx.contraEntry.createMany({
        data: data.contras.map((c: any) => ({ ...c, shop_id: shop.id }))
      });
    }

    return { message: 'Accounting data successfully restored' };
  });
}

// ─── Local Drive Backups (Server-side files) ──────────────────────────────────

export async function getShopBackupFolder(userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const sanitizedName = (shop.shop_name || 'shop').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const customPath = '/rxdesk'; // Default since backup_path is not in schema
  const resolvedRoot = path.isAbsolute(customPath) ? customPath : path.resolve(customPath);
  return path.join(resolvedRoot, sanitizedName);
}

export async function listLocalBackups(userId: string) {
  const shopFolder = await getShopBackupFolder(userId);
  try {
    const files = await fs.readdir(shopFolder);
    const backups = files
      .filter(f => f.startsWith('rxdesk_backup_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    const details = await Promise.all(backups.map(async f => {
      try {
        const stats = await fs.stat(path.join(shopFolder, f));
        return {
          filename: f,
          size: stats.size,
          date: stats.mtime
        };
      } catch { return null; }
    }));
    return details.filter(Boolean);
  } catch (e) {
    return [];
  }
}

export async function getBackupFilePath(userId: string, filename: string) {
  const shopFolder = await getShopBackupFolder(userId);
  const filePath = path.join(shopFolder, filename);
  // Security check: ensure file is within the shop folder
  const resolved = path.resolve(filePath);
  const resolvedFolder = path.resolve(shopFolder);
  if (!resolved.startsWith(resolvedFolder)) throw new AppError(403, 'FORBIDDEN', 'Invalid file path');
  await fs.access(filePath);
  return filePath;
}

export async function triggerManualLocalBackup(userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const data = await exportAccountingData(userId);
  const shopFolder = await getShopBackupFolder(userId);
  await fs.mkdir(shopFolder, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `rxdesk_backup_${timestamp}_manual.json`;
  const filePath = path.join(shopFolder, fileName);

  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return { filename: fileName, path: filePath };
}

export async function generateGstr1Excel(userId: string, month: number, year: number) {
  const shop = await getShopOrThrow(userId);
  const shopStateNormalized = normalizeState(shop.state);
  
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const bills = await prisma.bill.findMany({
    where: { shop_id: shop.id, payment_status: 'paid', created_at: { gte: start, lte: end } },
    include: { items: true },
    orderBy: { created_at: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  
  // 1. B2b Sheet
  const b2bSheet = workbook.addWorksheet('B2b');
  b2bSheet.columns = [
    { header: 'GSTIN/UIN of Recipient*', key: 'gstin', width: 20 },
    { header: 'Name of Recipient', key: 'name', width: 25 },
    { header: 'Invoice number *', key: 'inv_no', width: 15 },
    { header: 'Invoice Date*', key: 'inv_date', width: 15 },
    { header: 'Invoice value*', key: 'inv_val', width: 15 },
    { header: 'Place of Supply(POS)*', key: 'pos', width: 20 },
    { header: 'Applicable % of Tax Rate', key: 'tax_rate', width: 15 },
    { header: 'Reverse Charge*', key: 'rev_charge', width: 10 },
    { header: 'Invoice Type*', key: 'inv_type', width: 15 },
  ];

  // 2. B2c Sheet
  const b2cSheet = workbook.addWorksheet('B2c');
  b2cSheet.columns = [
    { header: 'Invoice number*', key: 'inv_no', width: 15 },
    { header: 'Invoice Date', key: 'inv_date', width: 15 },
    { header: 'Invoice value*', key: 'inv_val', width: 15 },
    { header: 'Applicable % of Tax Rate', key: 'applicable_pct', width: 15 },
    { header: 'Place of Supply(POS)*', key: 'pos', width: 20 },
    { header: 'Rate*', key: 'rate', width: 10 },
    { header: 'Taxable Value*', key: 'taxable_val', width: 15 },
    { header: 'Cess Amount', key: 'cess', width: 12 },
  ];

  // 3. HSNB2B Sheet
  const hsnB2bSheet = workbook.addWorksheet('HSNB2B');
  const hsnColumns = [
    { header: 'HSN*', key: 'hsn', width: 15 },
    { header: 'Description', key: 'desc', width: 25 },
    { header: 'UQC*', key: 'uqc', width: 10 },
    { header: 'Total Quantity*', key: 'qty', width: 15 },
    { header: 'Total Value', key: 'total_val', width: 15 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value*', key: 'taxable_val', width: 15 },
    { header: 'Integrated Tax Amount', key: 'igst', width: 15 },
    { header: 'Central Tax Amount', key: 'cgst', width: 15 },
    { header: 'State/UT Tax Amount', key: 'sgst', width: 15 },
    { header: 'Cess Amount', key: 'cess', width: 12 },
  ];
  hsnB2bSheet.columns = hsnColumns;

  // 4. HSNB2C Sheet
  const hsnB2cSheet = workbook.addWorksheet('HSNB2C');
  hsnB2cSheet.columns = hsnColumns;

  // 5. CDNR Sheet (Credit/Debit Note - Registered)
  const cdnrSheet = workbook.addWorksheet('CDNR');
  cdnrSheet.columns = [
    { header: 'GSTIN/UIN of Recipient', key: 'gstin', width: 20 },
    { header: 'Receiver Name', key: 'name', width: 25 },
    { header: 'Note/Refund Voucher Number', key: 'note_no', width: 20 },
    { header: 'Note/Refund Voucher Date', key: 'note_date', width: 15 },
    { header: 'Note/Refund Voucher Value', key: 'note_val', width: 15 },
    { header: 'Place of Supply (POS)', key: 'pos', width: 20 },
    { header: 'Note Type', key: 'note_type', width: 10 },
    { header: 'Applicable % of Tax Rate', key: 'applicable_pct', width: 15 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_val', width: 15 },
    { header: 'Cess Amount', key: 'cess', width: 12 },
    { header: 'Pre GST', key: 'pre_gst', width: 10 },
  ];

  // 6. CDNUR Sheet (Credit/Debit Note - Unregistered)
  const cdnurSheet = workbook.addWorksheet('CDNUR');
  cdnurSheet.columns = [
    { header: 'UR Type', key: 'ur_type', width: 15 },
    { header: 'Note/Refund Voucher Number', key: 'note_no', width: 20 },
    { header: 'Note/Refund Voucher Date', key: 'note_date', width: 15 },
    { header: 'Note/Refund Voucher Value', key: 'note_val', width: 15 },
    { header: 'Place Of Supply (POS)', key: 'pos', width: 20 },
    { header: 'Note Type', key: 'note_type', width: 10 },
    { header: 'Applicable % of Tax Rate', key: 'applicable_pct', width: 15 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_val', width: 15 },
    { header: 'Cess Amount', key: 'cess', width: 12 },
    { header: 'Pre GST', key: 'pre_gst', width: 10 },
  ];

  // 7. CDNRA Sheet (Amended Credit/Debit Note)
  const cdnraSheet = workbook.addWorksheet('CDNRA');
  cdnraSheet.columns = [
    { header: 'Original Note/Refund Voucher Number', key: 'orig_note_no', width: 20 },
    { header: 'Original Note/Refund Voucher Date', key: 'orig_note_date', width: 15 },
    { header: 'GSTIN/UIN of Recipient', key: 'gstin', width: 20 },
    { header: 'Receiver Name', key: 'name', width: 25 },
    { header: 'Revised Note/Refund Voucher Number', key: 'rev_note_no', width: 20 },
    { header: 'Revised Note/Refund Voucher Date', key: 'rev_note_date', width: 15 },
    { header: 'Revised Note Value', key: 'rev_note_val', width: 15 },
    { header: 'Place Of Supply (POS)', key: 'pos', width: 20 },
    { header: 'Note Type', key: 'note_type', width: 10 },
    { header: 'Applicable % of Tax Rate', key: 'applicable_pct', width: 15 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_val', width: 15 },
    { header: 'Cess Amount', key: 'cess', width: 12 },
    { header: 'Pre GST', key: 'pre_gst', width: 10 },
  ];

  // Formatting: Bold headers for all sheets
  [b2bSheet, b2cSheet, hsnB2bSheet, hsnB2cSheet, cdnrSheet, cdnurSheet, cdnraSheet].forEach(sheet => {
    sheet.getRow(1).font = { bold: true };
  });

  const hsnSummaryB2B: Record<string, any> = {};
  const hsnSummaryB2C: Record<string, any> = {};

  for (const bill of bills) {
    const isB2B = !!bill.customer_gstin;
    const billingStateNormalized = normalizeState(bill.billing_state || shop.state);
    const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;
    const pos = bill.billing_state || shop.state || 'N/A';
    const dateStr = bill.created_at.toISOString().split('T')[0];

    if (isB2B) {
      // Group by tax rate for B2B if needed, but standard GSTR-1 lists per rate per invoice
      // For now, follow the requested columns per bill item if they have different rates
      const rates = Array.from(new Set(bill.items.map(i => Number(i.gst_rate))));
      for (const rate of rates) {
        const itemsAtRate = bill.items.filter(i => Number(i.gst_rate) === rate);
        const taxableAtRate = itemsAtRate.reduce((sum, item) => sum + Number(item.line_total), 0);
        const invValue = Number(bill.total_amount);
        
        b2bSheet.addRow({
          gstin: bill.customer_gstin,
          name: bill.customer_name || 'Walk-in',
          inv_no: bill.bill_number,
          inv_date: dateStr,
          inv_val: invValue,
          pos: pos,
          tax_rate: rate,
          rev_charge: 'N',
          inv_type: 'Regular',
        });
      }
    } else {
      const rates = Array.from(new Set(bill.items.map(i => Number(i.gst_rate))));
      for (const rate of rates) {
        const itemsAtRate = bill.items.filter(i => Number(i.gst_rate) === rate);
        const taxableAtRate = itemsAtRate.reduce((sum, item) => sum + Number(item.line_total), 0);
        const gstAmt = (taxableAtRate * rate) / 100;
        
        b2cSheet.addRow({
          inv_no: bill.bill_number,
          inv_date: dateStr,
          inv_val: taxableAtRate + gstAmt,
          applicable_pct: '',
          pos: pos,
          rate: rate,
          taxable_val: taxableAtRate,
          cess: 0,
        });
      }
    }

    // HSN Summary logic
    for (const item of bill.items) {
      const hsn = item.hsn_code || 'N/A';
      const taxableVal = Number(item.line_total);
      const rate = Number(item.gst_rate);
      const totalGst = (taxableVal * rate) / 100;
      
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterState) igst = totalGst;
      else { cgst = totalGst / 2; sgst = totalGst / 2; }

      const summary = isB2B ? hsnSummaryB2B : hsnSummaryB2C;
      const key = `${hsn}_${rate}`;

      if (!summary[key]) {
        summary[key] = {
          hsn,
          desc: item.medicine_name,
          uqc: 'OTH', // Default UQC
          qty: 0,
          total_val: 0,
          rate: rate,
          taxable_val: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0
        };
      }
      summary[key].qty += item.quantity;
      summary[key].taxable_val += taxableVal;
      summary[key].igst += igst;
      summary[key].cgst += cgst;
      summary[key].sgst += sgst;
      summary[key].total_val += (taxableVal + totalGst);
    }
  }

  // Populate HSN Sheets
  Object.values(hsnSummaryB2B).forEach(s => hsnB2bSheet.addRow(s));
  Object.values(hsnSummaryB2C).forEach(s => hsnB2cSheet.addRow(s));

  // --- Sale Returns (Credit Notes) ---
  const saleReturns = await prisma.saleReturn.findMany({
    where: { shop_id: shop.id, return_date: { gte: start, lte: end } },
    include: { items: true },
    orderBy: { return_date: 'asc' },
  });

  // Get associated bills to check for GSTIN (no formal relation in schema yet, so fetch manually)
  const billIdsSet = new Set(saleReturns.map(r => r.bill_id).filter(Boolean) as string[]);
  const associatedBills = await prisma.bill.findMany({
    where: { id: { in: Array.from(billIdsSet) } },
    select: { id: true, customer_gstin: true, billing_state: true }
  });
  const billInfoMap = new Map(associatedBills.map(b => [b.id, b]));

  for (const ret of saleReturns) {
    const bill = ret.bill_id ? billInfoMap.get(ret.bill_id) : null;
    const gstin = bill?.customer_gstin;
    const isB2B = !!gstin;
    const billingStateNormalized = normalizeState(bill?.billing_state || shop.state);
    const pos = bill?.billing_state || shop.state || 'N/A';
    const dateStr = ret.return_date.toISOString().split('T')[0];
    const totalVal = Number(ret.total_amount);

    // Group items by rate
    const rates = Array.from(new Set(ret.items.map(i => Number(i.gst_rate))));
    for (const rate of rates) {
      const itemsAtRate = ret.items.filter(i => Number(i.gst_rate) === rate);
      const taxableAtRate = itemsAtRate.reduce((sum, item) => sum + Number(item.line_total), 0);
      
      if (isB2B) {
        cdnrSheet.addRow({
          gstin: gstin,
          name: ret.customer_name || 'Registered Customer',
          note_no: ret.return_number,
          note_date: dateStr,
          note_val: totalVal,
          pos: pos,
          note_type: 'C',
          applicable_pct: '',
          rate: rate,
          taxable_val: taxableAtRate,
          cess: 0,
          pre_gst: 'N',
        });
      } else {
        cdnurSheet.addRow({
          ur_type: 'B2CS', // Default to B2CS for retail medical sales
          note_no: ret.return_number,
          note_date: dateStr,
          note_val: totalVal,
          pos: pos,
          note_type: 'C',
          applicable_pct: '',
          rate: rate,
          taxable_val: taxableAtRate,
          cess: 0,
          pre_gst: 'N',
        });
      }
    }
  }

  return workbook.xlsx.writeBuffer();
}


export async function generateGstr2Excel(userId: string, month: number, year: number) {
  const shop = await getShopOrThrow(userId);
  const shopStateNormalized = normalizeState(shop.state);
  
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  // Fetch Purchases (B2B, B2BUR)
  const purchases = await prisma.purchaseEntry.findMany({
    where: { shop_id: shop.id, received_date: { gte: start, lte: end } },
    include: { items: true, supplier: true },
    orderBy: { received_date: 'asc' },
  });

  // Fetch Purchase Returns (CDNR, CDNUR)
  const purchaseReturns = await prisma.purchaseReturn.findMany({
    where: { shop_id: shop.id, return_date: { gte: start, lte: end } },
    include: { items: true, supplier: true },
    orderBy: { return_date: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  
  // 1. B2B Sheet (Registered Suppliers)
  const b2bSheet = workbook.addWorksheet('B2B');
  b2bSheet.columns = [
    { header: 'GSTIN of Supplier', key: 'gstin', width: 20 },
    { header: 'Supplier Name', key: 'name', width: 25 },
    { header: 'Invoice Number', key: 'inv_no', width: 15 },
    { header: 'Invoice date', key: 'inv_date', width: 15 },
    { header: 'Invoice Value', key: 'inv_val', width: 15 },
    { header: 'Place Of Supply', key: 'pos', width: 20 },
    { header: 'Reverse Charge', key: 'rev_charge', width: 15 },
    { header: 'Invoice Type', key: 'inv_type', width: 15 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_val', width: 15 },
    { header: 'Integrated Tax Paid', key: 'igst', width: 15 },
    { header: 'Central Tax Paid', key: 'cgst', width: 15 },
    { header: 'State/UT Tax Paid', key: 'sgst', width: 15 },
    { header: 'Cess Paid', key: 'cess', width: 12 },
    { header: 'Eligibility For ITC', key: 'itc_eligibility', width: 20 },
    { header: 'Availed ITC Integrated Tax', key: 'itc_igst', width: 20 },
    { header: 'Availed ITC Central Tax', key: 'itc_cgst', width: 18 },
    { header: 'Availed ITC State/UT Tax', key: 'itc_sgst', width: 20 },
    { header: 'Availed ITC Cess', key: 'itc_cess', width: 15 },
  ];

  // 2. B2BUR Sheet (Unregistered Suppliers)
  const b2burSheet = workbook.addWorksheet('B2BUR');
  b2burSheet.columns = [
    { header: 'Supplier Name', key: 'name', width: 25 },
    { header: 'Invoice Number', key: 'inv_no', width: 15 },
    { header: 'Invoice date', key: 'inv_date', width: 15 },
    { header: 'Invoice Value', key: 'inv_val', width: 15 },
    { header: 'Place Of Supply', key: 'pos', width: 20 },
    { header: 'Supply Type', key: 'supply_type', width: 15 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_val', width: 15 },
    { header: 'Integrated Tax Paid', key: 'igst', width: 15 },
    { header: 'Central Tax Paid', key: 'cgst', width: 15 },
    { header: 'State/UT Tax Paid', key: 'sgst', width: 15 },
    { header: 'Cess Paid', key: 'cess', width: 12 },
    { header: 'Eligibility For ITC', key: 'itc_eligibility', width: 20 },
    { header: 'Availed ITC Integrated Tax', key: 'itc_igst', width: 20 },
    { header: 'Availed ITC Central Tax', key: 'itc_cgst', width: 18 },
    { header: 'Availed ITC State/UT Tax', key: 'itc_sgst', width: 20 },
    { header: 'Availed ITC Cess', key: 'itc_cess', width: 15 },
  ];

  // 3. CDNR Sheet (Credit/Debit Note - Registered)
  const cdnrSheet = workbook.addWorksheet('CDNR');
  cdnrSheet.columns = [
    { header: 'GSTIN of Supplier', key: 'gstin', width: 20 },
    { header: 'Note/Refund Voucher Number', key: 'note_no', width: 20 },
    { header: 'Note/Refund Voucher Date', key: 'note_date', width: 15 },
    { header: 'Note/Refund Voucher Value', key: 'note_val', width: 15 },
    { header: 'Place Of Supply', key: 'pos', width: 20 },
    { header: 'Note Type', key: 'note_type', width: 10 },
    { header: 'Reverse Charge', key: 'rev_charge', width: 15 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_val', width: 15 },
    { header: 'Integrated Tax Paid', key: 'igst', width: 15 },
    { header: 'Central Tax Paid', key: 'cgst', width: 15 },
    { header: 'State/UT Tax Paid', key: 'sgst', width: 15 },
    { header: 'Cess Paid', key: 'cess', width: 12 },
    { header: 'Eligibility For ITC', key: 'itc_eligibility', width: 20 },
    { header: 'Availed ITC Integrated Tax', key: 'itc_igst', width: 20 },
    { header: 'Availed ITC Central Tax', key: 'itc_cgst', width: 18 },
    { header: 'Availed ITC State/UT Tax', key: 'itc_sgst', width: 20 },
    { header: 'Availed ITC Cess', key: 'itc_cess', width: 15 },
  ];

  // 4. CDNUR Sheet (Credit/Debit Note - Unregistered)
  const cdnurSheet = workbook.addWorksheet('CDNUR');
  cdnurSheet.columns = [
    { header: 'Note/Refund Voucher Number', key: 'note_no', width: 20 },
    { header: 'Note/Refund Voucher Date', key: 'note_date', width: 15 },
    { header: 'Note/Refund Voucher Value', key: 'note_val', width: 15 },
    { header: 'Place Of Supply', key: 'pos', width: 20 },
    { header: 'Note Type', key: 'note_type', width: 10 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_val', width: 15 },
    { header: 'Integrated Tax Paid', key: 'igst', width: 15 },
    { header: 'Central Tax Paid', key: 'cgst', width: 15 },
    { header: 'State/UT Tax Paid', key: 'sgst', width: 15 },
    { header: 'Cess Paid', key: 'cess', width: 12 },
    { header: 'Eligibility For ITC', key: 'itc_eligibility', width: 20 },
    { header: 'Availed ITC Integrated Tax', key: 'itc_igst', width: 20 },
    { header: 'Availed ITC Central Tax', key: 'itc_cgst', width: 18 },
    { header: 'Availed ITC State/UT Tax', key: 'itc_sgst', width: 20 },
    { header: 'Availed ITC Cess', key: 'itc_cess', width: 15 },
  ];

  // Formatting: Bold headers
  [b2bSheet, b2burSheet, cdnrSheet, cdnurSheet].forEach(sheet => {
    sheet.getRow(1).font = { bold: true };
  });

  // Populate B2B & B2BUR
  for (const pur of purchases) {
    const isRegistered = !!pur.supplier?.gst_number;
    const supplierStateNormalized = normalizeState(pur.supplier?.state || shop.state);
    const isInterState = supplierStateNormalized && shopStateNormalized && supplierStateNormalized !== shopStateNormalized;
    const pos = pur.supplier?.state || shop.state || 'N/A';
    const dateStr = pur.invoice_date.toISOString().split('T')[0];

    // Group items by tax rate
    const rates = Array.from(new Set(pur.items.map(i => Number(i.gst_rate))));
    
    for (const rate of rates) {
      const itemsAtRate = pur.items.filter(i => Number(i.gst_rate) === rate);
      const totalLineAtRate = itemsAtRate.reduce((sum, item) => sum + Number(item.line_total), 0);
      const taxableAtRate = totalLineAtRate / (1 + rate / 100);
      const totalGst = totalLineAtRate - taxableAtRate;
      
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterState) igst = totalGst;
      else { cgst = totalGst / 2; sgst = totalGst / 2; }
      
      const rowData = {
        name: pur.supplier?.name || 'Unregistered Supplier',
        inv_no: pur.invoice_number || '-',
        inv_date: dateStr,
        inv_val: Number(pur.total_amount),
        pos: pos,
        rate: rate,
        taxable_val: taxableAtRate,
        igst: igst,
        cgst: cgst,
        sgst: sgst,
        cess: 0,
        itc_eligibility: 'Inputs',
        itc_igst: igst,
        itc_cgst: cgst,
        itc_sgst: sgst,
        itc_cess: 0,
      };

      if (isRegistered) {
        b2bSheet.addRow({
          ...rowData,
          gstin: pur.supplier?.gst_number,
          rev_charge: 'N',
          inv_type: 'Regular',
        });
      } else {
        b2burSheet.addRow({
          ...rowData,
          supply_type: isInterState ? 'Inter-State' : 'Intra-State',
        });
      }
    }
  }

  // Populate CDNR & CDNUR
  for (const ret of purchaseReturns) {
    const isRegistered = !!ret.supplier?.gst_number;
    const supplierStateNormalized = normalizeState(ret.supplier?.state || shop.state);
    const isInterState = supplierStateNormalized && shopStateNormalized && supplierStateNormalized !== shopStateNormalized;
    const pos = ret.supplier?.state || shop.state || 'N/A';
    const dateStr = ret.return_date.toISOString().split('T')[0];
    const totalVal = Number(ret.total_amount);

    // Group items by tax rate
    const rates = Array.from(new Set(ret.items.map(i => Number(i.gst_rate))));
    
    for (const rate of rates) {
      const itemsAtRate = ret.items.filter(i => Number(i.gst_rate) === rate);
      const totalLineAtRate = itemsAtRate.reduce((sum, item) => sum + Number(item.line_total), 0);
      const taxableAtRate = totalLineAtRate / (1 + rate / 100);
      const totalGst = totalLineAtRate - taxableAtRate;
      
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterState) igst = totalGst;
      else { cgst = totalGst / 2; sgst = totalGst / 2; }
      
      const rowData = {
        note_no: ret.return_number,
        note_date: dateStr,
        note_val: totalVal,
        pos: pos,
        note_type: 'D', // Typically D for purchase return (Debit Note)
        rate: rate,
        taxable_val: taxableAtRate,
        igst: igst,
        cgst: cgst,
        sgst: sgst,
        cess: 0,
        itc_eligibility: 'Inputs',
        itc_igst: igst,
        itc_cgst: cgst,
        itc_sgst: sgst,
        itc_cess: 0,
      };

      if (isRegistered) {
        cdnrSheet.addRow({
          ...rowData,
          gstin: ret.supplier?.gst_number,
          rev_charge: 'N',
        });
      } else {
        cdnurSheet.addRow(rowData);
      }
    }
  }

  return workbook.xlsx.writeBuffer();
}

export async function voidPurchase(userId: string, id: string) {
  const shop = await getShopOrThrow(userId);

  return await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchaseEntry.findUnique({
      where: { id, shop_id: shop.id },
      include: { items: true },
    });

    if (!purchase) throw new Error('Purchase record not found');

    // 1. Reverse Inventory
    for (const item of purchase.items) {
      await tx.shopInventory.updateMany({
        where: {
          shop_id: shop.id,
          medicine_name: { equals: item.medicine_name.trim(), mode: 'insensitive' },
          batch_number: { equals: (item.batch_number || '').trim(), mode: 'insensitive' },
        },
        data: {
          stock_qty: { decrement: item.quantity + (item.free_qty || 0) },
        },
      });
    }

    // 2. Remove associated payments/income/expense logs if any
    await tx.supplierPayment.deleteMany({ where: { purchase_id: id } });
    await tx.expenseEntry.deleteMany({ where: { linked_purchase_id: id } });

    // 3. Delete the purchase entry itself
    await tx.purchaseItem.deleteMany({ where: { purchase_id: id } });
    return await tx.purchaseEntry.delete({ where: { id } });
  });
}

export async function deleteCreditCustomer(userId: string, id: string) {
  const shop = await getShopOrThrow(userId);
  // We don't actually delete if there's history, usually just deactivate
  return await prisma.creditCustomer.updateMany({
    where: { id, shop_id: shop.id },
    data: { is_active: false },
  });
}

export async function deleteSaleReturn(userId: string, id: string) {
  const shop = await getShopOrThrow(userId);
  return await prisma.$transaction(async (tx) => {
    const sr = await tx.saleReturn.findUnique({
      where: { id, shop_id: shop.id },
      include: { items: true },
    });
    if (!sr) throw new Error('Return record not found');

    // Reverse Inventory (decrease what was returned)
    for (const item of sr.items) {
      await tx.shopInventory.updateMany({
        where: { shop_id: shop.id, medicine_name: item.medicine_name },
        data: { stock_qty: { decrement: item.quantity } },
      });
    }

    await tx.saleReturnItem.deleteMany({ where: { return_id: id } });
    return await tx.saleReturn.delete({ where: { id } });
  });
}

export async function deletePurchaseReturn(userId: string, id: string) {
  const shop = await getShopOrThrow(userId);
  return await prisma.$transaction(async (tx) => {
    const pr = await tx.purchaseReturn.findUnique({
      where: { id, shop_id: shop.id },
      include: { items: true },
    });
    if (!pr) throw new Error('Return record not found');

    // Reverse Inventory (increase what was taken out)
    for (const item of pr.items) {
      await tx.shopInventory.updateMany({
        where: { shop_id: shop.id, medicine_name: item.medicine_name },
        data: { stock_qty: { increment: item.quantity } },
      });
    }

    await tx.purchaseReturnItem.deleteMany({ where: { return_id: id } });
    return await tx.purchaseReturn.delete({ where: { id } });
  });
}

export async function deleteContraEntry(userId: string, id: string) {
  const shop = await getShopOrThrow(userId);
  return await prisma.contraEntry.deleteMany({
    where: { id, shop_id: shop.id },
  });
}

export async function updateContraEntry(userId: string, id: string, data: any) {
  const shop = await getShopOrThrow(userId);
  return await prisma.contraEntry.updateMany({
    where: { id, shop_id: shop.id },
    data: {
      from_account: data.from_account,
      to_account: data.to_account,
      amount: data.amount,
      entry_date: data.entry_date ? new Date(data.entry_date) : undefined,
      description: data.description,
      reference_no: data.reference_no,
    },
  });
}



