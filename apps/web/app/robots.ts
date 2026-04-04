import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/doctor/dashboard/', '/doctor/login/', '/patient/dashboard/', '/patient/login/', '/pharmacy/dashboard/', '/pharmacy/login/'], // Prevent indexing of private portals
    },
    sitemap: 'https://rxdesk.in/sitemap.xml',
  };
}
