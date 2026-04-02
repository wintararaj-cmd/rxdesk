import { MetadataRoute } from 'next';

const BACKEND_URL = 'https://backend.rxdesk.in/api/v1';

async function getShops() {
  try {
    const res = await fetch(`${BACKEND_URL}/shops/public/list`, {
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}

async function getDoctors() {
  try {
    const res = await fetch(`${BACKEND_URL}/doctors/search?limit=200`, {
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}

async function getSEOMetadata() {
  try {
    const res = await fetch(`${BACKEND_URL}/public/seo-metadata`, {
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    return json.data || { shop_cities: [], doctor_cities: [], specializations: [] };
  } catch (e) {
    return { shop_cities: [], doctor_cities: [], specializations: [] };
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://rxdesk.in';

  // Core static routes
  const staticRoutes = [
    '',
    '/contact',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Dynamic Discovery Profiles
  const [shops, doctors, seoData] = await Promise.all([
    getShops(), 
    getDoctors(),
    getSEOMetadata()
  ]);

  const shopRoutes = shops.map((shop: any) => ({
    url: `${baseUrl}/pharmacy/${shop.id}`,
    lastModified: new Date(shop.updated_at || new Date()),
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }));

  const doctorRoutes = doctors.map((doc: any) => ({
    url: `${baseUrl}/doctor/${doc.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.95,
  }));

  // City-specific SEO pages
  const shopCityRoutes = seoData.shop_cities.map((city: string) => ({
    url: `${baseUrl}/pharmacy/city/${encodeURIComponent(city.toLowerCase())}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  const doctorCityRoutes = seoData.doctor_cities.map((city: string) => ({
    url: `${baseUrl}/doctor/city/${encodeURIComponent(city.toLowerCase())}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  const specializationRoutes = seoData.specializations.map((spec: string) => ({
    url: `${baseUrl}/doctor/specialization/${encodeURIComponent(spec.toLowerCase())}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [
    ...staticRoutes, 
    ...shopRoutes, 
    ...doctorRoutes,
    ...shopCityRoutes,
    ...doctorCityRoutes,
    ...specializationRoutes
  ];
}
