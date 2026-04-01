import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function getDoctor(id: string) {
  const res = await fetch(`https://backend.rxdesk.in/api/v1/doctors/${id}`, {
    next: { revalidate: 3600 },
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
  const doctor = await getDoctor(params.id);
  if (!doctor) return { title: 'Doctor Not Found - RxDesk' };

  const name = doctor.full_name;
  const spec = doctor.specialization || 'Healthcare Expert';
  const description = `Consult with Dr. ${name}, a highly qualified ${spec} with ${doctor.experience_years || 5}+ years of experience. Find chamber timings and book online appointments via RxDesk.`;

  return {
    title: `Best ${spec} Dr. ${name} - Book Appointment Online | RxDesk`,
    description,
    keywords: [
      `Dr. ${name}`,
      `${spec} doctor near me`,
      `best doctor in India`,
      `book doctor appointment online`,
      `specialist in ${spec}`,
    ],
    openGraph: {
      type: 'profile',
      title: `Dr. ${name} (${spec}) - Book Appointment Now`,
      description,
      url: `https://rxdesk.in/doctor/${params.id}`,
    },
  };
}

export default async function DoctorProfilePage({ params }: Props) {
  const doctor = await getDoctor(params.id);
  if (!doctor) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    'name': `Dr. ${doctor.full_name}`,
    'medicalSpecialty': doctor.specialization,
    'description': doctor.about || `Consult with Dr. ${doctor.full_name}, a specialized ${doctor.specialization}.`,
    'address': doctor.chambers && doctor.chambers.length > 0 ? {
      '@type': 'PostalAddress',
      'streetAddress': doctor.chambers[0].shop.address_line,
      'addressLocality': doctor.chambers[0].shop.city,
      'addressRegion': doctor.chambers[0].shop.state,
      'postalCode': doctor.chambers[0].shop.pin_code,
      'addressCountry': 'IN',
    } : undefined,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Navigation Header */}
      <nav className="bg-[#09090f] px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg text-white">
        <div className="flex items-center">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            RxDesk
            </Link>
            <span className="mx-3 text-white/20">/</span>
            <Link href="/" className="text-white/60 font-medium hover:text-white transition-colors">Find Doctors</Link>
            <span className="mx-3 text-white/20">/</span>
            <span className="text-white/40 font-medium truncate italic text-sm">Dr. {doctor.full_name}</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="w-32 h-32 rounded-3xl bg-violet-600 flex items-center justify-center text-white text-4xl font-extrabold shadow-xl shadow-violet-200 shrink-0 uppercase">
                  {doctor.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
               </div>
               <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
                     <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border border-violet-200">Verified Expert</span>
                     <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-200">{doctor.experience_years || 5}+ Years Exp.</span>
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 mb-2">Dr. {doctor.full_name}</h1>
                  <p className="text-xl font-bold text-violet-600 mb-4">{doctor.specialization}</p>
                  <p className="text-slate-500 font-medium leading-relaxed italic">{doctor.qualifications?.join(', ') || 'Medical Professional'}</p>
               </div>
            </div>

            {/* Chamber List Section */}
            <div>
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                     <span className="w-2.5 h-8 bg-emerald-500 rounded-full"></span>
                     Where to Consult?
                  </h2>
               </div>

               {doctor.chambers && doctor.chambers.length > 0 ? (
                  <div className="space-y-4">
                     {doctor.chambers.map((chamber: any) => (
                        <div key={chamber.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-emerald-200 transition-all group flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                           <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shrink-0">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                              </div>
                              <div>
                                 <h3 className="text-lg font-black text-slate-800">{chamber.shop.shop_name}</h3>
                                 <p className="text-sm font-medium text-slate-500 mb-2">{chamber.shop.address_line}, {chamber.shop.city}</p>
                                 <div className="flex flex-wrap gap-2">
                                    <span className="bg-slate-50 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-100">Consultation: ₹{doctor.consultation_fee || 499}</span>
                                 </div>
                              </div>
                           </div>
                           <div className="w-full md:w-auto">
                              <Link href="/patient/login" className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-sm hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-100">
                                 Book This Slot
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                              </Link>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center">
                     <p className="text-slate-400 font-bold text-lg italic">Dr. {doctor.full_name} is currently setting up updated chamber locations.</p>
                  </div>
               )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
             <div className="sticky top-24 space-y-8">
                
                {/* CTA Card */}
                <div className="bg-[#09090f] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
                   <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-violet-600/30 blur-3xl pointer-events-none"></div>
                   <div className="relative">
                      <div className="flex items-center gap-3 mb-6">
                         <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-violet-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                         </div>
                         <h4 className="font-black text-xs uppercase tracking-[0.2em] text-white/50">Smart Assistant</h4>
                      </div>
                      <p className="text-2xl font-black mb-8 leading-tight italic">Need immediate medical advice or an appointment?</p>
                      <Link href="/patient/login" className="w-full bg-white text-[#09090f] py-5 px-6 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-violet-100 transition-colors shadow-2xl shadow-white/5">
                         Register To Book
                      </Link>
                   </div>
                </div>

                {/* Share */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center">
                   <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2 italic">Save This Profile</h4>
                   <p className="text-xs text-slate-400 font-medium mb-6 italic">Access Dr. {doctor.full_name}&apos;s availability instantly.</p>
                   <div className="flex gap-4">
                      <button className="flex-1 p-3 bg-slate-50 text-slate-700 font-black text-[10px] rounded-2xl uppercase hover:bg-slate-100 cursor-copy">Copy Link</button>
                      <button className="flex-1 p-3 bg-emerald-50 text-emerald-700 font-black text-[10px] rounded-2xl uppercase hover:bg-emerald-100">WhatsApp</button>
                   </div>
                </div>

                <div className="text-center italic opacity-30 px-6">
                   <p className="text-[10px] font-black text-slate-500 leading-relaxed uppercase tracking-[0.3em]">RxDesk India Digital Transformation</p>
                </div>
             </div>
          </div>

        </div>
      </main>

      <footer className="mt-20 py-16 bg-white border-t border-slate-100 text-center">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] italic">RxDesk Digital Healthcare India</p>
      </footer>
    </div>
  );
}
