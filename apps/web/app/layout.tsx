import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RxDesk — Pharmacy Billing Software & Doctor Appointment Management India',
  description: 'RxDesk is India\'s leading pharmacy billing and doctor appointment management software. GST-compliant medicine billing, inventory management, HSN-coded invoices, and online appointment scheduling for medical shops and clinics.',
  keywords: [
    'pharmacy billing software India',
    'medical shop billing software',
    'GST pharmacy billing',
    'doctor appointment management',
    'medicine inventory management',
    'digital prescription software',
    'online doctor appointment booking',
    'pharmacy management system',
    'clinic management software India',
    'HSN code medicine billing',
    'GST compliant medical billing',
    'RxDesk pharmacy',
  ],
  authors: [{ name: 'RxDesk' }],
  creator: 'RxDesk',
  publisher: 'RxDesk',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://rxdesk.in' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://rxdesk.in',
    siteName: 'RxDesk',
    title: 'RxDesk — Pharmacy Billing & Doctor Appointment Management',
    description: 'Complete pharmacy billing software with GST invoicing, medicine inventory, and integrated doctor appointment management. Trusted by 200+ clinics across India.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RxDesk — Pharmacy Billing & Appointment Management',
    description: 'GST-compliant pharmacy billing, live medicine inventory, and doctor appointment management in one powerful platform.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://rxdesk.in/#organization',
      name: 'RxDesk',
      url: 'https://rxdesk.in',
      description: "India's integrated pharmacy billing and doctor appointment management platform",
      foundingDate: '2025',
      areaServed: 'IN',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'RxDesk',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS',
      description: 'GST-compliant pharmacy billing software with integrated doctor appointment management for Indian medical shops and clinics.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      featureList: [
        'GST Compliant Billing',
        'HSN Coded Invoices',
        'Medicine Inventory Management',
        'Doctor Appointment Scheduling',
        'Digital Prescriptions',
        'Financial Reports & GST Returns',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://rxdesk.in/#website',
      url: 'https://rxdesk.in',
      name: 'RxDesk',
      publisher: { '@id': 'https://rxdesk.in/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://rxdesk.in/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
