import { Metadata } from 'next';
import Link from 'next/link';
import { Stethoscope, MapPin, Calendar, ChevronRight, Star, Clock, UserCheck } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.rxdesk.in/api/v1';

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
  qualifications: string[];
  experience_years: number;
  profile_photo?: string;
  chambers: {
    id: string;
    consultation_fee: number;
    shop: {
      shop_name: string;
      city: string;
      address_line: string;
    };
  }[];
}

async function getDoctorsBySpecialization(spec: string): Promise<Doctor[]> {
  try {
    const res = await axios.get(`${API_URL}/doctors/search`, { 
      params: { specialization: spec, limit: 100 } 
    });
    return res.data.data ?? [];
  } catch (err) {
    console.error('Error fetching doctors:', err);
    return [];
  }
}

export async function generateMetadata({ params }: { params: { spec: string } }): Promise<Metadata> {
  const spec = decodeURIComponent(params.spec);
  const title = `Best ${spec}s Near Me | Book Online Doctor Appointment | RxDesk`;
  const description = `Find top-rated ${spec}s for consultations and online appointments. Compare experience, clinic timings, and consultation fees for verified ${spec}s via RxDesk.`;
  
  return {
    title,
    description,
    keywords: [
      `best ${spec} near me`,
      `top ${spec} in India`,
      `online appointment for ${spec}`,
      `${spec} doctor profile`,
      `doctor specialization ${spec}`,
      spec
    ],
  };
}

export default async function SpecializationPage({ params }: { params: { spec: string } }) {
  const spec = decodeURIComponent(params.spec);
  const doctors = await getDoctorsBySpecialization(spec);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    'name': `Best ${spec}s on RxDesk`,
    'description': `Directory of verified ${spec}s for online appointment booking.`,
    'itemListElement': doctors.slice(0, 10).map((doc, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'Physician',
        'name': `Dr. ${doc.full_name}`,
        'medicalSpecialty': doc.specialization,
        'url': `https://rxdesk.in/doctor/${doc.id}`
      }
    }))
  };

  return (
    <div className="min-h-screen bg-[#09090f] text-white font-sans pt-24 pb-16 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-6xl mx-auto">
        {/* Breadcrumbs */}
        <div className="mb-10 text-center sm:text-left">
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/" className="hover:text-white">Specialists</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-violet-400 font-bold capitalize">{spec}</span>
          </nav>
          
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4 flex items-center gap-4 justify-center sm:justify-start">
            <span className="bg-violet-600/20 p-3 rounded-2xl border border-violet-500/30">
               <Stethoscope className="w-8 h-8 text-violet-400" />
            </span>
            Best <span className="text-violet-400 capitalize">{spec}s</span> Near Me
          </h1>
          <p className="text-gray-400 max-w-2xl leading-relaxed text-lg italic">
            Book online appointments with verified {spec}s and medical experts from top clinics and pharmacies in your area.
          </p>
        </div>

        {doctors.length === 0 ? (
          <div className="bg-[#11111d]/60 border border-white/[0.08] rounded-[3rem] p-16 text-center shadow-2xl backdrop-blur-sm">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
               <UserCheck className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">No {spec}s found yet</h2>
            <p className="text-gray-500 mb-10 max-w-md mx-auto">We are currently onboarding more {spec}s to our network. You can explore other specializations or try again later.</p>
            <Link href="/" className="px-8 py-4 bg-violet-600 hover:bg-violet-700 rounded-2xl text-sm font-black transition-all shadow-xl shadow-violet-500/20 active:scale-95 inline-block">
              Back to Directory
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {doctors.map((doc) => (
              <div key={doc.id} className="group relative flex flex-col bg-[#11111d]/60 border border-white/[0.08] rounded-[2.5rem] p-8 hover:border-violet-500/40 hover:bg-[#1a1a27] transition-all hover:-translate-y-2 shadow-2xl overflow-hidden backdrop-blur-sm">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Stethoscope className="w-16 h-16" />
                 </div>
                 
                 <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-violet-500/20">
                      {doc.full_name[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-white group-hover:text-violet-400 transition-colors line-clamp-1">Dr. {doc.full_name}</h3>
                      <div className="flex items-center gap-2 text-violet-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                         <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                         Verified Specialist
                      </div>
                    </div>
                 </div>

                 <div className="space-y-4 mb-10 flex-1">
                    <div className="flex items-start gap-3">
                       <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                          <Star className="w-4 h-4 text-amber-500" />
                       </div>
                       <div>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">Experience</p>
                          <p className="text-sm text-gray-300 font-medium">{doc.experience_years}+ Years of Practice</p>
                       </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                       <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20">
                          <MapPin className="w-4 h-4 text-violet-500" />
                       </div>
                       <div>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">Top Clinic</p>
                          <p className="text-sm text-gray-300 font-medium line-clamp-2">
                             {doc.chambers?.length > 0 ? doc.chambers[0].shop.shop_name : 'Available at multiple clinics'}
                          </p>
                       </div>
                    </div>
                 </div>

                 <Link href={`/doctor/${doc.id}`} className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-black py-4.5 rounded-2xl transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-3 active:scale-95">
                    <Calendar className="w-5 h-5" /> Book Online Appointment
                 </Link>
                 
                 <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Fees from ₹{doc.chambers?.[0]?.consultation_fee || '499'}</span>
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Instant Booking</span>
                 </div>
              </div>
            ))}
          </div>
        )}

        {/* SEO Keywords Tags */}
        <div className="mt-20 py-12 border-t border-white/5">
           <h4 className="text-xs font-black text-gray-600 uppercase tracking-[0.3em] mb-8 text-center sm:text-left">Popular {spec} Search Terms</h4>
           <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
              {[`Top ${spec} in India`, `${spec} appointment online`, `Verified ${spec} profile`, `Best clinic for ${spec}`, `Female ${spec} near me`].map(tag => (
                <div key={tag} className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:border-violet-500/30 hover:text-violet-400 transition-all cursor-default">
                  {tag}
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
