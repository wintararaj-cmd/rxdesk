import { createManualBill } from '../apps/backend/src/modules/bills/bill.service';
import prisma from '../apps/backend/src/config/database';

async function test() {
  const userId = "4451e88b-a052-41a5-8361-dc9387eea5a5"; 
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) { console.log('Shop not found'); return; }
  
  const inventory = await prisma.shopInventory.findFirst({ where: { shop_id: shop.id } });
  
  const payload: any = {
    customer_name: "Test Customer",
    customer_phone: "9830450252",
    items: [
      {
        medicine_name: inventory ? inventory.medicine_name : "CROCIN 650 TAB 10 TAB",
        mrp: inventory ? Number(inventory.mrp) : 90,
        quantity: 2,
        inventory_id: inventory ? inventory.id : undefined,
        discount_type: 'percentage',
        discount_value: 0
      }
    ],
    payment_method: 'cash',
    payment_status: 'paid',
    discount_amount: 0
  };

  try {
    const result = await createManualBill(userId, payload);
    console.log('Success!', result.bill_number);
  } catch (err: any) {
    console.error('FAILED ERROR:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

test().finally(() => prisma.$disconnect());
