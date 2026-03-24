import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shopCount = await prisma.medicalShop.count();
  const medCount = await prisma.shopMedicine.count();
  const invCount = await prisma.shopInventory.count();
  const sampleMed = await prisma.shopMedicine.findFirst();
  const sampleInv = await prisma.shopInventory.findFirst({
    where: { shop_medicine_id: { not: null } }
  });

  console.log({
    shopCount,
    medCount,
    invCount,
    sampleMed,
    hasLinkedInventory: !!sampleInv,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
