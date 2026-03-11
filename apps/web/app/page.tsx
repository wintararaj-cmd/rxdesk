'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, MapPin, Navigation, Activity, Stethoscope, Store, Users,
  CheckCircle, ArrowRight, Calendar, FileText, ChevronRight, X, Menu,
  Shield, Zap,
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const SPECIALIZATIONS = ['General Physician', 'Cardiologist', 'Dermatologist', 'Pediatrician', 'Orthopedic', 'ENT'];

interface DoctorShop { id: string; shop_name: string; address_line: string; city: string; pin_code: string; }
interface DoctorChamber { id: string; distance_km?: number; shop: DoctorShop; }
interface Doctor { id: string; full_name: string; specialization?: string; qualifications: string[]; experience_years?: number; consultation_fee?: number; chambers: DoctorChamber[]; }

export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [searching, setSearching] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setLocStatus('denied'); return; }
    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocStatus('ok'); },
      () => setLocStatus('denied'),
    );
  }, []);

  const runSearch = async (overrideQuery?: string) => {
    const q = overrideQuery ?? query;
    setSearching(true); setSearchErr(''); setHasSearched(true);
    try {
      const params: Record<string, string | number> = {};
      if (q.trim()) params.q = q.trim();
      if (coords) { params.lat = coords.lat; params.lng = coords.lng; }
      const res = await axios.get(`${API_URL}/doctors/search`, { params });
      setDoctors(res.data.data ?? []);
    } catch {
      setSearchErr('Unable to fetch results. Please try again.'); setDoctors([]);
    } finally { setSearching(false); }
  };

  const pickSpec = (s: string) => {
    setQuery(s);
    runSearch(s);
    document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#09090f] text-white">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 h-16 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">RxDesk</span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm text-gray-400">
            {[['Features', '#features'], ['How it Works', '#how-it-works'], ['Find Doctors', '#search-bar']].map(([label, href]) => (
              <button key={label} onClick={() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">{label}</button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-xl">Login</button>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 rounded-xl font-semibold transition-colors shadow shadow-violet-500/20">Get Started</button>
          </div>

          <button className="md:hidden p-2 text-gray-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.05] bg-[#09090f] px-4 py-4 space-y-1">
            <button onClick={() => { document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); }} className="flex w-full text-left text-sm text-gray-400 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/[0.04]">Features</button>
            <button onClick={() => { document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); }} className="flex w-full text-left text-sm text-gray-400 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/[0.04]">How it Works</button>
            <button onClick={() => { setShowModal(true); setMobileOpen(false); }} className="flex w-full text-left text-sm font-semibold text-violet-400 py-2.5 px-3 rounded-lg hover:bg-violet-500/10">Login / Register</button>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 px-4 overflow-hidden">
        <div className="absolute top-24 left-1/3 w-[480px] h-[480px] bg-violet-700/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-700/6 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 mb-8 font-medium">
            <Zap className="w-3 h-3" /> India&apos;s Digital Healthcare Platform — RxDesk
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-extrabold tracking-tight leading-[1.1] mb-5">
            Find the Right Doctor,
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              Near You
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Connect with verified doctors, book appointments instantly, and get digital prescriptions — serving patients, doctors, and medical shops across India.
          </p>

          {/* Search bar */}
          <div id="search-bar" className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-2 max-w-2xl mx-auto shadow-2xl mb-5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 h-12">
                <Search className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                  type="text" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  placeholder="Doctor name or specialization…"
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-600"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { if (locStatus !== 'ok') locate(); }}
                  title="Use my location"
                  className={`flex items-center gap-2 px-4 h-12 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    locStatus === 'ok' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : locStatus === 'loading' ? 'bg-white/[0.04] text-gray-500 cursor-not-allowed'
                    : 'bg-white/[0.04] text-gray-400 hover:text-white border border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span className="hidden sm:inline">{locStatus === 'ok' ? 'Located' : locStatus === 'loading' ? '…' : 'Near Me'}</span>
                </button>
                <button
                  onClick={() => runSearch()}
                  disabled={searching}
                  className="px-6 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 shadow shadow-violet-500/20"
                >
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick specialization chips */}
          <div className="flex flex-wrap justify-center gap-2">
            {SPECIALIZATIONS.map((s) => (
              <button key={s} onClick={() => pickSpec(s)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-200 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.14] rounded-full transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEARCH RESULTS ──────────────────────────────────────────── */}
      {hasSearched && (
        <section id="results-section" className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-gray-500 mb-5">
              {searching ? 'Searching…' : `${doctors.length} doctor${doctors.length !== 1 ? 's' : ''} found${coords ? ' · sorted by distance' : ''}`}
            </p>

            {searchErr && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-4">{searchErr}</div>
            )}

            {!searching && !searchErr && doctors.length === 0 && (
              <div className="text-center py-16 text-gray-600">
                <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500">No doctors found</p>
                <p className="text-sm mt-1">Try a different keyword or remove filters</p>
              </div>
            )}

            <div className="space-y-4">
              {doctors.map((doc) => (
                <div key={doc.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:border-violet-500/25 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/25 rounded-xl flex items-center justify-center">
                      <span className="text-violet-300 font-bold text-xs">
                        {doc.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-0.5">
                        <h3 className="font-semibold text-white">Dr. {doc.full_name}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                          {doc.experience_years ? <span>{doc.experience_years}+ yrs</span> : null}
                          {doc.consultation_fee ? <span className="text-emerald-400 font-medium">₹{doc.consultation_fee}</span> : null}
                        </div>
                      </div>
                      {doc.specialization && <p className="text-violet-400 text-sm mb-1">{doc.specialization}</p>}
                      {doc.qualifications?.length > 0 && <p className="text-xs text-gray-600 mb-3">{doc.qualifications.join(', ')}</p>}

                      {doc.chambers?.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {doc.chambers.map((ch) => (
                            <div key={ch.id} className="flex items-start gap-2 text-xs">
                              <MapPin className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
                              <span className="text-gray-400 font-medium">{ch.shop.shop_name}</span>
                              <span className="text-gray-600">·</span>
                              <span className="text-gray-600">{ch.shop.address_line}, {ch.shop.city} {ch.shop.pin_code}</span>
                              {ch.distance_km !== undefined && (
                                <span className="text-emerald-400 font-semibold ml-1 shrink-0">
                                  {ch.distance_km < 1 ? `${Math.round(ch.distance_km * 1000)} m` : `${ch.distance_km.toFixed(1)} km`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end mt-3 pt-3 border-t border-white/[0.05]">
                    <Link href="/patient/login" className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-xl text-xs font-semibold transition-colors shadow shadow-violet-500/20">
                      Book Appointment <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">One Platform, Three Portals</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-sm sm:text-base">Whether you&apos;re a patient, doctor, or clinic — RxDesk has a dedicated portal built for your workflow.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Patient */}
            <div className="bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/30 rounded-2xl p-6 transition-all hover:bg-blue-500/[0.03]">
              <div className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-5">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-base mb-3">For Patients</h3>
              <ul className="space-y-2 mb-6">
                {['Search nearby verified doctors', 'Book appointments online', 'View digital prescriptions', 'Track appointment history', 'Get SMS reminders'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/patient/login" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Register as Patient <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Doctor */}
            <div className="bg-white/[0.03] border border-white/[0.07] hover:border-violet-500/30 rounded-2xl p-6 transition-all hover:bg-violet-500/[0.03]">
              <div className="w-11 h-11 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center mb-5">
                <Stethoscope className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="font-semibold text-base mb-3">For Doctors</h3>
              <ul className="space-y-2 mb-6">
                {['Manage clinic schedule & chambers', 'View all appointments in one place', 'Create digital prescriptions', 'Track patient history', 'Get verified & boost visibility'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/doctor/login" className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors">
                Register as Doctor <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Shop */}
            <div className="bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/30 rounded-2xl p-6 transition-all hover:bg-emerald-500/[0.03]">
              <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-5">
                <Store className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-base mb-3">For Medical Shops &amp; Clinics</h3>
              <ul className="space-y-2 mb-6">
                {['Host doctor chambers in your clinic', 'Manage appointment bookings', 'Medicine billing &amp; invoicing', 'Inventory management', 'GST accounting &amp; reports'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> <span dangerouslySetInnerHTML={{ __html: f }} />
                  </li>
                ))}
              </ul>
              <Link href="/login?register=1" className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Register your Shop <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-4 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">How It Works</h2>
            <p className="text-gray-500 text-sm sm:text-base">Book an appointment in three simple steps</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-10">
            {[
              { n: '01', Icon: Search, title: 'Search a Doctor', desc: 'Find doctors by name, specialization, or location. See their clinics and available time slots near you.' },
              { n: '02', Icon: Calendar, title: 'Book an Appointment', desc: 'Pick a convenient date and time slot. You\'ll receive an SMS confirmation instantly.' },
              { n: '03', Icon: FileText, title: 'Get Your Prescription', desc: 'After your visit get a digital prescription that you can access anytime on the platform.' },
            ].map(({ n, Icon, title, desc }) => (
              <div key={n} className="text-center">
                <div className="relative inline-flex mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/25 rounded-2xl flex items-center justify-center">
                    <Icon className="w-7 h-7 text-violet-400" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-violet-600 rounded-full text-[10px] font-bold flex items-center justify-center">{n}</span>
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────────── */}
      <section className="py-14 px-4 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[['500+', 'Registered Doctors'], ['200+', 'Medical Clinics'], ['10,000+', 'Appointments Booked'], ['15+', 'Cities']].map(([v, l]) => (
            <div key={l}>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{v}</div>
              <div className="text-xs text-gray-500">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-violet-600/8 to-indigo-600/8 border border-violet-500/20 rounded-3xl p-10">
            <Shield className="w-9 h-9 text-violet-400 mx-auto mb-5" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to Get Started?</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">Join thousands of patients, doctors, and clinics already using RxDesk.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/patient/login" className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl text-sm font-semibold transition-all shadow shadow-violet-500/20">Register as Patient</Link>
              <Link href="/doctor/login" className="px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] rounded-xl text-sm font-semibold transition-all">Doctor Login</Link>
              <Link href="/login?register=1" className="px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] rounded-xl text-sm font-semibold transition-all">Shop / Clinic</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="py-10 px-4 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-md flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold">RxDesk</span>
          </Link>
          <p className="text-xs text-gray-600">© 2026 RxDesk. All rights reserved.</p>
          <div className="flex gap-5 text-xs text-gray-600">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Use</Link>
            <Link href="/contact" className="hover:text-gray-400 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>

      {/* ── LOGIN ROLE MODAL ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#111120] border border-white/[0.08] rounded-3xl p-7 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold">Choose Your Role</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select how you want to continue</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <Link href="/patient/login" onClick={() => setShowModal(false)} className="flex items-center gap-3.5 p-3.5 bg-white/[0.03] hover:bg-blue-500/10 border border-white/[0.06] hover:border-blue-500/30 rounded-xl transition-all group">
                <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-blue-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Patient</div>
                  <div className="text-xs text-gray-500">Search doctors &amp; book appointments</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
              </Link>

              <Link href="/doctor/login" onClick={() => setShowModal(false)} className="flex items-center gap-3.5 p-3.5 bg-white/[0.03] hover:bg-violet-500/10 border border-white/[0.06] hover:border-violet-500/30 rounded-xl transition-all group">
                <div className="w-9 h-9 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center shrink-0"><Stethoscope className="w-4 h-4 text-violet-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Doctor</div>
                  <div className="text-xs text-gray-500">Manage chambers &amp; appointments</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors" />
              </Link>

              <Link href="/login" onClick={() => setShowModal(false)} className="flex items-center gap-3.5 p-3.5 bg-white/[0.03] hover:bg-emerald-500/10 border border-white/[0.06] hover:border-emerald-500/30 rounded-xl transition-all group">
                <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shrink-0"><Store className="w-4 h-4 text-emerald-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Medical Shop / Clinic</div>
                  <div className="text-xs text-gray-500">Billing, inventory &amp; chamber management</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
