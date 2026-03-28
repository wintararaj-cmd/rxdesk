import prisma from '../../config/database';

export async function getDeadStock(shopId: string, monthsThreshold: number = 3) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsThreshold);

  // Get items with stock > 0
  const inventoryItems = await prisma.shopInventory.findMany({
    where: { shop_id: shopId, stock_qty: { gt: 0 } },
    select: { id: true, medicine_name: true, batch_number: true, stock_qty: true, purchase_price: true, updated_at: true },
  });

  const deadStock: any[] = [];
  for (const item of inventoryItems) {
    // Check if it has been sold since the cutoff date
    const recentSale = await prisma.billItem.findFirst({
      where: {
        inventory_id: item.id,
        bill: {
          created_at: { gte: cutoffDate }
        }
      }
    });

    // Also check if it hasn't been updated recently (so we don't flag brand new items)
    if (!recentSale && item.updated_at < cutoffDate) {
      deadStock.push(item);
    }
  }

  return deadStock;
}

export async function getPredictiveOrderingDetails(shopId: string) {
  // Simple predictive model: look at sales from exactly 1 month ago as a baseline run rate
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  // Aggregate quantity sold in the prior 30-day window
  const salesData = await prisma.billItem.groupBy({
    by: ['medicine_name'],
    where: {
      bill: {
        shop_id: shopId,
        created_at: { gte: twoMonthsAgo, lt: oneMonthAgo },
      }
    },
    _sum: {
      quantity: true
    }
  });

  const suggestions: any[] = [];
  for (const sale of salesData) {
    if (!sale._sum.quantity || sale._sum.quantity <= 0) continue;

    // Check current stock of this medicine
    const currentStockAgg = await prisma.shopInventory.aggregate({
      where: { shop_id: shopId, medicine_name: sale.medicine_name },
      _sum: { stock_qty: true }
    });
    const currentStock = currentStockAgg._sum.stock_qty || 0;

    // Suggest ordering if current stock is less than 50% of last month's sales
    if (currentStock < sale._sum.quantity * 0.5) {
      suggestions.push({
        medicine_name: sale.medicine_name,
        monthly_run_rate: sale._sum.quantity,
        current_stock: currentStock,
        suggested_order_qty: sale._sum.quantity - currentStock,
      });
    }
  }

  // Sort descending by suggested order quantity
  return suggestions.sort((a, b) => b.suggested_order_qty - a.suggested_order_qty);
}

export async function getRefillReminders(shopId: string) {
  const today = new Date();
  const searchStart = new Date();
  searchStart.setDate(today.getDate() - 40);
  
  const searchEnd = new Date();
  searchEnd.setDate(today.getDate() - 15);

  const bills = await prisma.bill.findMany({
    where: {
      shop_id: shopId,
      customer_phone: { not: null },
      created_at: {
        gte: searchStart,
        lte: searchEnd,
      }
    },
    include: {
      items: {
        include: {
          inventory: {
            select: { unit: true }
          }
        }
      }
    }
  });

  const reminders: any[] = [];
  
  for (const bill of bills) {
    if (!bill.customer_phone || bill.customer_phone.length < 10) continue;
    
    for (const item of bill.items) {
      // Estimate days supply based on unit and quantity
      let daysSupply = item.quantity;
      const unit = item.inventory?.unit?.toLowerCase() || 'strip';
      
      if (unit === 'strip') {
        daysSupply = item.quantity * 10; // Assume 1 strip = 10 tabs = 10 days
      } else if (unit === 'box') {
        daysSupply = item.quantity * 30; // Assume 1 box = 30 days
      } else if (unit === 'bottle' || unit === 'syrup') {
        daysSupply = item.quantity * 15; // Assume 1 bottle = 15 days
      }

      // Filter out low supply which aren't likely chronic meds
      if (daysSupply < 15) continue;
      
      const estimatedEmptyDate = new Date(bill.created_at);
      estimatedEmptyDate.setDate(estimatedEmptyDate.getDate() + daysSupply);
      
      const diffDays = (estimatedEmptyDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
      
      // If they are likely to run out within 7 days, or ran out up to 5 days ago
      if (diffDays >= -5 && diffDays <= 7) {
        reminders.push({
          id: item.id,
          customer_name: bill.customer_name || 'Customer',
          customer_phone: bill.customer_phone,
          medicine_name: item.medicine_name,
          last_purchase_date: bill.created_at,
          last_quantity: item.quantity,
          unit: unit,
          estimated_empty_date: estimatedEmptyDate,
          days_remaining: Math.round(diffDays)
        });
      }
    }
  }

  // Sort by days_remaining ascending (closest to running out / ran out first)
  return reminders.sort((a, b) => a.days_remaining - b.days_remaining);
}
