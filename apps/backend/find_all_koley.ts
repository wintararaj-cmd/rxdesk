import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const bills = await prisma.bill.findMany({ select: { customer_name: true, shop_id: true } });
  const koley = bills.filter(b => (b.customer_name || '').toLowerCase().includes('koley'));
  console.log('Koley bills:', koley);

  const customers = await prisma.creditCustomer.findMany({ select: { name: true, shop_id: true } });
  const koleyC = customers.filter(c => (c.name || '').toLowerCase().includes('koley'));
  console.log('Koley customers:', koleyC);
}

check().catch(console.error).finally(() => prisma.$disconnect());
