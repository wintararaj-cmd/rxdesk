import { Metadata } from 'next';
import Link from 'next/link';
import { Store, MapPin, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pharmacy Directory - Find Medical Shops in India | RxDesk',
  description: 'Browse our complete directory of verified, GST-compliant pharmacies and medical shops across India. Find local shops near you in Pandua, Hooghly, and beyond.',
};

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

export default async function PharmacyDirectoryPage() {
  const shops = await getShops();

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-4 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            RxDesk
          </Link>
          <Link href="/" className="text-slate-500 font-bold hover:text-blue-600 transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" /> Back to Search
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Pharmacy Directory</h1>
          <p className="text-slate-500 max-w-2xl mx-auto italic text-lg">
            Find the nearest licensed medical shop for quick home delivery and doctor chambers across West Bengal and India.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400">
               No pharmacies currently listed in the directory.
            </div>
          ) : (
            shops.map((shop: any) => (
              <Link 
                key={shop.id} 
                href={`/pharmacy/${shop.id}`}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Store className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{shop.shop_name}</h2>
                    <div className="flex items-center gap-1 text-slate-400 text-xs mt-1 uppercase font-black">
                       <MapPin className="w-3 h-3" /> {shop.city}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-50">
                   <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                      View Profile & Doctors →
                   </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>

      <footer className="mt-20 py-12 bg-white border-t text-center">
        <p className="text-slate-400 text-sm">© {new Date().getFullYear()} RxDesk Healthcare. India&apos;s Integrated Pharmacy Platform.</p>
      </footer>
    </div>
  );
}
