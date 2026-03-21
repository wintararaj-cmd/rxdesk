import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getBoundingBox } from '../../utils/geoUtils';
import { Request } from 'express';

export async function registerShop(
  userId: string,
  data: {
    shop_name: string;
    shop_type?: 'medical_shop' | 'clinic' | 'pharmacy' | 'dispensary';
    gst_number?: string;
    drug_license_no: string;
    address_line: string;
    city: string;
    district?: string;
    state: string;
    pin_code: string;
    latitude?: number;
    longitude?: number;
    contact_phone: string;
    contact_email?: string;
    opening_time?: string;
    closing_time?: string;
    working_days?: string[];
  }
) {
  const existing = await prisma.medicalShop.findFirst({ where: { owner_user_id: userId } });
  if (existing) throw new AppError(409, 'DUPLICATE_BOOKING', 'You already have a registered shop');

  const shop = await prisma.medicalShop.create({
    data: { owner_user_id: userId, ...data },
  });

  // Update user role to shop_owner
  await prisma.user.update({ where: { id: userId }, data: { role: 'shop_owner' } });

  // Start 7-day trial subscription
  const basicPlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Basic', is_active: true } });
  if (basicPlan) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    await prisma.shopSubscription.create({
      data: { shop_id: shop.id, plan_id: basicPlan.id, status: 'trial', trial_ends_at: trialEnd },
    });
  }

  return shop;
}

export async function getShopByOwnerId(userId: string) {
  const shop = await prisma.medicalShop.findUnique({
    where: { owner_user_id: userId },
    include: {
      chambers: {
        where: { status: 'active' },
        include: {
          doctor: { select: { id: true, full_name: true, specialization: true, profile_photo: true } },
        },
      },
      subscriptions: {
        orderBy: { created_at: 'desc' },
        take: 1,
        include: { plan: true },
      },
    },
  });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop profile not found');
  return shop;
}

export async function searchShops(q?: string, city?: string, pinCode?: string) {
  return prisma.medicalShop.findMany({
    where: {
      is_active: true,
      ...(q ? { shop_name: { contains: q, mode: 'insensitive' } } : {}),
      ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      ...(pinCode ? { pin_code: pinCode } : {}),
    },
    select: { id: true, shop_name: true, address_line: true, city: true, pin_code: true, contact_phone: true },
    take: 20,
    orderBy: { shop_name: 'asc' },
  });
}

export async function getShopById(shopId: string) {
  const shop = await prisma.medicalShop.findUnique({
    where: { id: shopId, is_active: true },
    include: {
      chambers: {
        where: { status: 'active' },
        include: {
          doctor: { select: { full_name: true, specialization: true, profile_photo: true, experience_years: true } },
          schedules: { where: { is_active: true } },
        },
      },
    },
  });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
  return shop;
}

export async function getNearbyShops(req: Request) {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat((req.query.radius as string) || '5');

  if (isNaN(lat) || isNaN(lng)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'lat and lng are required');
  }

  const box = getBoundingBox(lat, lng, radiusKm);

  const shops = await prisma.medicalShop.findMany({
    where: {
      is_active: true,
      verification_status: 'approved',
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    },
    select: {
      id: true, shop_name: true, address_line: true, city: true, pin_code: true,
      contact_phone: true, latitude: true, longitude: true,
    },
  });

  return shops;
}

export async function getTodayDashboard(userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. Appointments
  const appointments = await prisma.appointment.findMany({
    where: {
      chamber: { shop_id: shop.id },
      appointment_date: { gte: today, lt: tomorrow },
      status: { notIn: ['cancelled', 'no_show'] },
    },
    include: {
      patient: { select: { full_name: true, age: true, gender: true } },
      chamber: {
        include: { doctor: { select: { full_name: true, specialization: true } } },
      },
      prescription: { select: { id: true, diagnosis: true } },
    },
    orderBy: [{ chamber_id: 'asc' }, { slot_start_time: 'asc' }],
  });

  const stats = {
    total: appointments.length,
    waiting: appointments.filter((a) => a.status === 'booked' || a.status === 'confirmed').length,
    in_consultation: appointments.filter((a) => a.status === 'in_consultation').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
  };

  // 2. Revenue and Bills (All bills created today)
  const billsToday = await prisma.bill.findMany({
    where: {
      shop_id: shop.id,
      created_at: { gte: today, lt: tomorrow },
    },
    select: { total_amount: true, payment_status: true },
  });

  const todayRevenue = billsToday.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const pendingBillsCount = billsToday.filter((b) => b.payment_status === 'pending').length;

  // 3. Low stock count
  const allStock = await prisma.shopInventory.findMany({
    where: { shop_id: shop.id },
    select: { stock_qty: true, reorder_level: true },
  });
  const lowStockCount = allStock.filter((it) => it.stock_qty <= (it.reorder_level ?? 10)).length;
  const totalInventory = allStock.length;

  // Combine for both mobile and web frontends
  return {
    shop_id: shop.id,
    stats, // Used by mobile
    appointments, // Used by both
    today_revenue: todayRevenue, // Used by web (now shows all sales today)
    today_sales: todayRevenue, // Used by mobile
    today_bills: billsToday.length, // Used by mobile
    today_appointments: appointments.length, // Used by web
    pending_bills: pendingBillsCount, // Used by web
    low_stock_count: lowStockCount, // Used by web
    total_inventory: totalInventory, // Used by mobile
  };
}

export async function updateShop(
  userId: string,
  data: {
    shop_name?: string;
    address_line?: string;
    city?: string;
    district?: string;
    state?: string;
    pin_code?: string;
    contact_phone?: string;
    contact_email?: string;
    opening_time?: string;
    closing_time?: string;
    working_days?: string[];
    latitude?: number;
    longitude?: number;
    gst_number?: string;
    gst_type?: 'unregistered' | 'composite' | 'regular';
    auto_backup_enabled?: boolean;
    backup_time?: string;
    backup_path?: string;
    // Invoice Settings
    show_hsn_code?: boolean;
    show_batch_no?: boolean;
    printer_type?: 'thermal' | 'a4';
  }
) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  return prisma.medicalShop.update({
    where: { id: shop.id },
    data: {
      ...(data.shop_name !== undefined && { shop_name: data.shop_name }),
      ...(data.address_line !== undefined && { address_line: data.address_line }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.district !== undefined && { district: data.district }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.pin_code !== undefined && { pin_code: data.pin_code }),
      ...(data.contact_phone !== undefined && { contact_phone: data.contact_phone }),
      ...(data.contact_email !== undefined && { contact_email: data.contact_email }),
      ...(data.opening_time !== undefined && { opening_time: data.opening_time }),
      ...(data.closing_time !== undefined && { closing_time: data.closing_time }),
      ...(data.working_days !== undefined && { working_days: data.working_days }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.gst_number !== undefined && { gst_number: data.gst_number }),
      ...(data.gst_type !== undefined && { gst_type: data.gst_type }),
      ...(data.auto_backup_enabled !== undefined && { auto_backup_enabled: data.auto_backup_enabled }),
      ...(data.backup_time !== undefined && { backup_time: data.backup_time }),
      ...(data.backup_path !== undefined && { backup_path: data.backup_path }),
      // Invoice Settings
      ...(data.show_hsn_code !== undefined && { show_hsn_code: data.show_hsn_code }),
      ...(data.show_batch_no !== undefined && { show_batch_no: data.show_batch_no }),
      ...(data.printer_type !== undefined && { printer_type: data.printer_type }),
    },
  });
}

export async function getShopAnalytics(userId: string, days = 30) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  from.setHours(0, 0, 0, 0);

  // ── Revenue per day ──────────────────────────────────────────────────────
  const bills = await prisma.bill.findMany({
    where: { shop_id: shop.id, created_at: { gte: from } },
    select: { created_at: true, total_amount: true, payment_status: true },
  });

  const revenueMap: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    revenueMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const b of bills) {
    if (b.payment_status === 'paid') {
      const key = b.created_at.toISOString().slice(0, 10);
      if (key in revenueMap) revenueMap[key] = (revenueMap[key] ?? 0) + Number(b.total_amount);
    }
  }
  const revenue = Object.entries(revenueMap).map(([date, amount]) => ({ date, amount }));

  // ── Appointments per day ─────────────────────────────────────────────────
  const aptRecords = await prisma.appointment.findMany({
    where: { chamber: { shop_id: shop.id }, appointment_date: { gte: from } },
    select: { appointment_date: true, status: true },
  });

  const apptMap: Record<string, number> = {};
  for (const key of Object.keys(revenueMap)) apptMap[key] = 0;
  for (const a of aptRecords) {
    const key = a.appointment_date.toISOString().slice(0, 10);
    if (key in apptMap) apptMap[key] = (apptMap[key] ?? 0) + 1;
  }
  const appointmentsByDay = Object.entries(apptMap).map(([date, count]) => ({ date, count }));

  // ── Top 10 dispensed medicines ───────────────────────────────────────────
  const billItems = await prisma.billItem.findMany({
    where: { bill: { shop_id: shop.id, created_at: { gte: from } } },
    select: { medicine_name: true, quantity: true },
  });
  const medMap: Record<string, number> = {};
  for (const item of billItems) {
    medMap[item.medicine_name] = (medMap[item.medicine_name] ?? 0) + item.quantity;
  }
  const topMedicines = Object.entries(medMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([medicine_name, quantity]) => ({ medicine_name, quantity }));

  // ── Low-stock count ──────────────────────────────────────────────────────
  const allInventory = await prisma.shopInventory.findMany({
    where: { shop_id: shop.id },
    select: { id: true, stock_qty: true, reorder_level: true },
  });
  const lowStockItems = allInventory.filter((it) => it.stock_qty <= (it.reorder_level ?? 10));

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const completedAppointments = aptRecords.filter((a) => a.status === 'completed').length;

  return {
    period_days: days,
    summary: {
      total_revenue: totalRevenue,
      avg_daily_revenue: days > 0 ? Math.round(totalRevenue / days) : 0,
      total_appointments: aptRecords.length,
      completed_appointments: completedAppointments,
      low_stock_count: lowStockItems.length,
      total_bills: bills.length,
    },
    revenue,
    appointments_by_day: appointmentsByDay,
    top_medicines: topMedicines,
  };
}
