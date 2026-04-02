import { Metadata } from 'next';
import Link from 'next/link';
import { Store, MapPin, Navigation, Activity, ChevronRight, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.rxdesk.in/api/v1';

interface Shop {
  id: string;
  shop_name: string;
  address_line: string;
  city: string;
  pin_code: string;
  contact_phone: string;
  latitude: number;
  longitude: number;
}

async function getShopsInCity(city: string): Promise<Shop[]> {
  try {
    const res = await axios.get(`${API_URL}/shops/search`, { params: { city } });
    return res.data.data ?? [];
  } catch (err) {
    console.error('Error fetching shops:', err);
    return [];
  }
}

export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const city = decodeURIComponent(params.city);
  return {
    title: `Local Pharmacy in ${city} | Popular Pharmacies & Medical Stores`,
    description: `Find the best and most popular local pharmacies in ${city}. Get contact details, addresses, and book doctor appointments in ${city} via RxDesk.`,
    keywords: [`local pharmacy in ${city}`, `popular pharmacy in ${city}`, `medical store in ${city}`, `chemist in ${city}`, city, 'pharmacy near me'],
  };
}

export default async function PharmacyCityPage({ params }: { params: { city: string } }) {
  const city = decodeURIComponent(params.city);
  const shops = await getShopsInCity(city);

  return (
    <div className="min-h-screen bg-[#09090f] text-white font-sans pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 text-center sm:text-left">
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-300">Pharmacy</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-violet-400 font-bold">{city}</span>
          </nav>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Local Pharmacy in <span className="text-emerald-400 capitalize">{city}</span>
          </h1>
          <p className="text-gray-400 max-w-2xl leading-relaxed">
            Showing verified pharmacies and medical shops in {city}. You can also find specialized doctors available at these locations.
          </p>
        </div>

        {shops.length === 0 ? (
          <div className="bg-[#11111d] border border-white/[0.08] rounded-[2rem] p-12 text-center">
            <Store className="w-16 h-16 text-gray-700 mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2">No pharmacies found in {city} yet</h2>
            <p className="text-gray-500 mb-8">We are rapidly expanding to more cities. Check back soon!</p>
            <Link href="/" className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/20">
              Browse Other Areas
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <div key={shop.id} className="group relative bg-[#11111d]/60 border border-white/[0.08] rounded-[2rem] p-6 hover:border-emerald-500/40 hover:bg-[#1a1a27] transition-all hover:-translate-y-1 shadow-xl">
                <Link href={`/pharmacy/${shop.id}`} className="absolute inset-0 z-0" />
                <div className="relative z-10">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 transition-all">
                      <Store className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">{shop.shop_name}</h3>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {shop.city}
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-6 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                    {shop.address_line}, {shop.pin_code}
                  </p>

                  <div className="flex items-center gap-2">
                    <Link href={`/pharmacy/${shop.id}`} className="flex-1 text-center bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 text-emerald-400 text-xs font-bold py-3 rounded-xl transition-all uppercase tracking-wider">
                      View Details
                    </Link>
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group/nav"
                    >
                      <Navigation className="w-5 h-5 text-gray-500 group-hover/nav:text-white" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-20 border-t border-white/[0.05] pt-16">
          <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-[2.5rem] p-8 sm:p-12 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[80px] rounded-full" />
             <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">Are you a Pharmacy Owner in {city}?</h2>
                <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                  Join India&apos;s fastest growing healthcare network. Manage billing, inventory and doctor appointments with RxDesk.
                </p>
                <Link href="/login?register=1" className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-violet-500/30">
                  <Activity className="w-5 h-5" /> Register My Shop
                </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
