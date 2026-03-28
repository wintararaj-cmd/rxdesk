import prisma from '../../config/database';

export async function getDeadStock(shopId: string, monthsThreshold: number = 3) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsThreshold);

  // Get items with stock > 0
  const inventoryItems = await prisma.shopInventory.findMany({
    where: { shop_id: shopId, stock_qty: { gt: 0 } },
    select: { id: true, medicine_name: true, batch_number: true, stock_qty: true, purchase_price: true, updated_at: true },
  });

  const deadStock = [];
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

  const suggestions = [];
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
