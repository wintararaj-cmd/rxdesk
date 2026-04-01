'use client';

import { useState, useCallback } from 'react';
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

          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-xl">Login</button>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl font-semibold transition-all shadow shadow-violet-500/20">Get Started Free</button>
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

      {/* PHARMACY BILLING SHOWCASE */}
      <section id="pharmacy-billing" className="py-24 px-4 border-t border-emerald-900/40 bg-gradient-to-b from-emerald-950/25 via-[#09090f] to-[#09090f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 text-xs text-emerald-400 mb-4 font-medium">
              <Receipt className="w-3 h-3" /> Pharmacy Billing Software
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Complete <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Pharmacy Billing</span> Software
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base">
              From medicine sales to GST returns â€” every billing operation your pharmacy needs, fast and accurate.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-7 hover:border-emerald-400/50 transition-all shadow-lg shadow-emerald-900/20">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-5">
                <Receipt className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">GST-Compliant Invoice Generation</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Generate GSTIN-compliant tax invoices for medicine sales with automatic HSN code mapping, CGST/SGST/IGST calculation, and print-ready PDF format.
              </p>
              <ul className="grid sm:grid-cols-2 gap-2.5">
                {[
                  'Auto HSN code mapping',
                  'CGST / SGST / IGST split',
                  'GSTIN on every invoice',
                  'Batch & expiry tracking',
                  'Discount & MRP controls',
                  'PDF invoice download',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/30 rounded-2xl p-7 hover:border-violet-400/50 transition-all shadow-lg shadow-violet-900/20">
              <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center mb-5">
                <Package className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Live Inventory Management</h3>
              <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                Real-time stock levels with low-stock alerts. Track batch numbers, expiry dates, and rack locations automatically.
              </p>
              <ul className="space-y-2.5">
                {[
                  'Low-stock & expiry alerts',
                  'Batch number management',
                  'Auto stock deduction on sale',
                  'Multi-rack locations',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-violet-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-4 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-3">
             <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
               <Activity className="w-4 h-4 text-white" />
             </div>
             <span className="font-bold text-lg">RxDesk</span>
          </Link>
          <p className="text-sm text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">India&apos;s integrated pharmacy billing and doctor appointment platform. Built for Indian healthcare.</p>
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
            <div className="space-y-3">
               {[
                 { label: 'Patient', href: '/patient/login', icon: Users, color: 'text-blue-400' },
                 { label: 'Doctor', href: '/doctor/login', icon: Stethoscope, color: 'text-violet-400' },
                 { label: 'Shop / Clinic', href: '/login', icon: Store, color: 'text-emerald-400' },
               ].map((role) => (
                 <Link key={role.label} href={role.href} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:bg-white/[0.06] transition-all">
                   <div className="flex items-center gap-4">
                     <role.icon className={`w-5 h-5 ${role.color}`} />
                     <span className="font-semibold">{role.label}</span>
                   </div>
                   <ChevronRight className="w-4 h-4 text-gray-600" />
                 </Link>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
