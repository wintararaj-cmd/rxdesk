import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding RxDesk database...');

  // ── Subscription Plans ──────────────────────────────────────────────────────
  const plans = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { name: 'Basic' },
      update: {
        max_doctors: 1,
        max_appointments_per_month: 50,
        max_sessions: 2,
      },
      create: {
        name: 'Basic',
        price_monthly: 499,
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
        max_doctors: 5,
        max_appointments_per_month: 250,
        max_sessions: 5,
      },
      create: {
        name: 'Standard',
        price_monthly: 999,
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
        max_doctors: 15,
        max_appointments_per_month: 99999,
        max_sessions: 10,
      },
      create: {
        name: 'Premium',
        price_monthly: 1999,
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
  const medicines = [
    { name: 'Paracetamol 500mg', generic_name: 'Paracetamol', brand_name: 'Crocin', form: 'TABLET', strength: '500mg' },
    { name: 'Paracetamol 650mg', generic_name: 'Paracetamol', brand_name: 'Dolo 650', form: 'TABLET', strength: '650mg' },
    { name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', brand_name: 'Mox', form: 'CAPSULE', strength: '500mg' },
    { name: 'Azithromycin 500mg', generic_name: 'Azithromycin', brand_name: 'Azithral', form: 'TABLET', strength: '500mg' },
    { name: 'Metformin 500mg', generic_name: 'Metformin HCl', brand_name: 'Glycomet', form: 'TABLET', strength: '500mg' },
    { name: 'Amlodipine 5mg', generic_name: 'Amlodipine Besylate', brand_name: 'Amlip', form: 'TABLET', strength: '5mg' },
    { name: 'Atorvastatin 10mg', generic_name: 'Atorvastatin', brand_name: 'Atorva', form: 'TABLET', strength: '10mg' },
    { name: 'Omeprazole 20mg', generic_name: 'Omeprazole', brand_name: 'Omez', form: 'CAPSULE', strength: '20mg' },
    { name: 'Pantoprazole 40mg', generic_name: 'Pantoprazole', brand_name: 'Pan 40', form: 'TABLET', strength: '40mg' },
    { name: 'Cetirizine 10mg', generic_name: 'Cetirizine HCl', brand_name: 'Cetzine', form: 'TABLET', strength: '10mg' },
    { name: 'Montelukast 10mg', generic_name: 'Montelukast Sodium', brand_name: 'Montair', form: 'TABLET', strength: '10mg' },
    { name: 'Ibuprofen 400mg', generic_name: 'Ibuprofen', brand_name: 'Brufen', form: 'TABLET', strength: '400mg' },
    { name: 'Diclofenac 50mg', generic_name: 'Diclofenac Sodium', brand_name: 'Voveran', form: 'TABLET', strength: '50mg' },
    { name: 'Losartan 50mg', generic_name: 'Losartan Potassium', brand_name: 'Losar', form: 'TABLET', strength: '50mg' },
    { name: 'Metoprolol 25mg', generic_name: 'Metoprolol Succinate', brand_name: 'Metolar XR', form: 'TABLET', strength: '25mg' },
    { name: 'Vitamin D3 60000 IU', generic_name: 'Cholecalciferol', brand_name: 'D-Rise', form: 'CAPSULE', strength: '60000 IU' },
    { name: 'Calcium + D3', generic_name: 'Calcium Carbonate + D3', brand_name: 'Shelcal', form: 'TABLET', strength: '500mg+250IU' },
    { name: 'Multivitamin', generic_name: 'Multivitamins', brand_name: 'Supradyn', form: 'TABLET', strength: 'Varies' },
    { name: 'ORS Powder', generic_name: 'Oral Rehydration Salts', brand_name: 'Electral', form: 'SYRUP', strength: 'Standard' },
    { name: 'Salbutamol Inhaler', generic_name: 'Salbutamol', brand_name: 'Asthalin', form: 'INHALER', strength: '100mcg/dose' },
  ];

  let medicineCount = 0;
  for (const med of medicines) {
    const existing = await prisma.medicine.findFirst({ where: { name: med.name } });
    if (!existing) {
      await prisma.medicine.create({ data: med as any });
    }
    medicineCount++;
  }
  console.log(`✅ Seeded ${medicineCount} medicines`);

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
