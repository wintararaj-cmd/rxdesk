import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { phone: true, id: true } });
  const shops = await prisma.medicalShop.findMany();
  console.log({ users, shops });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
