import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ShareButtons from '../../../components/ShareButtons';

async function getShop(id: string) {
  const res = await fetch(`https://backend.rxdesk.in/api/v1/shops/${id}`, {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

type Props = {
  params: { id: string };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const shop = await getShop(params.id);
  if (!shop) return { title: 'Pharmacy Not Found - RxDesk' };

  const shopName = shop.shop_name;
  const city = shop.city;
  const description = `Visit ${shopName} in ${city} for all your healthcare and medicine needs. Located at ${shop.address_line}. GST and Drug License compliant pharmacy. Call ${shop.contact_phone} for home delivery or queries.`;

  return {
    title: `${shopName} - Pharmacy in ${city} | RxDesk`,
    description,
    keywords: [
      `${shopName} pharmacy`,
      `medical shop in ${city}`,
      `chemist in ${city}`,
      `pharmacy near me ${city}`,
      shop.pin_code ? `pharmacy in ${shop.pin_code}` : '',
    ].filter(Boolean),
    openGraph: {
      type: 'website',
      title: `${shopName} - Trusted Pharmacy in ${city}`,
      description,
      url: `https://rxdesk.in/pharmacy/${params.id}`,
    },
  };
}

export default async function ShopProfilePage({ params }: Props) {
  const shop = await getShop(params.id);
  if (!shop) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Pharmacy',
    'name': shop.shop_name,
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': shop.address_line,
      'addressLocality': shop.city,
      'addressRegion': shop.state,
      'postalCode': shop.pin_code,
      'addressCountry': 'IN',
    },
    'telephone': shop.contact_phone,
    'openingHours': shop.opening_time && shop.closing_time ? `${shop.opening_time}-${shop.closing_time}` : undefined,
    'geo': shop.latitude && shop.longitude ? {
      '@type': 'GeoCoordinates',
      'latitude': shop.latitude,
      'longitude': shop.longitude,
    } : undefined,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Navigation Header */}
      <nav className="bg-white border-b px-4 py-3 flex items-center sticky top-0 z-50">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          RxDesk
        </Link>
        <span className="mx-3 text-slate-300">/</span>
        <Link href="/" className="text-slate-500 font-medium hover:text-blue-600 transition-colors">Pharmacy Directory</Link>
        <span className="mx-3 text-slate-300">/</span>
        <span className="text-slate-500 font-medium truncate">{shop.shop_name}</span>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Shop Header & Info */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                      Verified Shop
                    </span>
                  </div>
                  <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{shop.shop_name}</h1>
                  <p className="text-lg text-slate-600 flex items-start gap-2">
                    <svg className="w-5 h-5 mt-1 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {shop.address_line}, {shop.city}, {shop.state} - {shop.pin_code}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Open From</p>
                  <p className="font-semibold text-slate-800">{shop.opening_time || '09:00 AM'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Closing At</p>
                  <p className="font-semibold text-slate-800">{shop.closing_time || '10:00 PM'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Drug License</p>
                  <p className="font-semibold text-slate-800 text-sm truncate">{shop.drug_license_no}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Service area</p>
                  <p className="font-semibold text-blue-600">Home Delivery</p>
                </div>
              </div>
            </div>

            {/* Doctor Chambers Section */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
                <h2 className="text-2xl font-bold text-slate-900 capitalize">Doctors in this Pharmacy</h2>
              </div>

              {shop.chambers && shop.chambers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shop.chambers.map((chamber: any) => (
                    <div key={chamber.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-blue-300 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 overflow-hidden shrink-0">
                          {chamber.doctor?.profile_photo ? (
                            <img src={chamber.doctor.profile_photo} alt={chamber.doctor.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">Dr. {chamber.doctor?.full_name}</h3>
                          <p className="text-sm font-medium text-slate-500">{chamber.doctor?.specialization}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Consultation Hours</p>
                        {chamber.schedules && chamber.schedules.length > 0 ? (
                          <div className="space-y-1">
                            {chamber.schedules.map((s: any) => (
                              <div key={s.id} className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 font-medium">{s.day_of_week}</span>
                                <span className="text-slate-800 font-bold">{s.start_time} - {s.end_time}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No schedule published yet.</p>
                        )}
                      </div>
                      
                      <div className="mt-6 flex items-center justify-between">
                         <span className="text-[10px] font-black text-violet-500 uppercase bg-violet-50 px-2 py-0.5 rounded border border-violet-100">₹{chamber.consultation_fee || '499'} Fee</span>
                         <Link href={`/doctor/${chamber.doctor_id}`} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 group">
                           Book Now
                           <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                         </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center">
                  <p className="text-slate-600 font-medium italic">No doctor chambers currently active at this location.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Sticky Actions */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              
              {/* Call to Action Card */}
              <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-200">
                <div className="text-blue-100 font-bold uppercase tracking-widest text-xs mb-4">Contact Shop</div>
                <div className="text-2xl font-bold mb-6 italic">Looking for home delivery or medicine stocks?</div>
                
                <a href={`tel:${shop.contact_phone}`} className="w-full bg-white text-blue-600 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-50 transition-colors shadow-lg group">
                  <svg className="w-5 h-5 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                  Call Pharmacy
                </a>
              </div>

              {/* Share Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
                <h4 className="font-bold text-slate-900 mb-2 italic text-lg">Save this profile for emergency</h4>
                <p className="text-slate-500 text-sm mb-4 italic">Get live stocks and pricing on WhatsApp</p>
                <ShareButtons shopName={shop.shop_name} id={shop.id} />
              </div>

              {/* Trust Badge */}
              <div className="text-center p-4">
                <p className="text-xs text-slate-400 font-medium">Digital healthcare powered by</p>
                <p className="text-sm font-bold text-slate-600">RxDesk Intelligence India</p>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer Branding */}
      <footer className="mt-20 py-12 bg-white border-t text-center">
        <p className="text-slate-400 text-sm">© {new Date().getFullYear()} RxDesk Healthcare. All rights reserved.</p>
        <p className="text-slate-300 text-xs mt-2 uppercase tracking-widest font-bold">GST Compliant & Licensed Pharmacies</p>
      </footer>
    </div>
  );
}
