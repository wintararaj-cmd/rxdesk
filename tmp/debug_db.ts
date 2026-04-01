import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shops = await prisma.medicalShop.findMany({ select: { id: true, shop_name: true, gst_type: true, owner_user_id: true } });
  console.log('Shops in DB:', JSON.stringify(shops, null, 2));

  const bills = await prisma.bill.findMany({ 
    orderBy: { created_at: 'desc' }, 
    take: 5,
    include: { items: true }
  });
  console.log('Latest 5 Bills:', JSON.stringify(bills, null, 2));
}

main().finally(() => prisma.$disconnect());
