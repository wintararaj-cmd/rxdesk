import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shops = await prisma.medicalShop.findMany();
  console.log('Shops:', JSON.stringify(shops, null, 2));

  for (const shop of shops) {
    const customers = await prisma.creditCustomer.findMany({ where: { shop_id: shop.id } });
    const suppliers = await prisma.supplier.findMany({ where: { shop_id: shop.id } });
    const purchases = await prisma.purchaseEntry.findMany({ where: { shop_id: shop.id } });
    const payments = await prisma.supplierPayment.findMany({ where: { shop_id: shop.id } });

    console.log(`Shop: ${shop.shop_name} (${shop.id})`);
    console.log(`- Customers: ${customers.length}`);
    console.log(`- Suppliers: ${suppliers.length}`);
    console.log(`- Purchases: ${purchases.length}`);
    console.log(`- Payments: ${payments.length}`);
    
    if (customers.length > 0) {
      console.log('  Customer Total Outstanding Sum:', customers.reduce((s, c) => s + Number(c.total_outstanding), 0));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
