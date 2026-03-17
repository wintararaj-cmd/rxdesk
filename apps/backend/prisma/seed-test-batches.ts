
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding test batches for Paracetamol 650mg...');

    const ownerPhone = '+918888888888';
    const shop = await prisma.medicalShop.findFirst({
        where: { owner: { phone: ownerPhone } }
    });

    if (!shop) {
        console.error('❌ Shop not found for phone +918888888888. Please run seed-dev-shop.ts first.');
        process.exit(1);
    }

    const medicineName = 'Paracetamol 650mg';

    // Clear existing inventory for this medicine to start fresh
    await prisma.shopInventory.deleteMany({
        where: {
            shop_id: shop.id,
            medicine_name: { equals: medicineName, mode: 'insensitive' }
        }
    });

    const today = new Date();
    
    // Batch 1: Soonest Expiry (3 Strips)
    const exp1 = new Date();
    exp1.setMonth(today.getMonth() + 1);
    
    // Batch 2: Middle Expiry (10 Strips)
    const exp2 = new Date();
    exp2.setMonth(today.getMonth() + 6);
    
    // Batch 3: Far Expiry (20 Strips)
    const exp3 = new Date();
    exp3.setMonth(today.getMonth() + 12);

    const batches = [
        {
            shop_id: shop.id,
            medicine_name: medicineName,
            batch_number: 'BATCH-SPLIT-A',
            expiry_date: exp1,
            mrp: 30,
            stock_qty: 3,
            unit: 'strip',
            gst_rate: 12,
        },
        {
            shop_id: shop.id,
            medicine_name: medicineName,
            batch_number: 'BATCH-SPLIT-B',
            expiry_date: exp2,
            mrp: 30,
            stock_qty: 10,
            unit: 'strip',
            gst_rate: 12,
        },
        {
            shop_id: shop.id,
            medicine_name: medicineName,
            batch_number: 'BATCH-SPLIT-C',
            expiry_date: exp3,
            mrp: 30,
            stock_qty: 20,
            unit: 'strip',
            gst_rate: 12,
        }
    ];

    for (const data of batches) {
        await prisma.shopInventory.create({ data });
    }

    console.log(`✅ Seeded 3 batches for "${medicineName}":`);
    console.log(`   1. BATCH-SPLIT-A: 3 qty (Exp: ${exp1.toISOString().split('T')[0]})`);
    console.log(`   2. BATCH-SPLIT-B: 10 qty (Exp: ${exp2.toISOString().split('T')[0]})`);
    console.log(`   3. BATCH-SPLIT-C: 20 qty (Exp: ${exp3.toISOString().split('T')[0]})`);
    console.log('\n🚀 Now try billing 5 strips of "Paracetamol 650mg" without picking a batch.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
