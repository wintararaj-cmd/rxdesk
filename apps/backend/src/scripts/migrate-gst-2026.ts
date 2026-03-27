
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting GST 2.0 (2026) Data Migration...');

  // 1. Update Global Medicines Catalog
  // Move all legacy 12% to the new 5% standard
  const medicines = await prisma.medicine.updateMany({
    where: { gst_rate: 12 },
    data: { gst_rate: 5 }
  });
  console.log(`✅ Updated ${medicines.count} medicines in global catalog (12% -> 5%)`);

  // Specific categorizations for Global Catalog
  // Lifesaving / Critical (0%)
  const critical = await prisma.medicine.updateMany({
    where: {
      OR: [
        { name: { contains: 'cancer', mode: 'insensitive' } },
        { generic_name: { contains: 'rituximab', mode: 'insensitive' } },
        { generic_name: { contains: 'trastuzumab', mode: 'insensitive' } },
      ]
    },
    data: { gst_rate: 0 }
  });
  console.log(`✅ Categorized ${critical.count} medicines as Critical (0%)`);

  // Supplements / Vitamins (18%)
  const supplements = await prisma.medicine.updateMany({
    where: {
      OR: [
        { name: { contains: 'vitamin', mode: 'insensitive' } },
        { name: { contains: 'multivitamin', mode: 'insensitive' } },
        { generic_name: { contains: 'supplement', mode: 'insensitive' } },
        { generic_name: { contains: 'protein', mode: 'insensitive' } },
      ]
    },
    data: { gst_rate: 18 }
  });
  console.log(`✅ Categorized ${supplements.count} medicines as Supplements (18%)`);

  // 2. Update Shop Inventory (Active Batches)
  // This is what the shop owners see on their dashboard
  const inventory = await prisma.shopInventory.updateMany({
    where: { gst_rate: 12 },
    data: { gst_rate: 5 }
  });
  console.log(`✅ Updated ${inventory.count} active shop inventory batches (12% -> 5%)`);

  // Synchronize Shop Inventory with Medicine catalog for 0% and 18% tiers
  const medicines_0 = await prisma.medicine.findMany({ where: { gst_rate: 0 }, select: { id: true, name: true } });
  for (const m of medicines_0) {
    await prisma.shopInventory.updateMany({
      where: { medicine_name: m.name, gst_rate: { not: 0 } },
      data: { gst_rate: 0 }
    });
  }
  const medicines_18 = await prisma.medicine.findMany({ where: { gst_rate: 18 }, select: { id: true, name: true } });
  for (const m of medicines_18) {
    await prisma.shopInventory.updateMany({
      where: { medicine_name: m.name, gst_rate: { not: 18 } },
      data: { gst_rate: 18 }
    });
  }
  console.log('✅ Synchronized shop inventory tiers with global catalog.');

  // 3. Update Historical Purchase Items (for future report consistency)
  const purchaseItems = await prisma.purchaseItem.updateMany({
    where: { gst_rate: 12 },
    data: { gst_rate: 5 }
  });
  console.log(`✅ Updated ${purchaseItems.count} historical purchase items (12% -> 5%)`);

  console.log('\n🎉 GST 2.0 (2026) Migration Complete!');
}

migrate()
  .catch(err => console.error('❌ Migration failed:', err))
  .finally(() => prisma.$disconnect());
