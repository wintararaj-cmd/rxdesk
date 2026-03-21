import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const plans = await prisma.subscriptionPlan.findMany();
  console.log('--- PLANS ---');
  plans.forEach(p => console.log(`${p.name}: Max Doctors=${p.max_doctors}, Max Sessions=${p.max_sessions}`));

  const subscriptions = await prisma.shopSubscription.findMany({
    include: { shop: true, plan: true }
  });
  console.log('\n--- SUBSCRIPTIONS ---');
  subscriptions.forEach(s => {
    console.log(`Shop: ${s.shop.shop_name} (${s.shop.owner_user_id}), Plan: ${s.plan.name}, Status: ${s.status}, Max Sessions: ${s.plan.max_sessions}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
