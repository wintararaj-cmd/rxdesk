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
        max_doctors: 10,
        max_appointments_per_month: 2500,
        max_sessions: 10,
      },
      create: {
        name: 'Standard',
        price_monthly: 1299,
        max_doctors: 10,
        max_appointments_per_month: 2500,
        max_sessions: 10,
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
        max_doctors: 25,
        max_appointments_per_month: 99999,
        max_sessions: 25,
      },
      create: {
        name: 'Premium',
        price_monthly: 2299,
        max_doctors: 25,
        max_appointments_per_month: 99999,
        max_sessions: 25,
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

  // Admin User
  const rawAdminPhone = process.env.ADMIN_PHONE ?? '9999999999';
  const adminPhone = rawAdminPhone.startsWith('+91') ? rawAdminPhone : `+91${rawAdminPhone}`;
  
  const hashedPassword = await bcrypt.hash('RxDesk@123', 12);

  const adminUser = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { 
      role: UserRole.admin, 
      is_verified: true, 
      is_active: true,
      // Only set password if it doesn't exist
    },
    create: {
      phone: adminPhone,
      password: hashedPassword,
      role: UserRole.admin,
      is_verified: true,
      is_active: true,
    },
  });
  
  // If user exists but has no password, set it
  if (!adminUser.password) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: hashedPassword }
    });
  }
  
  console.log(`✅ Admin user ready: ${adminUser.phone} (Role: ${adminUser.role})`);

  // ── Auto-upgrade Basic to Standard (fix for current users) ──────────────────────
  const standardPlan = plans.find(p => p.name === 'Standard');
  if (standardPlan) {
    const upgraded = await prisma.shopSubscription.updateMany({
      where: { plan: { name: 'Basic' }, status: 'active' },
      data: { plan_id: standardPlan.id }
    });
    if (upgraded.count > 0) {
      console.log(`✅ Upgraded ${upgraded.count} active basic subscriptions to Standard fallback`);
    }
  }

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
