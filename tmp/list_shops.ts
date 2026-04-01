import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const shops = await prisma.medicalShop.findMany({ select: { id: true, shop_name: true, owner_user_id: true } });
  console.log('Shops:', JSON.stringify(shops, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
