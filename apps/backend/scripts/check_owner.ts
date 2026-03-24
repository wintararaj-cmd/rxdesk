import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.medicalShop.findFirst();
  const owner = await prisma.user.findUnique({ where: { id: shop?.owner_user_id || '' } });
  console.log({
    shopId: shop?.id,
    shopName: shop?.shop_name,
    ownerPhone: owner?.phone,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
