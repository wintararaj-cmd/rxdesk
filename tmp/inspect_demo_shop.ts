import { PrismaClient, GstType } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.medicalShop.findFirst({
    where: { shop_name: 'Demo Shop' }
  });
  console.log('Demo Shop Config:', JSON.stringify(shop, null, 2));
}

main().finally(() => prisma.$disconnect());
