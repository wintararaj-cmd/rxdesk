import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import logger from '../../utils/logger';

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
    batch_number?: string;
    expiry_date?: Date;
    mrp: number;
    quantity: number;
    discount_pct: number;
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
    const gstRate = isTaxInvoice ? 12 : 0;
    const lineTotal = mrp * item.quantity;

    billItems.push({
      inventory_id: inv?.id,
      medicine_name: item.medicine_name,
      batch_number: inv?.batch_number ?? undefined,
      expiry_date: inv?.expiry_date ?? undefined,
      mrp,
      quantity: item.quantity,
      discount_pct: 0,
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
        discount_pct: 0,
        gst_rate: isTaxInvoice ? (extra.gst_rate ?? 12) : 0,
        line_total: extra.mrp * extra.quantity,
      });
    }
  }

  const subtotal = billItems.reduce((sum, i) => sum + i.line_total, 0);
  const discountAmount = overrides?.discount_amount ?? 0;
  const gstAmount = isTaxInvoice ? billItems.reduce((sum, i) => sum + (i.line_total * i.gst_rate) / 100, 0) : 0;
  const totalAmount = subtotal - discountAmount + gstAmount;

  const bill = await prisma.bill.create({
    data: {
      prescription_id: prescriptionId,
      shop_id: shop.id,
      patient_id: prescription.patient_id,
      bill_number: await generateBillNumber(),
      subtotal,
      discount_amount: discountAmount,
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
    items: { medicine_name: string; mrp: number; quantity: number; gst_rate?: number; inventory_id?: string }[];
    discount_amount?: number;
    payment_method?: 'cash' | 'upi' | 'card' | 'credit' | 'pending';
    notes?: string;
  }
) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can create bills');
  const isTaxInvoice = shop.gst_type === 'regular';

  if (!data.items || data.items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one item is required');
  }

  const billItems: {
    inventory_id?: string;
    medicine_name: string;
    batch_number?: string;
    expiry_date?: Date;
    mrp: number;
    quantity: number;
    discount_pct: number;
    gst_rate: number;
    line_total: number;
  }[] = [];

  for (const item of data.items) {
    let invId = item.inventory_id;
    let batchNumber: string | undefined;
    let expiryDate: Date | undefined;

    // Auto-resolve inventory if not provided
    if (!invId) {
      const inv = await prisma.shopInventory.findFirst({
        where: {
          shop_id: shop.id,
          medicine_name: { contains: item.medicine_name, mode: 'insensitive' },
          stock_qty: { gt: 0 },
        },
        orderBy: { expiry_date: 'asc' },
      });
      if (inv) {
        invId = inv.id;
        batchNumber = inv.batch_number ?? undefined;
        expiryDate = inv.expiry_date ?? undefined;
      }
    }

    const gstRate = isTaxInvoice ? (item.gst_rate ?? 12) : 0;
    const lineTotal = item.mrp * item.quantity;

    billItems.push({
      inventory_id: invId,
      medicine_name: item.medicine_name,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      mrp: item.mrp,
      quantity: item.quantity,
      discount_pct: 0,
      gst_rate: gstRate,
      line_total: lineTotal,
    });

    // Deduct stock
    if (invId) {
      const updatedInv = await prisma.shopInventory.update({
        where: { id: invId },
        data: { stock_qty: { decrement: item.quantity } },
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
        }).catch((e) => logger.warn(`Low-stock alert (manual bill) failed: ${e?.message}`));
      }
    }
  }

  const subtotal = billItems.reduce((sum, i) => sum + i.line_total, 0);
  const discountAmount = data.discount_amount ?? 0;
  const gstAmount = isTaxInvoice ? billItems.reduce((sum, i) => sum + (i.line_total * i.gst_rate) / 100, 0) : 0;
  const totalAmount = subtotal - discountAmount + gstAmount;
  const paymentMethod = data.payment_method ?? 'cash';
  const isPaid = paymentMethod !== 'pending';

  const bill = await prisma.$transaction(async (tx) => {
    const created = await tx.bill.create({
      data: {
        shop_id: shop.id,
        customer_name: data.customer_name ?? null,
        customer_phone: data.customer_phone ?? null,
        bill_number: await generateBillNumber(),
        subtotal,
        discount_amount: discountAmount,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        payment_method: isPaid ? (paymentMethod as any) : 'cash',
        payment_status: isPaid ? 'paid' : 'pending',
        staff_id: userId,
        items: { create: billItems },
      },
      include: { items: true },
    });

    // Auto-create IncomeEntry when paid immediately
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

    // Auto-create IncomeEntry so revenue is tracked in accounting module
    await tx.incomeEntry.create({
      data: {
        shop_id: shop.id,
        entry_type: 'sale_income' as any,
        amount: Number(bill.total_amount),
        payment_method: (paymentMethod === 'credit' ? 'cash' : paymentMethod) as any,
        reference_bill_id: billId,
        entry_date: new Date(),
        created_by: userId,
      },
    });

    // Credit sale: create CreditTransaction + update/create CreditCustomer
    if (paymentMethod === 'credit' && bill.patient_id) {
      const patient = await tx.patient.findUnique({
        where: { id: bill.patient_id },
        select: { id: true, full_name: true },
      });
      if (patient) {
        let creditCustomer = await tx.creditCustomer.findFirst({
          where: { shop_id: shop.id, patient_id: bill.patient_id },
        });

        if (!creditCustomer) {
          creditCustomer = await tx.creditCustomer.create({
            data: {
              shop_id: shop.id,
              patient_id: bill.patient_id,
              name: patient.full_name,
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
        items: { select: { id: true, medicine_name: true, quantity: true, mrp: true, line_total: true } },
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

  const bills = await prisma.bill.findMany({
    where: {
      shop_id: shop.id,
      customer_phone: { startsWith: phone },
    },
    select: { customer_name: true, customer_phone: true },
    distinct: ['customer_phone'],
    take: 8,
  });

  return bills.filter(b => b.customer_phone);
}
