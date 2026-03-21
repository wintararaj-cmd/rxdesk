import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const subs = await prisma.shopSubscription.findMany({
    include: { shop: true, plan: true }
  });
  console.log(JSON.stringify(subs, null, 2));
}
main().finally(() => prisma.$disconnect());
