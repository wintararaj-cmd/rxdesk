import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.medicalShop.findFirst();
  if (!shop) return;
  const shopId = shop.id;
  const mName = "TEST MEDICINE";
  const bNumber = "";
  
  // Clean up
  await prisma.shopInventory.deleteMany({ where: { shop_id: shopId, medicine_name: mName } });
  
  // 1. Create UNLINKED record
  await prisma.shopInventory.create({
    data: {
      shop_id: shopId,
      medicine_id: null,
      medicine_name: mName,
      batch_number: null,
      mrp: 100,
      stock_qty: -10,
    }
  });

  console.log('Created UNLINKED record');

  // 2. Simulate Purchase with LINKED ID
  const medId = (await prisma.medicine.findFirst())?.id;
  if (!medId) return;
  
  await prisma.$transaction(async (tx) => {
    const existing = await tx.shopInventory.findFirst({
      where: {
        shop_id: shopId,
        AND: [
          { OR: [ { medicine_id: medId }, { medicine_name: { equals: mName, mode: 'insensitive' } } ] },
          bNumber === '' ? { OR: [{ batch_number: '' }, { batch_number: null }] } : { batch_number: { equals: bNumber, mode: 'insensitive' } }
        ]
      }
    });

    if (existing) {
      await tx.shopInventory.update({
        where: { id: existing.id },
        data: { 
          stock_qty: { increment: 12 },
          ...(medId ? { medicine_id: medId } : {}) // THIS LINKING PART
        }
      });
    }
  });

  console.log('Updated! (Now LINKED)');

  // 3. Simulate ANOTHER Purchase with LINKED ID but different Name case
  await prisma.$transaction(async (tx) => {
    const existing = await tx.shopInventory.findFirst({
      where: {
        shop_id: shopId,
        AND: [
          { OR: [ { medicine_id: medId }, { medicine_name: { equals: "test medicine", mode: 'insensitive' } } ] },
          bNumber === '' ? { OR: [{ batch_number: '' }, { batch_number: null }] } : { batch_number: { equals: bNumber, mode: 'insensitive' } }
        ]
      }
    });

    if (existing) {
      await tx.shopInventory.update({
        where: { id: existing.id },
        data: { stock_qty: { increment: 5 } }
      });
    }
  });

  const finalInv = await prisma.shopInventory.findMany({ where: { shop_id: shopId, medicine_name: mName } });
  console.log('Final Inventory rows:');
  console.table(finalInv.map(i => ({ id: i.id, mid: i.medicine_id, stock: i.stock_qty })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
