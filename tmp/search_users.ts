import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { phone: { contains: '77777' } } });
  console.log('Users:', JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
