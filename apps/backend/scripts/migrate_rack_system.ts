import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Rack System Migration...');

  // 1. Get all unique medicine groups from current inventory
  const inventories = await prisma.shopInventory.findMany({
    select: {
      shop_id: true,
      medicine_id: true,
      medicine_name: true,
      unit: true,
      reorder_level: true,
    }
  });

  const groups = new Map<string, {
    shop_id: string;
    medicine_id: string | null;
    medicine_name: string;
    unit: string;
    reorder_level: number;
  }>();

  for (const inv of inventories) {
    const key = `${inv.shop_id}-${inv.medicine_name.toLowerCase().trim()}-${inv.unit}`;
    if (!groups.has(key)) {
      groups.set(key, {
        shop_id: inv.shop_id,
        medicine_id: inv.medicine_id ?? null,
        medicine_name: inv.medicine_name.trim(),
        unit: inv.unit,
        reorder_level: inv.reorder_level,
      });
    }
  }

  console.log(`📦 Found ${groups.size} unique medicine entries to create in ShopMedicine.`);

  let createdCount = 0;
  let linkedCount = 0;

  for (const group of groups.values()) {
    // 2. Create or find the Master Medicine record
    const shopMed = await prisma.shopMedicine.upsert({
      where: {
        shop_id_medicine_name_unit: {
          shop_id: group.shop_id,
          medicine_name: group.medicine_name,
          unit: group.unit,
        }
      },
      update: {},
      create: {
        shop_id: group.shop_id,
        medicine_id: group.medicine_id,
        medicine_name: group.medicine_name,
        unit: group.unit,
        reorder_level: group.reorder_level,
      }
    });

    createdCount++;

    // 3. Link all batches to this master record
    const updated = await prisma.shopInventory.updateMany({
      where: {
        shop_id: group.shop_id,
        medicine_name: { equals: group.medicine_name, mode: 'insensitive' },
        unit: group.unit,
        shop_medicine_id: null, // Only link if not linked
      },
      data: {
        shop_medicine_id: shopMed.id
      }
    });

    linkedCount += updated.count;
    
    if (createdCount % 50 === 0) {
      console.log(`...processed ${createdCount} medicines`);
    }
  }

  console.log(`✅ Success! Created/Ensured ${createdCount} ShopMedicine records.`);
  console.log(`🔗 Linked ${linkedCount} inventory batches to their parents.`);
  console.log('🎉 Migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
