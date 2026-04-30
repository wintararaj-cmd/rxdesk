import { createManualBill } from '../apps/backend/src/modules/bills/bill.service';
import { PrismaClient } from '@prisma/client';

async function main() {
  const userId = '640b18b0-6686-427f-9bfe-7bc7b4287a47'; // Owner of Demo Shop
  const data = {
    customer_name: 'Test Customer',
    customer_phone: '1234567890',
    items: [
      {
        medicine_name: 'CROCIN 650 TAB 10 TAB',
        mrp: 90,
        quantity: 2,
        discount_type: 'percentage' as const,
        discount_value: 2
      }
    ],
    payment_method: 'cash' as const
  };

  try {
    console.log('Attempting to create bill...');
    const bill = await createManualBill(userId, data);
    console.log('Bill created successfully:', bill.id);
  } catch (err: any) {
    console.error('Error creating bill:', err);
    if (err.details) console.error('Details:', err.details);
  }
}

main();
