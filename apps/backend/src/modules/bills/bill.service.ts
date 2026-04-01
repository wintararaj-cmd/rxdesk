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

async function generateBillNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.bill.count();
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

  const billItems: any[] = [];

  for (const item of prescription.items) {
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

    if (inv) {
      const updatedInv = await prisma.shopInventory.update({
        where: { id: inv.id },
        data: { stock_qty: { decrement: item.quantity } },
      });
      if (inv.shop_medicine_id) {
        const summary = await prisma.shopInventory.aggregate({
          where: { shop_medicine_id: inv.shop_medicine_id },
          _sum: { stock_qty: true }
        });
        const totalStock = Number(summary._sum.stock_qty || 0);
        const master = await prisma.shopMedicine.findUnique({ where: { id: inv.shop_medicine_id } });
        const reorderLevel = master?.reorder_level || 10;

        if (totalStock <= reorderLevel) {
          prisma.notification.create({
            data: {
              user_id: userId,
              title: 'Low Stock Alert',
              body: `${updatedInv.medicine_name} is running low — only ${totalStock} unit(s) left in total across all batches (reorder level: ${reorderLevel}).`,
              type: 'push',
              category: 'stock_alert',
              reference_id: inv.shop_medicine_id,
              reference_type: 'inventory',
            },
          }).catch((e) => logger.warn(`Stock alert (bill) failed: ${e?.message}`));
        }
      }
    }
  }

  if (overrides?.extra_items) {
    for (const extra of overrides.extra_items) {
      billItems.push({
        medicine_name: extra.medicine_name,
        mrp: extra.mrp,
        quantity: extra.quantity,
        discount_type: 'percentage',
        discount_value: 0,
        gst_rate: isTaxInvoice ? (extra.gst_rate ?? 5) : 0,
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

  const bill = await prisma.$transaction(async (tx) => {
    const billNumber = await generateBillNumber(tx);
    const created = await tx.bill.create({
      data: {
        prescription_id: prescriptionId,
        shop_id: shop.id,
        patient_id: prescription.patient_id,
        bill_number: billNumber,
        subtotal,
        discount_amount: totalDiscount,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        staff_id: userId,
        items: { create: billItems },
      },
      include: { items: true, patient: { select: { full_name: true, user_id: true } } },
    });

    await tx.prescription.update({ where: { id: prescriptionId }, data: { dispensed: true } });

    const fmtAmt = `₹${Number(created.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    tx.notification.create({
      data: {
        user_id: created.patient!.user_id,
        title: 'Bill Generated',
        body: `Bill ${created.bill_number} of ${fmtAmt} has been generated at ${shop.shop_name}. Present at the counter to pay.`,
        type: 'push',
        category: 'bill_generated',
        reference_id: created.id,
        reference_type: 'bill',
      },
    }).catch((e) => logger.warn(`Bill notification failed: ${e?.message}`));

    return created;
  });

  return bill;
}

export async function createManualBill(
  userId: string,
  data: {
    customer_name?: string;
    customer_phone?: string;
    customer_gstin?: string;
    billing_address?: string;
    billing_state?: string;
    items: { medicine_name: string; mrp: number; quantity: number; gst_rate?: number; inventory_id?: string; discount_type?: 'percentage' | 'amount'; discount_value?: number; hsn_code?: string }[];
    payment_method?: 'cash' | 'upi' | 'card' | 'credit' | 'pending';
    payment_status?: 'paid' | 'pending' | 'partial';
    discount_amount?: number;
  },
) {
  logger.info(`Creating manual bill for user ${userId}`, { itemsCount: data.items?.length });
  try {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
    if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can create bills');

  const isTaxInvoice = shop.gst_type === 'regular';
  const billItems: any[] = [];

  for (const item of data.items) {
    let remainingQty = item.quantity;
    const itemDiscountType = item.discount_type || 'percentage';
    const itemDiscountValue = item.discount_value || 0;

    if (item.inventory_id) {
      const inv = await prisma.shopInventory.findUnique({ where: { id: item.inventory_id } });
      if (inv) {
        const discAmt = itemDiscountType === 'percentage'
          ? (item.mrp * remainingQty * itemDiscountValue) / 100
          : (remainingQty * itemDiscountValue);

        billItems.push({
          inventory_id: inv.id,
          medicine_name: item.medicine_name,
          hsn_code: inv.hsn_code || undefined,
          batch_number: inv.batch_number || undefined,
          expiry_date: inv.expiry_date || undefined,
          mrp: item.mrp,
          quantity: remainingQty,
          discount_type: itemDiscountType,
          discount_value: itemDiscountValue,
          gst_rate: isTaxInvoice ? (item.gst_rate ?? 5) : 0,
          line_total: (Number(item.mrp) * remainingQty) - discAmt,
        });
      }
    } else {
      const discAmt = itemDiscountType === 'percentage'
        ? (item.mrp * remainingQty * itemDiscountValue) / 100
        : (remainingQty * itemDiscountValue);

      billItems.push({
        medicine_name: item.medicine_name,
        hsn_code: item.hsn_code || undefined,
        mrp: item.mrp,
        quantity: remainingQty,
        discount_type: itemDiscountType,
        discount_value: itemDiscountValue,
        gst_rate: isTaxInvoice ? (item.gst_rate ?? 5) : 0,
        line_total: (Number(item.mrp) * remainingQty) - discAmt,
      });
    }
  }

  const subtotal = billItems.reduce((sum, i) => sum + (Number(i.mrp) * i.quantity), 0);
  const totalItemDiscounts = billItems.reduce((sum, i) => sum + (Number(i.mrp) * i.quantity - Number(i.line_total)), 0);
  const globalDiscount = Number(data.discount_amount) || 0;
  const totalDiscount = totalItemDiscounts + globalDiscount;
  const gstAmount = isTaxInvoice ? billItems.reduce((sum, i) => sum + (Number(i.line_total) * i.gst_rate) / 100, 0) : 0;
  const totalAmount = subtotal - totalDiscount + gstAmount;

  const paymentMethod = data.payment_method ?? 'cash';
  const isPaid = paymentMethod !== 'pending';
  const paymentStatus = isPaid ? (data.payment_status || 'paid') : 'pending';

  const bill = await prisma.$transaction(async (tx) => {
    const billNumber = await generateBillNumber(tx);
    const created = await tx.bill.create({
      data: {
        shop_id: shop.id,
        bill_number: billNumber,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_gstin: data.customer_gstin,
        billing_address: data.billing_address,
        billing_state: data.billing_state,
        subtotal: subtotal.toFixed(2),
        discount_amount: totalDiscount.toFixed(2),
        gst_amount: gstAmount.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        payment_status: paymentStatus as any,
        payment_method: isPaid ? (paymentMethod as any) : 'cash',
        staff_id: userId,
        items: {
          create: billItems.map(bi => ({
            inventory_id: bi.inventory_id || null,
            medicine_name: bi.medicine_name,
            hsn_code: bi.hsn_code || null,
            batch_number: bi.batch_number || null,
            expiry_date: bi.expiry_date || null,
            mrp: Number(bi.mrp).toFixed(2),
            quantity: Math.floor(bi.quantity),
            discount_type: bi.discount_type || 'percentage',
            discount_value: Number(bi.discount_value).toFixed(2),
            gst_rate: Number(bi.gst_rate).toFixed(2),
            line_total: Number(bi.line_total).toFixed(2)
          }))
        },
      },
      include: { items: true },
    });

    for (const item of billItems) {
      if (item.inventory_id) {
        await tx.shopInventory.update({
          where: { id: item.inventory_id },
          data: { stock_qty: { decrement: item.quantity } },
        });
      }
    }

    if (isPaid && paymentMethod !== 'credit') {
      await tx.incomeEntry.create({
        data: {
          shop_id: shop.id,
          entry_type: 'sale_income' as any,
          amount: totalAmount,
          payment_method: paymentMethod as any,
          reference_bill_id: created.id,
          entry_date: new Date(),
          created_by: userId,
        },
      });
    }

    if (paymentMethod === 'credit') {
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

      await tx.creditTransaction.create({
        data: {
          customer_id: creditCustomer.id,
          shop_id: shop.id,
          type: 'credit_given',
          amount: totalAmount,
          bill_id: created.id,
          transaction_date: new Date(),
          notes: `Bill ${created.bill_number}`,
          created_by: userId,
        }
      });
      await tx.creditCustomer.update({
        where: { id: creditCustomer.id },
        data: { total_outstanding: { increment: totalAmount } }
      });
    }

    return created;
  }, {
    maxWait: 5000,
    timeout: 10000
  });

  return bill;
  } catch (error: any) {
    logger.error('createManualBill failed:', { error: error?.message, stack: error?.stack, data });
    throw error;
  }
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

export interface ListBillsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment_method?: string;
  from_date?: string;
  to_date?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export async function listBills(userId: string, params: ListBillsParams) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can view bills');

  const page = Math.max(params.page ?? 1, 1);
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 100);
  const skip = (page - 1) * limit;

  const where: any = { shop_id: shop.id };

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { bill_number: { contains: q, mode: 'insensitive' } },
      { patient: { full_name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  if (params.status && ['paid', 'pending', 'partial'].includes(params.status)) {
    where.payment_status = params.status;
  }

  if (params.payment_method && ['cash', 'upi', 'card', 'credit'].includes(params.payment_method)) {
    where.payment_method = params.payment_method;
  }

  if (params.from_date || params.to_date) {
    where.created_at = {};
    if (params.from_date) where.created_at.gte = new Date(params.from_date);
    if (params.to_date) {
      const endDate = new Date(params.to_date);
      endDate.setHours(23, 59, 59, 999);
      where.created_at.lte = endDate;
    }
  }

  const sortField = ['created_at', 'total_amount'].includes(params.sort ?? '') ? params.sort! : 'created_at';
  const sortOrder = params.order === 'asc' ? 'asc' : 'desc';

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: {
        patient: { select: { full_name: true, user_id: true } },
        items: true,
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

export async function searchCustomers(userId: string, query: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId }, select: { id: true } });
  if (!shop || !query) return [];

  const master = await prisma.creditCustomer.findMany({
    where: {
      shop_id: shop.id,
      OR: [
        { phone: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { name: true, phone: true, address: true },
    take: 10,
  });

  const masterResults = master.map(c => ({
    customer_name: c.name,
    customer_phone: c.phone || '',
    customer_gstin: null,
    billing_address: c.address,
    billing_state: null,
    source: 'master'
  }));

  const masterPhones = master.map(m => m.phone).filter(Boolean) as string[];
  const bills = await prisma.bill.findMany({
    where: {
      shop_id: shop.id,
      OR: [
        { customer_phone: { contains: query, mode: 'insensitive' } },
        { customer_name: { contains: query, mode: 'insensitive' } },
      ],
      ...(masterPhones.length > 0 ? { NOT: { customer_phone: { in: masterPhones } } } : {})
    },
    select: { customer_name: true, customer_phone: true, customer_gstin: true, billing_address: true, billing_state: true },
    distinct: ['customer_phone'],
    take: 10,
  });

  const billResults = bills.map(b => ({
    customer_name: b.customer_name,
    customer_phone: b.customer_phone || '',
    customer_gstin: b.customer_gstin,
    billing_address: b.billing_address,
    billing_state: b.billing_state,
    source: 'history'
  }));

  return [...masterResults, ...billResults].slice(0, 15);
}

export async function voidBill(billId: string, userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can void bills');

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { items: true, income_entry: true, credit_transactions: true },
  });
  if (!bill) throw new AppError(404, 'NOT_FOUND', 'Bill not found');
  if (bill.shop_id !== shop.id) throw new AppError(403, 'FORBIDDEN', 'Bill not for your shop');

  return await prisma.$transaction(async (tx) => {
    for (const item of bill.items) {
      if (item.inventory_id) {
        await tx.shopInventory.update({
          where: { id: item.inventory_id },
          data: { stock_qty: { increment: item.quantity } },
        });
      }
    }
    if (bill.payment_method === 'credit') {
      for (const txn of bill.credit_transactions) {
        await tx.creditCustomer.update({
          where: { id: txn.customer_id },
          data: { total_outstanding: { decrement: txn.amount } },
        });
      }
    }
    if (bill.income_entry) {
      await tx.incomeEntry.delete({ where: { id: bill.income_entry.id } });
    }
    await tx.creditTransaction.deleteMany({ where: { bill_id: billId } });
    await tx.bill.delete({ where: { id: billId } });
    return { success: true };
  });
}

export async function updateBill(billId: string, userId: string, data: any) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return await prisma.$transaction(async (tx) => {
    const oldBill = await tx.bill.findUnique({
      where: { id: billId, shop_id: shop.id },
      include: { items: true, income_entry: true, credit_transactions: true },
    });
    if (!oldBill) throw new AppError(404, 'NOT_FOUND', 'Bill not found');

    if (data.items) {
      for (const item of oldBill.items) {
        if (item.inventory_id) {
          await tx.shopInventory.update({
            where: { id: item.inventory_id },
            data: { stock_qty: { increment: item.quantity } },
          });
        }
      }
      await tx.billItem.deleteMany({ where: { bill_id: billId } });
    }

    let subtotal = Number(oldBill.subtotal);
    let totalGst = Number(oldBill.gst_amount);
    let discountAmount = Number(oldBill.discount_amount);
    let totalAmount = Number(oldBill.total_amount);
    let normalizedItems: any[] = [];

    if (data.items && Array.isArray(data.items)) {
      subtotal = 0;
      totalGst = 0;
      discountAmount = Number(data.discount_amount ?? 0);
      normalizedItems = data.items.map((it: any) => {
        const qty = Number(it.quantity) || 0;
        const mrp = Number(it.mrp) || 0;
        const gstRate = Number(it.gst_rate) || 0;
        const dv = Number(it.discount_value) || 0;
        const itemSub = qty * mrp;
        const itemDisc = it.discount_type === 'percentage' ? (itemSub * dv) / 100 : (qty * dv);
        const taxable = itemSub - itemDisc;
        const itemGst = (taxable * gstRate) / 100;
        subtotal += itemSub;
        totalGst += itemGst;
        return {
          medicine_name: it.medicine_name,
          inventory_id: it.inventory_id || null,
          hsn_code: it.hsn_code,
          batch_number: it.batch_number,
          expiry_date: it.expiry_date ? new Date(it.expiry_date) : null,
          mrp,
          quantity: qty,
          discount_type: it.discount_type || 'percentage',
          discount_value: dv,
          gst_rate: gstRate,
          line_total: taxable + itemGst,
        };
      });
      totalAmount = subtotal - discountAmount + totalGst;
    }

    const updatedBill = await tx.bill.update({
      where: { id: billId },
      data: {
        customer_name: data.customer_name ?? oldBill.customer_name,
        customer_phone: data.customer_phone ?? oldBill.customer_phone,
        customer_gstin: data.customer_gstin ?? oldBill.customer_gstin,
        billing_address: data.billing_address ?? oldBill.billing_address,
        billing_state: data.billing_state ?? oldBill.billing_state,
        payment_method: data.payment_method ?? oldBill.payment_method,
        payment_status: data.payment_status ?? oldBill.payment_status,
        subtotal,
        gst_amount: totalGst,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        ...(data.items ? {
          items: {
            create: normalizedItems
          }
        } : {})
      },
      include: { items: true, income_entry: true, credit_transactions: true }
    });

    if (data.items) {
      for (const it of normalizedItems) {
        if (it.inventory_id) {
          await tx.shopInventory.update({
            where: { id: it.inventory_id },
            data: { stock_qty: { decrement: it.quantity } },
          });
        }
      }
    }

    const pm = data.payment_method ?? oldBill.payment_method;
    const ps = data.payment_status ?? oldBill.payment_status;

    if (updatedBill.income_entry) {
      if (ps === 'paid' && pm !== 'credit') {
        await tx.incomeEntry.update({
          where: { id: updatedBill.income_entry.id },
          data: { amount: totalAmount, payment_method: pm as any }
        });
      } else {
        await tx.incomeEntry.delete({ where: { id: updatedBill.income_entry.id } });
      }
    } else if (ps === 'paid' && pm !== 'credit') {
      await tx.incomeEntry.create({
        data: {
          shop_id: shop.id,
          entry_type: 'sale_income' as any,
          amount: totalAmount,
          payment_method: pm as any,
          reference_bill_id: billId,
          entry_date: new Date(),
          created_by: userId,
        }
      });
    }

    if (oldBill.payment_method === 'credit' && pm !== 'credit') {
      for (const txn of oldBill.credit_transactions) {
        await tx.creditCustomer.update({
          where: { id: txn.customer_id },
          data: { total_outstanding: { decrement: txn.amount } },
        });
        await tx.creditTransaction.delete({ where: { id: txn.id } });
      }
    } else if (pm === 'credit') {
      // Find or create customer, then update transaction
      let creditCustomer = await tx.creditCustomer.findFirst({
        where: {
          shop_id: shop.id,
          OR: [
            (updatedBill.patient_id ? { patient_id: updatedBill.patient_id } : {}),
            (updatedBill.customer_phone ? { phone: updatedBill.customer_phone } : {})
          ].filter(o => Object.keys(o).length > 0) as any
        },
      });
      if (!creditCustomer) {
        creditCustomer = await tx.creditCustomer.create({
          data: {
            shop_id: shop.id,
            patient_id: updatedBill.patient_id,
            name: updatedBill.customer_name || 'Walk-in Customer',
            phone: updatedBill.customer_phone,
            total_outstanding: 0,
          },
        });
      }
      const existingTxn = await tx.creditTransaction.findFirst({ where: { bill_id: billId } });
      if (existingTxn) {
        const diff = Number(updatedBill.total_amount) - Number(existingTxn.amount);
        await tx.creditTransaction.update({
          where: { id: existingTxn.id },
          data: { amount: updatedBill.total_amount }
        });
        await tx.creditCustomer.update({
          where: { id: creditCustomer.id },
          data: { total_outstanding: { increment: diff } }
        });
      } else {
        await tx.creditTransaction.create({
          data: {
            customer_id: creditCustomer.id,
            shop_id: shop.id,
            type: 'credit_given',
            amount: Number(updatedBill.total_amount),
            bill_id: billId,
            transaction_date: new Date(),
            created_by: userId,
          },
        });
        await tx.creditCustomer.update({
          where: { id: creditCustomer.id },
          data: { total_outstanding: { increment: Number(updatedBill.total_amount) } },
        });
      }
    }
    return updatedBill;
  });
}
