import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/doctor/', '/patient/'], // Prevent indexing of private portals
    },
    sitemap: 'https://rxdesk.in/sitemap.xml',
  };
}
