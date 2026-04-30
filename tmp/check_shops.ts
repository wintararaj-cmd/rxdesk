import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shops = await prisma.medicalShop.findMany({
    select: {
      id: true,
      shop_name: true,
      is_active: true,
      verification_status: true,
      latitude: true,
      longitude: true,
    }
  });
  console.log(JSON.stringify(shops, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
