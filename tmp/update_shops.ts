import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Update the existing shop to approved and assign coordinates
  const updatedShop = await prisma.medicalShop.updateMany({
    where: { shop_name: 'Test Medical Shop' },
    data: {
      verification_status: 'approved',
      latitude: 28.6139, // Delhi
      longitude: 77.2090,
      is_active: true
    }
  });
  console.log(`Updated ${updatedShop.count} shops.`);

  // Create a few more approved shops in major cities to help with testing
  const cities = [
    { name: 'Mumbai Pharmacy', lat: 19.0760, lng: 72.8777, city: 'Mumbai' },
    { name: 'Bangalore Clinic', lat: 12.9716, lng: 77.5946, city: 'Bangalore' },
    { name: 'Hyderabad Meds', lat: 17.3850, lng: 78.4867, city: 'Hyderabad' },
  ];

  for (const c of cities) {
     const exists = await prisma.medicalShop.findFirst({ where: { shop_name: c.name } });
     if (!exists) {
        // Need a user for the shop owner. We'll use the same owner as the Test Medical Shop if found.
        const firstShop = await prisma.medicalShop.findFirst({ select: { owner_user_id: true } });
        if (firstShop) {
           await prisma.medicalShop.create({
              data: {
                 shop_name: c.name,
                 owner_user_id: firstShop.owner_user_id, // Using existing owner for demo
                 shop_type: 'medical_shop',
                 drug_license_no: 'DL-' + Math.floor(Math.random()*10000),
                 address_line: 'Main Road',
                 city: c.city,
                 state: 'India',
                 pin_code: '400001',
                 latitude: c.lat,
                 longitude: c.lng,
                 contact_phone: '9999999999',
                 verification_status: 'approved',
                 is_active: true
              }
           });
           console.log(`Created shop: ${c.name} in ${c.city}`);
        }
     }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
