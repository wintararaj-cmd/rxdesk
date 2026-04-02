import { Metadata } from 'next';
import Link from 'next/link';
import { Stethoscope, MapPin, Calendar, ChevronRight, Star, Clock } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.rxdesk.in/api/v1';

interface DoctorChamber {
  id: string;
  shop: {
    shop_name: string;
    address_line: string;
    city: string;
    pin_code: string;
  };
}

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
  qualifications: string[];
  experience_years: number;
  chambers: DoctorChamber[];
}

async function getDoctorsInCity(city: string): Promise<Doctor[]> {
  try {
    const res = await axios.get(`${API_URL}/doctors/search`, { params: { city, limit: 100 } });
    return res.data.data ?? [];
  } catch (err) {
    console.error('Error fetching doctors:', err);
    return [];
  }
}

export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const city = decodeURIComponent(params.city);
  return {
    title: `Best Doctors in ${city} | Popular Specialists & Clinics`,
    description: `Find top-rated local doctors and popular specialists in ${city}. Book appointments online, check clinic timings, and get consultations in ${city} via RxDesk.`,
    keywords: [`local doctors in ${city}`, `popular doctors in ${city}`, `best doctors in ${city}`, `specialists in ${city}`, `clinics in ${city}`, `doctors near me in ${city}`, city],
  };
}

export default async function DoctorCityPage({ params }: { params: { city: string } }) {
  const city = decodeURIComponent(params.city);
  const doctors = await getDoctorsInCity(city);

  return (
    <div className="min-h-screen bg-[#09090f] text-white font-sans pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 text-center sm:text-left">
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-300">Doctors</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-violet-400 font-bold">{city}</span>
          </nav>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Popular Doctors in <span className="text-violet-400 capitalize">{city}</span>
          </h1>
          <p className="text-gray-400 max-w-2xl leading-relaxed">
            Find and book appointments with verified healthcare specialists sitting at reputable pharmacies and clinics across {city}.
          </p>
        </div>

        {doctors.length === 0 ? (
          <div className="bg-[#11111d] border border-white/[0.08] rounded-[2rem] p-12 text-center">
            <Stethoscope className="w-16 h-16 text-gray-700 mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2">No doctors found in {city} yet</h2>
            <p className="text-gray-500 mb-8">We are onboarding more specialists in your area. Use our app to stay updated!</p>
            <Link href="/" className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/20">
              Try Another City
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doc) => (
              <div key={doc.id} className="group flex flex-col bg-[#11111d]/60 border border-white/[0.08] rounded-[2.5rem] p-6 hover:border-violet-500/40 hover:bg-[#1a1a27] transition-all hover:-translate-y-1 shadow-xl">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center text-violet-400 font-black text-lg">
                      {doc.full_name[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors line-clamp-1">Dr. {doc.full_name}</h3>
                      <p className="text-xs text-violet-400 font-bold uppercase tracking-wider">{doc.specialization}</p>
                    </div>
                 </div>

                 <div className="space-y-3 mb-8 flex-1">
                    <div className="flex items-start gap-2 text-xs text-gray-400">
                       <Star className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                       <span>{doc.experience_years}+ years experience</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-gray-400">
                       <MapPin className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                       <div className="line-clamp-2">
                          Sitting at {doc.chambers?.length > 0 ? doc.chambers[0].shop.shop_name : 'Local Clinics'}
                       </div>
                    </div>
                 </div>

                 <Link href={`/doctor/${doc.id}`} className="w-full text-center bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" /> Book Appointment
                 </Link>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 flex flex-wrap justify-center gap-3">
           <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-500">
             #PopularDoctorsIn{city.replace(/\s+/g, '')}
           </div>
           <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-500">
             #LocalClinicIn{city.replace(/\s+/g, '')}
           </div>
           <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-500">
             #MedicalServices{city.replace(/\s+/g, '')}
           </div>
        </div>
      </div>
    </div>
  );
}
