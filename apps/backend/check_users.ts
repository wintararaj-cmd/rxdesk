import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, phone: true, role: true, is_active: true, is_verified: true, password: true }
  });
  console.log('Current Users:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

check();
