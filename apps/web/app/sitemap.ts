import { MetadataRoute } from 'next';

async function getShops() {
  try {
    const res = await fetch('https://backend.rxdesk.in/api/v1/shops/public/list', {
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
    const res = await fetch('https://backend.rxdesk.in/api/v1/doctors/search?limit=100', {
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
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

  // Dynamic Discovery Profiles (Justdial SEO Model)
  const [shops, doctors] = await Promise.all([getShops(), getDoctors()]);

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

  return [...staticRoutes, ...shopRoutes, ...doctorRoutes];
}
