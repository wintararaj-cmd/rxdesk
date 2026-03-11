import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { Prisma } from '@prisma/client';

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
}) {
  const shop = await getShopOrThrow(userId);
  return prisma.supplier.create({
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
    },
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
    },
  });
  if (!supplier) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');

  const totalPurchases = await prisma.purchaseEntry.aggregate({
    where: { supplier_id: supplierId, shop_id: shop.id },
    _sum: { total_amount: true },
  });
  const totalPaid = await prisma.supplierPayment.aggregate({
    where: { supplier_id: supplierId, shop_id: shop.id },
    _sum: { amount: true },
  });

  return {
    ...supplier,
    total_purchases: Number(totalPurchases._sum.total_amount ?? 0),
    total_paid: Number(totalPaid._sum.amount ?? 0),
    outstanding: Number(totalPurchases._sum.total_amount ?? 0) - Number(totalPaid._sum.amount ?? 0),
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
    unit?: string;
  }[];
}

export async function createPurchaseEntry(userId: string, input: CreatePurchaseInput) {
  const shop = await getShopOrThrow(userId);

  // Calculate totals
  const itemsWithTotals = input.items.map((item) => {
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
            batch_number: item.batch_number,
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
      const existing = await tx.shopInventory.findFirst({
        where: {
          shop_id: shop.id,
          medicine_name: item.medicine_name,
          batch_number: item.batch_number,
        },
      });
      if (existing) {
        await tx.shopInventory.update({
          where: { id: existing.id },
          data: { stock_qty: { increment: totalQty }, mrp: item.mrp, purchase_price: item.purchase_price, unit: item.unit ?? existing.unit },
        });
      } else {
        await tx.shopInventory.create({
          data: {
            shop_id: shop.id,
            medicine_id: item.medicine_id ?? null,
            medicine_name: item.medicine_name,
            batch_number: item.batch_number,
            expiry_date: new Date(item.expiry_date),
            mrp: item.mrp,
            purchase_price: item.purchase_price,
            stock_qty: totalQty,
            gst_rate: item.gst_rate,
            unit: item.unit ?? 'strip',
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
  const [total, items] = await Promise.all([
    prisma.purchaseEntry.count({ where }),
    prisma.purchaseEntry.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { invoice_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
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

export async function createCreditCustomer(userId: string, data: { name: string; phone?: string; address?: string; credit_limit?: number; patient_id?: string; notes?: string }) {
  const shop = await getShopOrThrow(userId);
  return prisma.creditCustomer.create({
    data: {
      shop_id: shop.id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      credit_limit: data.credit_limit ?? 0,
      patient_id: data.patient_id ?? null,
      notes: data.notes,
    },
  });
}

export async function getCreditCustomerLedger(userId: string, customerId: string) {
  const shop = await getShopOrThrow(userId);
  const customer = await prisma.creditCustomer.findFirst({
    where: { id: customerId, shop_id: shop.id },
    include: {
      transactions: {
        orderBy: { transaction_date: 'desc' },
        include: { bill: { select: { id: true, bill_number: true, total_amount: true } } },
      },
    },
  });
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Credit customer not found');
  return customer;
}

export async function recordCreditPayment(userId: string, customerId: string, data: { amount: number; payment_method?: string; reference_no?: string; notes?: string }) {
  const shop = await getShopOrThrow(userId);
  const customer = await prisma.creditCustomer.findFirst({ where: { id: customerId, shop_id: shop.id } });
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Credit customer not found');
  if (data.amount > Number(customer.total_outstanding)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Payment exceeds outstanding balance');
  }

  return prisma.$transaction(async (tx) => {
    const txn = await tx.creditTransaction.create({
      data: {
        customer_id: customerId,
        shop_id: shop.id,
        type: 'payment_received',
        amount: data.amount,
        payment_method: (data.payment_method ?? 'cash') as any,
        reference_no: data.reference_no,
        notes: data.notes,
        transaction_date: new Date(),
        created_by: userId,
      },
    });
    await tx.creditCustomer.update({
      where: { id: customerId },
      data: { total_outstanding: { decrement: data.amount } },
    });
    return txn;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Reports
// ─────────────────────────────────────────────────────────────────────────────

export async function getProfitAndLoss(userId: string, from: string, to: string) {
  const shop = await getShopOrThrow(userId);
  const dateFilter = { gte: new Date(from), lte: new Date(to) };

  const [salesIncome, otherIncome, allPurchasesInRange, allExpenses] = await Promise.all([
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
    // Expenses (manual only)
    prisma.expenseEntry.groupBy({
      by: ['category'],
      where: { shop_id: shop.id, entry_date: dateFilter, linked_purchase_id: null },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(salesIncome._sum.amount ?? 0) + Number(otherIncome._sum.amount ?? 0);
  const cogs = Number(allPurchasesInRange._sum.total_amount ?? 0);
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
    select: { mrp: true, quantity: true, discount_pct: true, gst_rate: true, line_total: true },
  });

  // Group by GST rate
  const outwardByRate: Record<string, { taxable: number; gst: number; count: number }> = {};
  let totalOutwardTaxable = 0;
  let totalGstCollected = 0;

  for (const item of billItems) {
    const rate = String(Number(item.gst_rate));
    const discountedBase = Number(item.mrp) * item.quantity * (1 - Number(item.discount_pct) / 100);
    const gst = discountedBase * (Number(item.gst_rate) / (100 + Number(item.gst_rate)));
    const taxable = discountedBase - gst;
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

// ─────────────────────────────────────────────────────────────────────────────
//  Purchase Returns
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePurchaseReturnInput {
  supplier_id?: string;
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
