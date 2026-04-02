import prisma from '../../config/database';

export async function getSEOMetadata() {
  // Get all unique cities with approved shops
  const shopCities = await prisma.medicalShop.findMany({
    where: { 
      is_active: true, 
      verification_status: 'approved' 
    },
    select: { city: true },
    distinct: ['city'],
  });

  // Get all unique specializations from approved doctors
  const specializations = await prisma.doctor.findMany({
    where: { 
      verification_status: 'approved' 
    },
    select: { specialization: true },
    distinct: ['specialization'],
  });

  // Get all unique cities where doctors have approved chambers
  const doctorCities = await prisma.doctorChamber.findMany({
    where: { 
      status: 'active',
      shop: { is_active: true, verification_status: 'approved' }
    },
    select: { 
      shop: { select: { city: true } } 
    },
    distinct: ['shop_id'], // Not exactly distinct city, but we'll map it
  });

  const uniqueShopCities = shopCities.map(s => s.city.trim()).filter(Boolean);
  const uniqueSpecs = specializations.map(d => d.specialization?.trim()).filter(Boolean);
  const uniqueDoctorCities = Array.from(new Set(doctorCities.map(dc => dc.shop.city.trim()).filter(Boolean)));

  return {
    shop_cities: uniqueShopCities,
    doctor_cities: uniqueDoctorCities,
    specializations: uniqueSpecs,
  };
}
