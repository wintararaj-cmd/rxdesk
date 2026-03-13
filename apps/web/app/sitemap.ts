import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://rxdesk.in';

  // These are the core public marketing/SEO pages you want indexed
  const routes = [
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

  // You can also dynamically fetch blog posts, top doctors, or landing pages here from your database later

  return [...routes];
}
