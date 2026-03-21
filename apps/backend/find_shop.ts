import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const customer = await prisma.creditCustomer.findFirst({
    where: { name: { contains: 'Amitabha', mode: 'insensitive' } },
    include: { shop: true }
  });
  if (customer) {
    console.log(`Found Amitabha in Shop: ${customer.shop.shop_name} (ID: ${customer.shop.id})`);
  } else {
    // Check Bills
    const bill = await prisma.bill.findFirst({
        where: { customer_name: { contains: 'Amitabha', mode: 'insensitive' } },
        include: { shop: true }
    });
    if (bill) {
        console.log(`Found Amitabha in Bills for Shop: ${bill.shop.shop_name} (ID: ${bill.shop.id})`);
    } else {
        console.log('Amitabha not found in any shop.');
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
