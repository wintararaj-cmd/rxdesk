import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const meds = await prisma.medicine.findMany({
    where: { name: { contains: 'PARACETAMOL', mode: 'insensitive' } },
    take: 10
  });
  console.log(`Matching catalog medicines: ${meds.length}`);
  for (const m of meds) {
    console.log(`- "${m.name}" | ID: ${m.id}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
