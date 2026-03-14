import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedMedicineCatalog } from './seed-medicine-catalog';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding RxDesk database...');

  // ── Subscription Plans ──────────────────────────────────────────────────────
  const plans = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { name: 'Basic' },
      update: {
        price_monthly: 799,
        max_doctors: 1,
        max_appointments_per_month: 50,
        max_sessions: 2,
      },
      create: {
        name: 'Basic',
        price_monthly: 799,
        max_doctors: 1,
        max_appointments_per_month: 50,
        max_sessions: 2,
        features: {
          sms_reminders: false,
          pdf_bills: true,
          analytics: false,
          priority_support: false,
        },
        is_active: true,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { name: 'Standard' },
      update: {
        price_monthly: 1299,
        max_doctors: 5,
        max_appointments_per_month: 250,
        max_sessions: 5,
      },
      create: {
        name: 'Standard',
        price_monthly: 1299,
        max_doctors: 5,
        max_appointments_per_month: 250,
        max_sessions: 5,
        features: {
          sms_reminders: true,
          pdf_bills: true,
          analytics: true,
          priority_support: false,
        },
        is_active: true,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { name: 'Premium' },
      update: {
        price_monthly: 2299,
        max_doctors: 15,
        max_appointments_per_month: 99999,
        max_sessions: 10,
      },
      create: {
        name: 'Premium',
        price_monthly: 2299,
        max_doctors: 15,
        max_appointments_per_month: 99999,
        max_sessions: 10,
        features: {
          sms_reminders: true,
          pdf_bills: true,
          analytics: true,
          priority_support: true,
          custom_branding: true,
        },
        is_active: true,
      },
    }),
  ]);
  console.log(`✅ Created ${plans.length} subscription plans`);

  // ── Medicines ───────────────────────────────────────────────────────────────
  await seedMedicineCatalog();

  // ── Admin User ───────────────────────────────────────────────────────────────
  // Phone must be stored in E.164 format (+91XXXXXXXXXX) to match the auth flow
  const rawAdminPhone = process.env.ADMIN_PHONE ?? '9999999999';
  const adminPhone = rawAdminPhone.startsWith('+91') ? rawAdminPhone : `+91${rawAdminPhone}`;
  const adminUser = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { role: UserRole.admin, is_verified: true, is_active: true },
    create: {
      phone: adminPhone,
      role: UserRole.admin,
      is_verified: true,
      is_active: true,
    },
  });
  console.log(`✅ Admin user ready: ${adminUser.phone}`);

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
