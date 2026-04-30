const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users in DB (CommonJS):', JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
