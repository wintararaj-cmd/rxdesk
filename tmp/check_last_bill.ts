import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const lastBill = await prisma.bill.findFirst({
    orderBy: { created_at: 'desc' },
    select: { bill_number: true, created_at: true, shop_id: true }
  });
  console.log('Last Bill:', JSON.stringify(lastBill, null, 2));
  
  const totalBills = await prisma.bill.count();
  console.log('Total Bills:', totalBills);
}
main().catch(console.error).finally(() => prisma.$disconnect());
