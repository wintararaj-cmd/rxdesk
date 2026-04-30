import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { phone: '+917777777777' } });
  console.log('User:', JSON.stringify(users, null, 2));
  if (users.length > 0) {
    const shop = await prisma.medicalShop.findFirst({ where: { owner_user_id: users[0].id } });
    console.log('Shop for User:', JSON.stringify(shop, null, 2));
  }
}

main().finally(() => prisma.$disconnect());
