import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
async function run() {
  try {
    const inv = await p.shopInventory.count();
    const med = await p.medicine.count();
    console.log("shopInventory count:", inv);
    console.log("medicine count:", med);
  } catch(e: any) {
    console.error("ERR:", e.message);
  } finally {
    await p.$disconnect();
  }
}
run();
