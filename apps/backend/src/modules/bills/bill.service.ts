import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import path from 'path';
import logger from '../../utils/logger';

const STATE_MAP: Record<string, string> = {
  'wb': 'west bengal',
  'mh': 'maharashtra',
  'ka': 'karnataka',
  'tn': 'tamil nadu',
  'dl': 'delhi',
  'up': 'uttar pradesh',
  'ap': 'andhra pradesh',
  'ts': 'telangana',
  'tg': 'telangana',
  'gj': 'gujarat',
  'rj': 'rajasthan',
  'mp': 'madhya pradesh',
  'br': 'bihar',
  'hr': 'haryana',
  'pb': 'punjab',
  'jk': 'jammu and kashmir',
  'kl': 'kerala',
  'od': 'odisha',
  'as': 'assam',
  'ct': 'chhattisgarh',
  'jh': 'jharkhand',
  'uk': 'uttarakhand',
  'hp': 'himachal pradesh',
  'ga': 'goa',
  'tr': 'tripura',
  'ml': 'meghalaya',
  'mn': 'manipur',
  'nl': 'nagaland',
  'ar': 'arunachal pradesh',
  'sk': 'sikkim',
  'mz': 'mizoram',
  'py': 'puducherry',
  'an': 'andaman and nicobar islands',
  'ch': 'chandigarh',
  'dn': 'dadra and nagar haveli and daman and diu',
  'ld': 'lakshadweep'
};

function normalizeState(s?: string | null): string {
  if (!s) return '';
  const cleaned = s.trim().toLowerCase();
  return STATE_MAP[cleaned] || cleaned;
}

async function generateBillNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.bill.count();
  return `DN-${year}-${String(count + 1).padStart(6, '0')}`;
}

export async function generateBillFromPrescription(
  prescriptionId: string,
  userId: string,
  overrides?: { discount_amount?: number; extra_items?: { medicine_name: string; mrp: number; quantity: number; gst_rate?: number }[] }
) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can generate bills');
  const isTaxInvoice = shop.gst_type === 'regular';

  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: {
      items: true,
      patient: { select: { id: true, full_name: true } },
      bill: { select: { id: true } },
    },
  });
  if (!prescription) throw new AppError(404, 'NOT_FOUND', 'Prescription not found');
  if (prescription.shop_id !== shop.id) throw new AppError(403, 'FORBIDDEN', 'Prescription not for your shop');
  if (prescription.bill) throw new AppError(409, 'PRESCRIPTION_DISPENSED', 'Bill already generated for this prescription');

  // Build bill items from prescription
  const billItems: {
    inventory_id?: string;
    medicine_name: string;
    hsn_code?: string;
    batch_number?: string;
    expiry_date?: Date;
    mrp: number;
    quantity: number;
    discount_type: 'percentage' | 'amount';
    discount_value: number;
    gst_rate: number;
    line_total: number;
  }[] = [];

  for (const item of prescription.items) {
    // Try to find matching inventory
    const inv = await prisma.shopInventory.findFirst({
      where: {
        shop_id: shop.id,
        medicine_name: { contains: item.medicine_name, mode: 'insensitive' },
        stock_qty: { gt: 0 },
      },
      orderBy: { expiry_date: 'asc' },
    });

    const mrp = inv ? Number(inv.mrp) : 0;
    const discountType = (inv?.discount_type as any) ?? 'percentage';
    const discountValue = inv ? Number(inv.discount_value) : 0;
    const sub = mrp * item.quantity;
    const disc = discountType === 'percentage' ? (sub * discountValue) / 100 : (item.quantity * discountValue);
    const gstRate = isTaxInvoice ? 12 : 0;
    const lineTotal = sub - disc;

    billItems.push({
      inventory_id: inv?.id,
      medicine_name: item.medicine_name,
      hsn_code: inv?.hsn_code ?? undefined,
      batch_number: inv?.batch_number ?? undefined,
      expiry_date: inv?.expiry_date ?? undefined,
      mrp,
      quantity: item.quantity,
      discount_type: discountType,
      discount_value: discountValue,
      gst_rate: gstRate,
      line_total: lineTotal,
    });

    // Deduct stock if inventory found
    if (inv) {
      const updatedInv = await prisma.shopInventory.update({
        where: { id: inv.id },
        data: { stock_qty: { decrement: item.quantity } },
      });
      // Fire low-stock notification if stock hits/falls below reorder level
      if (updatedInv.stock_qty <= updatedInv.reorder_level) {
        prisma.notification.create({
          data: {
            user_id: userId,
            title: 'Low Stock Alert',
            body: `${updatedInv.medicine_name} is running low — only ${updatedInv.stock_qty} unit(s) left (reorder level: ${updatedInv.reorder_level}).`,
            type: 'push',
            category: 'stock_alert',
            reference_id: updatedInv.id,
            reference_type: 'inventory',
          },
        }).catch((e) => logger.warn(`Stock alert (bill) failed: ${e?.message}`));
      }
    }
  }

  // Add extra items if provided
  if (overrides?.extra_items) {
    for (const extra of overrides.extra_items) {
      billItems.push({
        medicine_name: extra.medicine_name,
        mrp: extra.mrp,
        quantity: extra.quantity,
        discount_type: 'percentage',
        discount_value: 0,
        gst_rate: isTaxInvoice ? (extra.gst_rate ?? 12) : 0,
        line_total: extra.mrp * extra.quantity,
      });
    }
  }

  const subtotal = billItems.reduce((sum, i) => sum + (Number(i.mrp) * i.quantity), 0);
  const totalItemDiscounts = billItems.reduce((sum, i) => sum + (Number(i.mrp) * i.quantity - Number(i.line_total)), 0);
  const globalDiscount = Number(overrides?.discount_amount ?? 0);
  const totalDiscount = totalItemDiscounts + globalDiscount;
  const gstAmount = isTaxInvoice ? billItems.reduce((sum, i) => sum + (Number(i.line_total) * i.gst_rate) / 100, 0) : 0;
  const totalAmount = subtotal - totalDiscount + gstAmount;

  const bill = await prisma.bill.create({
    data: {
      prescription_id: prescriptionId,
      shop_id: shop.id,
      patient_id: prescription.patient_id,
      bill_number: await generateBillNumber(),
      subtotal,
      discount_amount: totalDiscount,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      staff_id: userId,
      items: { create: billItems },
    },
    include: { items: true, patient: { select: { full_name: true, user_id: true } } },
  });

  // Mark prescription as dispensed
  await prisma.prescription.update({ where: { id: prescriptionId }, data: { dispensed: true } });

  // ── In-app notification: bill generated → patient ────────────────────────
  const fmtAmt = `₹${Number(bill.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  prisma.notification.create({
    data: {
      user_id: bill.patient!.user_id,
      title: 'Bill Generated',
      body: `Bill ${bill.bill_number} of ${fmtAmt} has been generated at ${shop.shop_name}. Present at the counter to pay.`,
      type: 'push',
      category: 'bill_generated',
      reference_id: bill.id,
      reference_type: 'bill',
    },
  }).catch((e) => logger.warn(`Bill notification failed: ${e?.message}`));

  return bill;
}

// ── Manual / Walk-in Bill ─────────────────────────────────────────────────────

export async function createManualBill(
  userId: string,
  data: {
    customer_name?: string;
    customer_phone?: string;
    customer_gstin?: string;
    billing_address?: string;
    billing_state?: string;
    save_customer?: boolean;
    items: { medicine_name: string; mrp: number; quantity: number; gst_rate?: number; inventory_id?: string; discount_type?: 'percentage' | 'amount'; discount_value?: number; hsn_code?: string }[];
    discount_amount?: number;
    payment_method?: 'cash' | 'upi' | 'card' | 'credit' | 'pending';
    notes?: string;
  }
) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can create bills');
  const isTaxInvoice = shop.gst_type === 'regular';
  const shopStateNormalized = normalizeState(shop.state);
  const billingStateNormalized = normalizeState(data.billing_state);
  // IGST applies if the supply is to a different state
  const isInterState = billingStateNormalized && shopStateNormalized && billingStateNormalized !== shopStateNormalized;

  if (!data.items || data.items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one item is required');
  }

  for (const item of data.items) {
    if (!item.medicine_name || !item.medicine_name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Medicine name cannot be blank for any item');
    }
  }

  const billItems: {
    inventory_id?: string;
    medicine_name: string;
    hsn_code?: string;
    batch_number?: string;
    expiry_date?: Date;
    mrp: number;
    quantity: number;
    discount_type: 'percentage' | 'amount';
    discount_value: number;
    gst_rate: number;
    line_total: number;
  }[] = [];

  for (const item of data.items) {
    let remainingQty = item.quantity;
    const itemBatches: typeof billItems = [];
    const usedInventoryIds = new Set<string>();

    const itemDiscountType = item.discount_type ?? 'percentage';
    const itemDiscountValue = item.discount_value ?? 0;

    // 1. Try to fulfill from the specifically selected batch first
    if (item.inventory_id) {
      const inv = await prisma.shopInventory.findUnique({ where: { id: item.inventory_id } });
      if (inv) {
        const take = Math.min(inv.stock_qty, remainingQty);
        const discAmt = (itemDiscountType === 'percentage')
          ? (item.mrp * take * itemDiscountValue) / 100
          : (take * itemDiscountValue);

        itemBatches.push({
          inventory_id: inv.id,
          medicine_name: item.medicine_name,
          hsn_code: inv.hsn_code || undefined,
          batch_number: inv.batch_number || undefined,
          expiry_date: inv.expiry_date || undefined,
          mrp: item.mrp,
          quantity: take,
          discount_type: itemDiscountType,
          discount_value: itemDiscountValue,
          gst_rate: isTaxInvoice ? (item.gst_rate ?? 12) : 0,
          line_total: (item.mrp * take) - discAmt,
        });
        remainingQty -= take;
        usedInventoryIds.add(inv.id);
      }
    }

    // 2. Clear out other available batches (FEFO) if quantity still remains
    if (remainingQty > 0) {
      const otherBatches = await prisma.shopInventory.findMany({
        where: {
          shop_id: shop.id,
          id: { notIn: Array.from(usedInventoryIds) },
          medicine_name: { equals: item.medicine_name, mode: 'insensitive' },
          stock_qty: { gt: 0 },
        },
        orderBy: { expiry_date: 'asc' },
      });

      for (const b of otherBatches) {
        if (remainingQty <= 0) break;
        const take = Math.min(b.stock_qty, remainingQty);
        const discAmt = (itemDiscountType === 'percentage')
          ? (item.mrp * take * itemDiscountValue) / 100
          : (take * itemDiscountValue);

        itemBatches.push({
          inventory_id: b.id,
          medicine_name: item.medicine_name,
          hsn_code: b.hsn_code || undefined,
          batch_number: b.batch_number || undefined,
          expiry_date: b.expiry_date || undefined,
          mrp: item.mrp,
          quantity: take,
          discount_type: itemDiscountType,
          discount_value: itemDiscountValue,
          gst_rate: isTaxInvoice ? (item.gst_rate ?? 12) : 0,
          line_total: (item.mrp * take) - discAmt,
        });
        remainingQty -= take;
        usedInventoryIds.add(b.id);
      }
    }

    // 3. Absolute Fallback: if quantity still left, add the remainder to the last known batch (or generic)
    if (remainingQty > 0) {
      const discAmt = (itemDiscountType === 'percentage')
        ? (item.mrp * remainingQty * itemDiscountValue) / 100
        : (remainingQty * itemDiscountValue);

      itemBatches.push({
        medicine_name: item.medicine_name,
        hsn_code: item.hsn_code || undefined,
        mrp: item.mrp,
        quantity: remainingQty,
        discount_type: itemDiscountType,
        discount_value: itemDiscountValue,
        gst_rate: isTaxInvoice ? (item.gst_rate ?? 12) : 0,
        line_total: (item.mrp * remainingQty) - discAmt,
      });
    }

    // Deduct stock and add items to final list
    for (const ib of itemBatches) {
      billItems.push(ib);
      if (ib.inventory_id) {
        const updatedInv = await prisma.shopInventory.update({
          where: { id: ib.inventory_id },
          data: { stock_qty: { decrement: ib.quantity } },
        });

        if (updatedInv.stock_qty <= updatedInv.reorder_level) {
          prisma.notification.create({
            data: {
              user_id: userId,
              title: 'Low Stock Alert',
              body: `${updatedInv.medicine_name} is running low — only ${updatedInv.stock_qty} unit(s) left.`,
              type: 'push',
              category: 'stock_alert',
              reference_id: updatedInv.id,
              reference_type: 'inventory',
            },
          }).catch((e) => logger.warn(`Low-stock alert failed: ${e?.message}`));
        }
      }
    }
  }

  const subtotal = billItems.reduce((sum, i) => sum + (Number(i.mrp) * i.quantity), 0);
  const totalItemDiscounts = billItems.reduce((sum, i) => sum + (Number(i.mrp) * i.quantity - Number(i.line_total)), 0);
  const globalDiscount = Number(data.discount_amount ?? 0);
  const totalDiscount = totalItemDiscounts + globalDiscount;
  const gstAmount = isTaxInvoice ? billItems.reduce((sum, i) => sum + (Number(i.line_total) * i.gst_rate) / 100, 0) : 0;
  const totalAmount = subtotal - totalDiscount + gstAmount;
  const paymentMethod = data.payment_method ?? 'cash';
  const isPaid = paymentMethod !== 'pending';

  const bill = await prisma.$transaction(async (tx) => {
    const created = await tx.bill.create({
      data: {
        shop_id: shop.id,
        customer_name: data.customer_name ?? null,
        customer_phone: data.customer_phone ?? null,
        customer_gstin: data.customer_gstin ?? null,
        billing_address: data.billing_address ?? null,
        billing_state: data.billing_state ?? null,
        bill_number: await generateBillNumber(),
        subtotal,
        discount_amount: totalDiscount,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        payment_method: isPaid ? (paymentMethod as any) : 'cash',
        payment_status: isPaid ? 'paid' : 'pending',
        staff_id: userId,
        items: { create: billItems },
      },
      include: { items: true },
    });

    // Handle Persistent Customer Record (Quick Add)
    if (data.customer_phone && (data.customer_name || data.customer_gstin)) {
      const existing = await tx.creditCustomer.findFirst({
        where: { shop_id: shop.id, phone: data.customer_phone }
      });

      if (existing) {
        await tx.creditCustomer.update({
          where: { id: existing.id },
          data: {
            name: data.customer_name || existing.name,
            address: data.billing_address || existing.address,
          }
        });
      } else {
        await tx.creditCustomer.create({
          data: {
            shop_id: shop.id,
            name: data.customer_name || 'Walk-in Customer',
            phone: data.customer_phone,
            address: data.billing_address,
            total_outstanding: 0,
          }
        });
      }
    }

    // Auto-create IncomeEntry when paid immediately (not for credit)
    if (isPaid && paymentMethod !== 'credit') {
      await tx.incomeEntry.create({
        data: {
          shop_id: shop.id,
          entry_type: 'sale_income' as any,
          amount: totalAmount,
          payment_method: paymentMethod as any,
          reference_bill_id: created.id,
          entry_date: new Date(),
          notes: data.customer_name ? `Walk-in: ${data.customer_name}` : 'Walk-in sale',
          created_by: userId,
        },
      });
    }

    // Handle credit sale immediately
    if (isPaid && paymentMethod === 'credit') {
      // 1. Try to find/create credit customer
      let creditCustomer = await tx.creditCustomer.findFirst({
        where: {
          shop_id: shop.id,
          OR: [
            (data.customer_phone ? { phone: data.customer_phone } : {}),
            { name: data.customer_name || 'Walk-in Customer' }
          ].filter(o => Object.keys(o).length > 0) as any
        }
      });

      if (!creditCustomer) {
        creditCustomer = await tx.creditCustomer.create({
          data: {
            shop_id: shop.id,
            name: data.customer_name || 'Walk-in Customer',
            phone: data.customer_phone,
            total_outstanding: 0,
          }
        });
      }

      // 2. Create transaction
      await tx.creditTransaction.create({
        data: {
          customer_id: creditCustomer.id,
          shop_id: shop.id,
          type: 'credit_given',
          amount: totalAmount,
          notes: `Credit sale – Bill ${created.bill_number}`,
          bill_id: created.id,
          transaction_date: new Date(),
          created_by: userId,
        }
      });

      // 3. Update outstanding
      await tx.creditCustomer.update({
        where: { id: creditCustomer.id },
        data: { total_outstanding: { increment: totalAmount } }
      });
    }

    return created;
  });

  return bill;
}

export async function getBillById(billId: string, userId: string, userRole: string) {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      items: true,
      patient: { select: { full_name: true, user_id: true } },
      shop: { select: { shop_name: true, gst_number: true, address_line: true, contact_phone: true, owner_user_id: true } },
      prescription: { select: { id: true } },
    },
  });
  if (!bill) throw new AppError(404, 'NOT_FOUND', 'Bill not found');

  // Ownership check
  if (userRole === 'patient' && bill.patient?.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
  if (userRole === 'shop_owner' && bill.shop.owner_user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  return bill;
}

export async function markBillPaid(
  billId: string,
  userId: string,
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit'
) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can update payment status');

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { patient: { select: { id: true, full_name: true, user_id: true } } },
  });
  if (!bill) throw new AppError(404, 'NOT_FOUND', 'Bill not found');
  if (bill.shop_id !== shop.id) throw new AppError(403, 'FORBIDDEN', 'Bill not for your shop');

  const updatedBill = await prisma.$transaction(async (tx) => {
    const paid = await tx.bill.update({
      where: { id: billId },
      data: { payment_status: 'paid', payment_method: paymentMethod },
    });

    // Auto-create IncomeEntry so revenue is tracked in accounting module (not for credit)
    if (paymentMethod !== 'credit') {
      await tx.incomeEntry.create({
        data: {
          shop_id: shop.id,
          entry_type: 'sale_income' as any,
          amount: Number(bill.total_amount),
          payment_method: paymentMethod as any,
          reference_bill_id: billId,
          entry_date: new Date(),
          created_by: userId,
        },
      });
    }

    // Credit sale: create CreditTransaction + update/create CreditCustomer
    if (paymentMethod === 'credit') {
      let creditCustomer = await tx.creditCustomer.findFirst({
        where: {
          shop_id: shop.id,
          OR: [
            (bill.patient_id ? { patient_id: bill.patient_id } : {}),
            (bill.customer_phone ? { phone: bill.customer_phone } : {}),
            { name: bill.customer_name || bill.patient?.full_name || 'Walk-in Customer' }
          ].filter(o => Object.keys(o).length > 0) as any
        },
      });

      if (!creditCustomer) {
        creditCustomer = await tx.creditCustomer.create({
          data: {
            shop_id: shop.id,
            patient_id: bill.patient_id,
            name: bill.customer_name || bill.patient?.full_name || 'Walk-in Customer',
            phone: bill.customer_phone,
            total_outstanding: 0,
          },
        });
      }

      await tx.creditTransaction.create({
        data: {
          customer_id: creditCustomer.id,
          shop_id: shop.id,
          type: 'credit_given',
          amount: Number(bill.total_amount),
          notes: `Credit sale – Bill ${bill.bill_number}`,
          bill_id: billId,
          transaction_date: new Date(),
          created_by: userId,
        },
      });

      await tx.creditCustomer.update({
        where: { id: creditCustomer.id },
        data: { total_outstanding: { increment: Number(bill.total_amount) } },
      });
    }

    return paid;
  });

  return updatedBill;
}

// ── Bill History ──────────────────────────────────────────────────────────────

export interface ListBillsParams {
  page?: number;
  limit?: number;
  search?: string;           // bill_number or patient name
  status?: string;           // paid | pending | partial
  payment_method?: string;   // cash | upi | card | credit
  from_date?: string;        // ISO date string
  to_date?: string;          // ISO date string
  sort?: string;             // created_at | total_amount
  order?: 'asc' | 'desc';
}

export async function listBills(userId: string, params: ListBillsParams) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can view bills');

  const page = Math.max(params.page ?? 1, 1);
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 100);
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = { shop_id: shop.id };

  // Search by bill number or patient name
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { bill_number: { contains: q, mode: 'insensitive' } },
      { patient: { full_name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  // Payment status filter
  if (params.status && ['paid', 'pending', 'partial'].includes(params.status)) {
    where.payment_status = params.status;
  }

  // Payment method filter
  if (params.payment_method && ['cash', 'upi', 'card', 'credit'].includes(params.payment_method)) {
    where.payment_method = params.payment_method;
  }

  // Date range filter
  if (params.from_date || params.to_date) {
    where.created_at = {};
    if (params.from_date) where.created_at.gte = new Date(params.from_date);
    if (params.to_date) {
      const endDate = new Date(params.to_date);
      endDate.setHours(23, 59, 59, 999);
      where.created_at.lte = endDate;
    }
  }

  // Sorting
  const sortField = ['created_at', 'total_amount'].includes(params.sort ?? '') ? params.sort! : 'created_at';
  const sortOrder = params.order === 'asc' ? 'asc' : 'desc';

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: {
        patient: { select: { full_name: true, user_id: true } },
        items: { select: { id: true, medicine_name: true, hsn_code: true, batch_number: true, expiry_date: true, quantity: true, mrp: true, line_total: true, discount_type: true, discount_value: true, gst_rate: true } },
      },
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.bill.count({ where }),
  ]);

  return {
    bills,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

export async function getBillStats(userId: string, fromDate?: string, toDate?: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can view bill stats');

  const where: any = { shop_id: shop.id };
  if (fromDate || toDate) {
    where.created_at = {};
    if (fromDate) where.created_at.gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.created_at.lte = end;
    }
  }

  const [totals, statusCounts] = await Promise.all([
    prisma.bill.aggregate({
      where,
      _sum: { total_amount: true, gst_amount: true, discount_amount: true },
      _count: { id: true },
    }),
    prisma.bill.groupBy({
      by: ['payment_status'],
      where,
      _sum: { total_amount: true },
      _count: { id: true },
    }),
  ]);

  const byStatus: Record<string, { count: number; amount: number }> = {};
  for (const row of statusCounts) {
    byStatus[row.payment_status] = {
      count: row._count.id,
      amount: Number(row._sum.total_amount ?? 0),
    };
  }

  return {
    total_bills: totals._count.id,
    total_revenue: Number(totals._sum.total_amount ?? 0),
    total_gst: Number(totals._sum.gst_amount ?? 0),
    total_discount: Number(totals._sum.discount_amount ?? 0),
    paid: byStatus.paid ?? { count: 0, amount: 0 },
    pending: byStatus.pending ?? { count: 0, amount: 0 },
    partial: byStatus.partial ?? { count: 0, amount: 0 },
  };
}

export async function searchCustomersByPhone(userId: string, phone: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId }, select: { id: true } });
  if (!shop) return [];

  // 1. Search in CreditCustomer Master (Primary)
  const master = await prisma.creditCustomer.findMany({
    where: {
      shop_id: shop.id,
      phone: { startsWith: phone },
    },
    select: { name: true, phone: true, address: true },
    take: 5,
  });

  const masterResults = master.map(c => ({
    customer_name: c.name,
    customer_phone: c.phone || '',
    customer_gstin: null,
    billing_address: c.address,
    billing_state: null,
    source: 'master'
  }));

  // 2. Search in Bill History (Fallback for walk-ins not in master)
  const masterPhones = master.map(m => m.phone).filter(Boolean) as string[];
  const bills = await prisma.bill.findMany({
    where: {
      shop_id: shop.id,
      customer_phone: { startsWith: phone },
      ...(masterPhones.length > 0 ? { NOT: { customer_phone: { in: masterPhones } } } : {})
    },
    select: { customer_name: true, customer_phone: true, customer_gstin: true, billing_address: true, billing_state: true },
    distinct: ['customer_phone'],
    orderBy: { customer_phone: 'asc' },
    take: 5,
  });

  const billResults = bills.map(b => ({
    customer_name: b.customer_name,
    customer_phone: b.customer_phone || '',
    customer_gstin: b.customer_gstin,
    billing_address: b.billing_address,
    billing_state: b.billing_state,
    source: 'history'
  }));

  return [...masterResults, ...billResults];
}
