const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const barcode = '724860021272';
  console.log(`Checking barcode: ${barcode}`);
  
  const shopMed = await prisma.shopMedicine.findFirst({
    where: { barcode }
  });
  console.log('ShopMedicine:', shopMed);

  const shopInv = await prisma.shopInventory.findFirst({
    where: { barcode }
  });
  console.log('ShopInventory:', shopInv);

  const globalMed = await prisma.medicine.findFirst({
    where: { barcode }
  });
  console.log('GlobalMedicine:', globalMed);

  process.exit(0);
}

check();
