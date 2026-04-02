'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, MapPin, Navigation, Activity, Stethoscope, Store, Users,
  CheckCircle, ArrowRight, Calendar, FileText, ChevronRight, X, Menu,
  Shield, Zap, Receipt, Package, BarChart3, Pill, IndianRupee,
  BadgeCheck, Clock, Building2, TrendingUp, ClipboardList,
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const SPECIALIZATIONS = ['General Physician', 'Cardiologist', 'Dermatologist', 'Pediatrician', 'Orthopedic', 'ENT'];

interface DoctorShop { id: string; shop_name: string; address_line: string; city: string; pin_code: string; }
interface DoctorChamber { id: string; distance_km?: number; shop: DoctorShop; }
interface Doctor { id: string; full_name: string; specialization?: string; qualifications: string[]; experience_years?: number; consultation_fee?: number; chambers: DoctorChamber[]; }
interface Shop { id: string; shop_name: string; address_line: string; city: string; pin_code: string; contact_phone: string; latitude: number; longitude: number; distance_km?: number; }

export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [searching, setSearching] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasSearchedShops, setHasSearchedShops] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const locate = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      // Check if served over HTTPS - Geolocation requires secure context
      if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        setLocStatus('denied');
        reject(new Error('Geolocation requires HTTPS (Secure Connection)'));
        return;
      }

      if (!navigator.geolocation) {
        setLocStatus('denied');
        reject(new Error('Geolocation not supported'));
        return;
      }
      setLocStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const fresh = { lat: p.coords.latitude, lng: p.coords.longitude };
          setCoords(fresh);
          setLocStatus('ok');
          resolve(fresh);
        },
        (err) => {
          setLocStatus('denied');
          reject(err);
        },
        // Increased timeout to 15s for desktop stability
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }, []);

  const [seoCities, setSeoCities] = useState<{ shop_cities: string[]; doctor_cities: string[] }>({
    shop_cities: ['Mumbai', 'Delhi', 'Bangalore', 'Kolkata', 'Chennai', 'Hyderabad'],
    doctor_cities: ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Lucknow', 'Patna']
  });

  const loadSeoMeta = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/public/seo-metadata`);
      if (res.data.success) setSeoCities(res.data.data);
    } catch (err) { console.error('Meta load failed', err); }
  }, []);

  useEffect(() => { loadSeoMeta(); }, [loadSeoMeta]);

  const runSearch = async (overrideQuery?: string) => {
    const q = overrideQuery ?? query;
    setSearching(true); setSearchErr(''); setHasSearched(true); setHasSearchedShops(false);
    try {
      const params: Record<string, string | number> = {};
      if (q.trim()) params.q = q.trim();

      if (coords) {
        params.lat = coords.lat;
        params.lng = coords.lng;
      }

      const res = await axios.get(`${API_URL}/doctors/search`, { params });
      setDoctors(res.data.data ?? []);
    } catch {
      setSearchErr('Unable to fetch results. Please try again.'); setDoctors([]);
    } finally { setSearching(false); }
  };

  const runShopSearch = async () => {
    setSearching(true); setSearchErr(''); setHasSearched(false); setHasSearchedShops(true);
    try {
      let currentCoords = coords;

      // Geolocation Attempt
      if (!currentCoords) {
        try {
          currentCoords = await locate();
        } catch (err) {
          // 💡 FALLBACK: If GPS fails on desktop, try area search by text query (e.g. "Pandua")
          if (query.trim()) {
            const res = await axios.get(`${API_URL}/shops/search`, { params: { q: query.trim() } });
            setShops(res.data.data ?? []);
            setSearching(false);
            return;
          }
          
          setSearchErr('Location blocked. Please allow location access or type your City/Area in the search bar.');
          setSearching(false);
          return;
        }
      }

      const params: Record<string, string | number> = { 
        lat: currentCoords.lat, 
        lng: currentCoords.lng,
        radius: 10 
      };

      const res = await axios.get(`${API_URL}/shops/nearby`, { params });
      setShops(res.data.data ?? []);
    } catch {
      setSearchErr('Unable to fetch pharmacies. Please try again.'); setShops([]);
    } finally { setSearching(false); }
  };

  const pickSpec = (s: string) => {
    setQuery(s);
    runSearch(s);
    document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Add city discovery to footer
  const cityLinks = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left mb-16 pt-16 border-t border-white/[0.04]">
      <div>
        <h4 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-6">Local Pharmacy in Cities</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
           {seoCities.shop_cities.slice(0, 12).map(c => (
             <Link key={c} href={`/pharmacy/city/${c.toLowerCase()}`} className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">
               Pharmacy in {c}
             </Link>
           ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-6">Popular Doctors in Cities</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
           {seoCities.doctor_cities.slice(0, 12).map(c => (
             <Link key={c} href={`/doctor/city/${c.toLowerCase()}`} className="text-xs text-gray-500 hover:text-violet-400 transition-colors">
               Doctors in {c}
             </Link>
           ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090f] text-white font-sans">

      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50 h-16 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">RxDesk</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            {[
              ['Pharmacy Billing', '#pharmacy-billing'],
              ['Appointments', '#appointments'],
              ['Features', '#features'],
              ['How it Works', '#how-it-works'],
            ].map(([label, href]) => (
              <button key={label} onClick={() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">{label}</button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors font-medium">Login</button>
            <Link href="/login?register=1" className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
              <Store className="w-4 h-4" /> Register Shop
            </Link>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-violet-500/20">Get Started Free</button>
          </div>

          <button className="md:hidden p-2 text-gray-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.05] bg-[#09090f] px-4 py-4 space-y-1">
            <button onClick={() => { document.querySelector('#pharmacy-billing')?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); }} className="flex w-full text-left text-sm text-gray-400 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/[0.04]">Pharmacy Billing</button>
            <button onClick={() => { document.querySelector('#appointments')?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); }} className="flex w-full text-left text-sm text-gray-400 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/[0.04]">Appointments</button>
            <button onClick={() => { document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); }} className="flex w-full text-left text-sm text-gray-400 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/[0.04]">Features</button>
            <button onClick={() => { document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); }} className="flex w-full text-left text-sm text-gray-400 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/[0.04]">How it Works</button>
            <button onClick={() => { setShowModal(true); setMobileOpen(false); }} className="flex w-full text-left text-sm font-semibold text-violet-400 py-2.5 px-3 rounded-lg hover:bg-violet-500/10">Login / Register</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute top-16 left-1/4 w-[650px] h-[450px] bg-violet-600/25 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-32 right-1/4 w-[450px] h-[350px] bg-fuchsia-600/20 rounded-full blur-[110px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 rounded-full px-4 py-1.5 text-xs text-emerald-300 mb-6 font-semibold shadow-lg shadow-emerald-500/10">
            <Zap className="w-3 h-3 text-yellow-400" /> India&apos;s All-in-One Healthcare Management Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.1] mb-5">
            Smart Pharmacy Billing
            <br />
            <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              + Doctor Appointments
            </span>
            <br />
            <span className="text-gray-300 font-bold text-3xl sm:text-4xl lg:text-[2.6rem]">in One Platform</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-400 mb-5 max-w-2xl mx-auto leading-relaxed">
            Streamline your pharmacy with <strong className="text-white font-semibold">GST-compliant billing</strong>, live inventory, HSN-coded invoices, and integrated doctor appointment scheduling â€” built for Indian pharmacies and clinics.
          </p>

          {/* Trust / compliance badges */}
          <div className="flex flex-wrap justify-center gap-2.5 mb-10">
            {[
              { Icon: BadgeCheck, label: 'GST Compliant', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/35' },
              { Icon: IndianRupee, label: 'HSN Coded Invoices', color: 'text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/35' },
              { Icon: Pill, label: 'Medicine Database', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/35' },
              { Icon: Shield, label: 'Secure & Encrypted', color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/35' },
              { Icon: Clock, label: 'Real-time Sync', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/35' },
            ].map(({ Icon, label, color, bg, border }) => (
              <span key={label} className={`inline-flex items-center gap-1.5 text-xs font-semibold ${color} ${bg} border ${border} rounded-full px-3 py-1.5`}>
                <Icon className="w-3 h-3" /> {label}
              </span>
            ))}
          </div>

          {/* Search bar */}
          <div id="search-bar" className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-2 max-w-2xl mx-auto shadow-2xl mb-5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 h-12">
                <Search className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                  type="text" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  placeholder="Search doctor, specialization…"
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-600"
                />
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runSearch()}
                    disabled={searching}
                    className="px-5 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 shadow shadow-violet-500/20"
                  >
                    {searching && hasSearched ? 'Searching…' : 'Find Doctors'}
                  </button>
                  <button
                    onClick={() => runShopSearch()}
                    disabled={searching}
                    className="px-5 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 shadow shadow-emerald-500/20 flex items-center gap-2"
                  >
                    {searching && hasSearchedShops ? 'Finding…' : <><Store className="w-4 h-4" /> Near Pharmacy</>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Specialization chips */}
          <div className="flex flex-wrap justify-center gap-2">
            {SPECIALIZATIONS.map((s, i) => {
              const colors = [
                'hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/30',
                'hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/30',
                'hover:text-pink-300 hover:bg-pink-500/10 hover:border-pink-500/30',
                'hover:text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/30',
                'hover:text-orange-300 hover:bg-orange-500/10 hover:border-orange-500/30',
                'hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30',
              ];
              return (
                <button key={s} onClick={() => pickSpec(s)} className={`px-3 py-1.5 text-xs text-gray-500 bg-white/[0.03] border border-white/[0.06] rounded-full transition-all ${colors[i % colors.length]}`}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* SEARCH RESULTS */}
      {hasSearchedShops && (
        <section id="results-section" className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-400" /> Nearby Pharmacies
              </h2>
              <p className="text-xs text-gray-500">
                {searching ? 'Finding…' : `${shops.length} pharmacy found within 10km`}
              </p>
            </div>

            {searchErr && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-4">{searchErr}</div>
            )}

            {!searching && !searchErr && shops.length === 0 && (
              <div className="text-center py-16 text-gray-600">
                <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500">No pharmacies found nearby</p>
                <p className="text-sm mt-1">Try moving to a different location or check permissions</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-5">
              {shops.map((shop) => (
                <div key={shop.id} className="group relative bg-[#13131e]/50 border border-white/[0.08] rounded-3xl p-6 hover:border-emerald-500/40 hover:bg-[#1a1a27] transition-all hover:-translate-y-1 shadow-xl">
                  <Link href={`/pharmacy/${shop.id}`} className="absolute inset-0 z-0" />
                  <div className="relative z-10 flex items-start gap-5">
                    <div className="w-14 h-14 shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 transition-all">
                      <Store className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{shop.shop_name}</h3>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-1">{shop.address_line}, {shop.city}</p>
                      
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                         <Link href={`/pharmacy/${shop.id}`} className="flex-1 text-center bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 text-emerald-400 text-xs font-bold py-2.5 rounded-xl transition-all">
                           View Doctors & Slots
                         </Link>
                         <a href={`tel:${shop.contact_phone}`} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                           <Activity className="w-4 h-4 text-gray-400" />
                         </a>
                         <a 
                           href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                         >
                           <Navigation className="w-4 h-4 text-gray-400" />
                         </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
                    <Link href={`/doctor/${doc.id}`} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-xl text-xs font-semibold transition-colors shadow shadow-violet-500/20">
                      View Profile & Timings <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ECOSYSTEM BENTO GRID */}
      <section id="features" className="py-24 px-4 bg-gradient-to-b from-[#09090f] via-[#0b0b14] to-[#09090f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 tracking-tight">
              One ecosystem. <span className="bg-gradient-to-r from-emerald-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">Complete control.</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-base">
              Connecting rural healthcare with urban technology. A seamless bridge between patients, chambers, and pharmacies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            
            {/* LARGE BENTO: PHARMACY BILLING */}
            <div className="md:col-span-4 bg-[#11111d]/60 border border-white/[0.08] rounded-[2.5rem] p-8 hover:border-emerald-500/30 transition-all group overflow-hidden relative shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full group-hover:bg-emerald-500/10 transition-colors" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Smart Pharmacy Billing</h3>
                </div>
                <p className="text-gray-400 text-sm max-w-md mb-8 leading-relaxed">
                  The fastest GST billing engine in India. Scan medicines, manage HSN codes, and generate professional tax invoices in under 10 seconds.
                </p>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl">
                      <div className="text-emerald-400 font-bold text-lg mb-1">99%</div>
                      <div className="text-gray-500 text-[10px] uppercase font-black">GST Accuracy</div>
                   </div>
                   <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl">
                      <div className="text-violet-400 font-bold text-lg mb-1">Live</div>
                      <div className="text-gray-500 text-[10px] uppercase font-black">Inventory Sync</div>
                   </div>
                </div>
              </div>
            </div>

            {/* SMALL BENTO: PATIENT SEARCH */}
            <div className="md:col-span-2 bg-[#11111d]/60 border border-white/[0.08] rounded-[2.5rem] p-8 hover:border-blue-500/30 transition-all group relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[70px] rounded-full" />
               <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6">
                 <MapPin className="w-5 h-5 text-blue-400" />
               </div>
               <h3 className="text-xl font-bold text-white mb-3">Discovery</h3>
               <p className="text-gray-500 text-xs leading-relaxed mb-6">
                 Patients can find your shop and your associated doctors from anywhere in India.
               </p>
               <div className="flex flex-col gap-2">
                  <div className="h-1 bg-blue-500/20 rounded-full overflow-hidden">
                     <div className="w-[85%] h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  </div>
                  <div className="text-[10px] text-gray-600 font-bold">LOCAL SEO OPTIMIZED</div>
               </div>
            </div>

            {/* MEDIUM BENTO: DOCTOR DASHBOARD */}
            <div className="md:col-span-3 bg-[#11111d]/60 border border-white/[0.08] rounded-[2.5rem] p-8 hover:border-violet-500/30 transition-all group relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 left-0 w-48 h-48 bg-violet-500/5 blur-[70px] rounded-full" />
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-violet-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Cloud Appointments</h3>
               </div>
               <p className="text-gray-400 text-sm leading-relaxed mb-6">
                 Manage multiple chambers, live queues, and patient history from a single mobile-friendly dashboard.
               </p>
               <div className="bg-violet-500/5 border border-violet-500/10 p-3 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-violet-400" />
                  <span className="text-xs text-gray-400">Digital Prescription Support</span>
               </div>
            </div>

            {/* MEDIUM BENTO: REPORTS & GST */}
            <div className="md:col-span-3 bg-[#11111d]/60 border border-white/[0.08] rounded-[2.5rem] p-8 hover:border-amber-500/30 transition-all group relative overflow-hidden shadow-2xl border-b-2 border-b-amber-500/10">
               <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-[70px] rounded-full" />
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">GST & Accounting</h3>
               </div>
               <p className="text-gray-400 text-sm leading-relaxed mb-6">
                 Automatic GSTR reports (GSTR-1, 3B) and full shop accounting. No manual calculator needed.
               </p>
               <div className="flex gap-1.5 items-center">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-8 flex-1 bg-white/[0.02] border border-white/[0.05] rounded-md relative flex items-end"><div className="w-full bg-amber-500/20" style={{height: `${i*15}%`}} /></div>)}
               </div>
            </div>

          </div>

          <div className="mt-16 text-center">
            <button onClick={() => document.querySelector('#appointments')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-bold transition-all group">
               <span>Need more than just billing?</span>
               <span className="text-violet-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                 See Appointment Features <ArrowRight className="w-4 h-4" />
               </span>
            </button>
          </div>
        </div>
      </section>

      {/* SMART APPOINTMENTS SHOWCASE */}
      <section id="appointments" className="py-24 px-4 bg-gradient-to-b from-[#09090f] to-[#0d0d16]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
             
             {/* CONTENT */}
             <div>
                <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 text-xs text-violet-400 mb-6 font-medium uppercase tracking-widest">
                  Queue Management
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                  Manage Chambers with <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Zero Conflict.</span>
                </h2>
                <p className="text-gray-500 text-base lg:text-lg mb-8 leading-relaxed">
                  Eliminate long waiting times and phone call hassles. Our intelligent booking system handles everything from slot allocation to WhatsApp reminders.
                </p>

                <div className="space-y-4">
                   {[
                     { title: 'Live Queue Status', desc: 'Patients can check their token number live from their phones.', icon: Clock },
                     { title: 'Automated Reminders', desc: 'Send bulk WhatsApp alerts for schedule changes or delays.', icon: CheckCircle },
                     { title: 'Payment Integration', desc: 'Collect consultation fees digitally before the visit.', icon: IndianRupee },
                   ].map((f, i) => (
                     <div key={i} className="flex items-start gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.04] transition-colors">
                        <f.icon className="w-5 h-5 text-violet-400 mt-1 shrink-0" />
                        <div>
                           <h4 className="font-bold text-white text-sm">{f.title}</h4>
                           <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>

             {/* INTERACTIVE MOCKUP */}
             <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-br from-violet-600/20 to-transparent blur-2xl opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative bg-[#11111d] border border-white/[0.1] rounded-[2rem] p-8 shadow-2xl">
                   <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.05]">
                      <div>
                         <h4 className="font-bold text-white text-lg">Dr. Amit Sharma</h4>
                         <p className="text-xs text-gray-500">General Physician Â· Apollo Clinic</p>
                      </div>
                      <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-md uppercase">LIVE NOW</div>
                   </div>

                   <div className="flex items-center justify-between mb-6">
                      <span className="text-sm font-bold text-gray-400">Select Time Slot</span>
                      <span className="text-[10px] text-gray-600 uppercase font-bold">MON, 01 APR</span>
                   </div>

                   <div className="grid grid-cols-3 gap-3 mb-8">
                      {['10:00', '10:15', '10:30', '10:45', '11:00', '11:15'].map((time, i) => (
                        <div key={time} className={`p-3 rounded-xl border text-center transition-all ${
                          i === 2 ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20' 
                          : i === 0 ? 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-white/[0.03] border-white/[0.1] text-gray-400 hover:border-violet-500/50'
                        }`}>
                           <div className="text-xs font-bold">{time}</div>
                           <div className="text-[8px] mt-0.5 uppercase opacity-60">
                             {i === 2 ? 'Selected' : i === 0 ? 'Booked' : 'Available'}
                           </div>
                        </div>
                      ))}
                   </div>

                   <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-2xl">
                      <div className="flex items-center justify-between mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                         <span>Live Queue Status</span>
                         <span className="text-violet-400">Token #14 / 25</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="w-[60%] h-full bg-violet-500" />
                      </div>
                   </div>
                </div>
             </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-4 bg-[#09090f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-gray-400 mb-4 font-medium uppercase tracking-widest">
              Journey
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">Simple. Professional. <span className="text-emerald-400">Effective.</span></h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 relative">
            {/* Center divider for desktop */}
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />

            {/* FOR PHARMACIES */}
            <div className="space-y-12">
               <div className="flex items-center gap-3 mb-8">
                  <Store className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-bold uppercase tracking-wider text-emerald-400/80">For Pharmacies</h3>
               </div>

               {[
                 { title: 'Register Shop', desc: 'Enter your shop details and drug license to get verified in minutes.', icon: Building2 },
                 { title: 'Setup Chambers', desc: 'Add doctors, set their weekly sitting timings to attract more patients.', icon: Stethoscope },
                 { title: 'Scale Digitally', desc: 'Generate GST invoices and manage inventory with high-speed tools.', icon: TrendingUp },
               ].map((step, i) => (
                 <div key={i} className="flex gap-6 group">
                    <div className="flex flex-col items-center">
                       <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-xl font-black text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:bg-emerald-500/20 transition-all">
                          {i + 1}
                       </div>
                       {i < 2 && <div className="w-0.5 h-full bg-gradient-to-b from-emerald-500/20 to-transparent my-2" />}
                    </div>
                    <div className="pt-2">
                       <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                       <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                 </div>
               ))}
            </div>

            {/* FOR PATIENTS */}
            <div className="space-y-12">
               <div className="flex items-center gap-3 mb-8">
                  <Users className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-bold uppercase tracking-wider text-blue-400/80">For Patients</h3>
               </div>

               {[
                 { title: 'Smart Search', desc: 'Use GPS to find verified medical shops and specialists near you.', icon: Search },
                 { title: 'Verify Timings', desc: 'Check live doctor schedules, consultation fees, and shop status.', icon: Clock },
                 { title: 'Direct Visit', desc: 'Contact the pharmacy or book an appointment for a direct consultation.', icon: MapPin },
               ].map((step, i) => (
                 <div key={i} className="flex gap-6 group">
                    <div className="flex flex-col items-center">
                       <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-xl font-black text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:bg-blue-500/20 transition-all">
                          {i + 1}
                       </div>
                       {i < 2 && <div className="w-0.5 h-full bg-gradient-to-b from-blue-500/20 to-transparent my-2" />}
                    </div>
                    <div className="pt-2">
                       <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                       <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>

          <div className="mt-20 text-center">
            <Link href="/login?register=1" className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-2xl text-sm font-bold transition-all group">
               <span className="text-emerald-400">Join the RxDesk Network Today</span>
               <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
      <footer className="py-12 px-4 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-3">
             <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
               <Activity className="w-4 h-4 text-white" />
             </div>
             <span className="font-bold text-lg">RxDesk</span>
          </Link>
          <p className="text-sm text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">India&apos;s integrated pharmacy billing and doctor appointment platform. Built for Indian healthcare.</p>
          {cityLinks}
          <p className="text-xs text-gray-700">Â© 2026 RxDesk India. All rights reserved.</p>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#111120] border border-white/[0.08] rounded-3xl p-7 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold">Choose Your Role</h2>
              </div>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-4">
               {[
                 { label: 'Patient', login: '/patient/login', register: '/patient/login?register=1', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                 { label: 'Doctor', login: '/doctor/login', register: '/doctor/login?register=1', icon: Stethoscope, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                 { label: 'Medical Shop', login: '/login', register: '/login?register=1', icon: Store, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
               ].map((role) => (
                 <div key={role.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 transition-all">
                   <div className="flex items-center gap-4 mb-4">
                     <div className={`w-10 h-10 ${role.bg} rounded-xl flex items-center justify-center`}><role.icon className={`w-5 h-5 ${role.color}`} /></div>
                     <span className="font-bold text-gray-200">{role.label}</span>
                   </div>
                   <div className="grid grid-cols-2 gap-3 text-xs font-bold text-center">
                     <Link href={role.login} onClick={() => setShowModal(false)} className="py-2.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.1] rounded-xl transition-all">
                       Login
                     </Link>
                     <Link href={role.register} onClick={() => setShowModal(false)} className={`py-2.5 ${role.bg} ${role.color} border border-transparent rounded-xl transition-all hover:brightness-125`}>
                       Register
                     </Link>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
