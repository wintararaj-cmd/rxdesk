import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cities = [
    { name: 'Mumbai Pharmacy', lat: 19.0760, lng: 72.8777, city: 'Mumbai', phone: '9999990001' },
    { name: 'Bangalore Clinic', lat: 12.9716, lng: 77.5946, city: 'Bangalore', phone: '9999990002' },
    { name: 'Hyderabad Meds', lat: 17.3850, lng: 78.4867, city: 'Hyderabad', phone: '9999990003' },
    { name: 'Chennai Store', lat: 13.0827, lng: 80.2707, city: 'Chennai', phone: '9999990004' },
    { name: 'Kolkata Druggist', lat: 22.5726, lng: 88.3639, city: 'Kolkata', phone: '9999990005' },
    { name: 'Pune Pharmacy', lat: 18.5204, lng: 73.8567, city: 'Pune', phone: '9999990006' },
  ];

  for (const c of cities) {
     const shopExists = await prisma.medicalShop.findFirst({ where: { shop_name: c.name } });
     if (!shopExists) {
        // Create a new user for each shop to satisfy the unique constraint
        let user = await prisma.user.findUnique({ where: { phone: c.phone } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    phone: c.phone,
                    role: 'shop_owner',
                    is_active: true,
                    is_verified: true
                }
            });
        }
        
        await prisma.medicalShop.create({
            data: {
                shop_name: c.name,
                owner_user_id: user.id,
                shop_type: 'medical_shop',
                drug_license_no: 'DL-' + Math.floor(Math.random()*100000),
                address_line: 'Demo Plaza',
                city: c.city,
                state: 'India',
                pin_code: '110001',
                latitude: c.lat,
                longitude: c.lng,
                contact_phone: c.phone,
                verification_status: 'approved',
                is_active: true
            }
        });
        console.log(`Created shop: ${c.name} in ${c.city}`);
     }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
