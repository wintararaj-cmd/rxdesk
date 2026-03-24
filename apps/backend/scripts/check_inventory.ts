import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.purchaseItem.findMany({
    where: { medicine_id: '' }
  });
  console.log(`Purchase items with empty string medicine_id: ${items.length}`);
  for (const it of items) {
    console.log(`- Item ID: ${it.id} | Purchase ID: ${it.purchase_id} | Name: ${it.medicine_name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
