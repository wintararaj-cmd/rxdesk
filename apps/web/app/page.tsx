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

      {/* â”€â”€ NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <nav className="fixed inset-x-0 top-0 z-50 h-16 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">RxDesk</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            {([
              ['Pharmacy Billing', '#pharmacy-billing'],
              ['Appointments', '#appointments'],
              ['Features', '#features'],
              ['How it Works', '#how-it-works'],
            ] as [string, string][]).map(([label, href]) => (
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

      {/* â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute top-16 left-1/4 w-[650px] h-[450px] bg-violet-600/25 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-32 right-1/4 w-[450px] h-[350px] bg-fuchsia-600/20 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute top-56 left-[55%] w-[350px] h-[350px] bg-emerald-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[220px] bg-indigo-700/25 rounded-full blur-[80px] pointer-events-none" />

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
            {([
              { Icon: BadgeCheck, label: 'GST Compliant', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/35' },
              { Icon: IndianRupee, label: 'HSN Coded Invoices', color: 'text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/35' },
              { Icon: Pill, label: 'Medicine Database', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/35' },
              { Icon: Shield, label: 'Secure & Encrypted', color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/35' },
              { Icon: Clock, label: 'Real-time Sync', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/35' },
            ] as { Icon: (p: { className?: string }) => React.ReactElement | null; label: string; color: string; bg: string; border: string }[]).map(({ Icon, label, color, bg, border }) => (
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
                  placeholder="Search doctor, specializationâ€¦"
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
                  <span className="hidden sm:inline">{locStatus === 'ok' ? 'Located' : locStatus === 'loading' ? 'â€¦' : 'Near Me'}</span>
                </button>
                <button
                  onClick={() => runSearch()}
                  disabled={searching}
                  className="px-6 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 shadow shadow-violet-500/20"
                >
                  {searching ? 'Searchingâ€¦' : 'Find Doctors'}
                </button>
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

      {/* â”€â”€ SEARCH RESULTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {hasSearched && (
        <section id="results-section" className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-gray-500 mb-5">
              {searching ? 'Searchingâ€¦' : `${doctors.length} doctor${doctors.length !== 1 ? 's' : ''} found${coords ? ' Â· sorted by distance' : ''}`}
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
                          {doc.consultation_fee ? <span className="text-emerald-400 font-medium">â‚¹{doc.consultation_fee}</span> : null}
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
                              <span className="text-gray-600">Â·</span>
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

      {/* â”€â”€ PHARMACY BILLING SHOWCASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section id="pharmacy-billing" className="py-24 px-4 border-t border-emerald-900/40 bg-gradient-to-b from-emerald-950/25 via-[#09090f] to-[#09090f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 text-xs text-emerald-400 mb-4 font-medium">
              <Receipt className="w-3 h-3" /> Pharmacy Billing Software
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Complete{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Pharmacy Billing</span>
              {' '}Software
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base">
              From medicine sales to GST returns â€” every billing operation your pharmacy needs, fast and accurate.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Large card â€” GST Invoicing */}
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

            {/* Inventory card */}
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
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-3.5 h-3.5 text-violet-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Returns */}
            <div className="bg-yellow-500/[0.07] border border-yellow-500/25 rounded-2xl p-6 hover:border-yellow-400/40 transition-all">
              <div className="w-10 h-10 bg-yellow-500/15 border border-yellow-500/30 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="font-semibold mb-2">Sale &amp; Purchase Returns</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Handle medicine returns with full GST reversal, credit note generation, and automatic stock adjustment.</p>
            </div>

            {/* Walk-in billing */}
            <div className="bg-blue-500/[0.07] border border-blue-500/25 rounded-2xl p-6 hover:border-blue-400/40 transition-all">
              <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/30 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">Walk-in &amp; Patient Billing</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Quick billing for walk-in customers and linked patient accounts with prescription-based medicine dispensing.</p>
            </div>

            {/* Reports */}
            <div className="bg-pink-500/[0.07] border border-pink-500/25 rounded-2xl p-6 hover:border-pink-400/40 transition-all">
              <div className="w-10 h-10 bg-pink-500/15 border border-pink-500/30 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="font-semibold mb-2">Financial Reports</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Day-end, monthly, and GST summary reports. Ledger management, contra entries, and balance sheet ready to share with your CA.</p>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ DOCTOR APPOINTMENT MANAGEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section id="appointments" className="py-24 px-4 border-t border-violet-900/40 bg-gradient-to-b from-violet-950/20 via-[#09090f] to-[#09090f]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 text-xs text-violet-400 mb-4 font-medium">
                <Calendar className="w-3 h-3" /> Appointment Management
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Doctor Appointment
                <br />
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  Management, Simplified
                </span>
              </h2>
              <p className="text-gray-400 text-sm sm:text-base mb-8 leading-relaxed">
                Manage doctor chambers within your pharmacy or clinic. Accept online bookings, send automated reminders, and issue digital prescriptions â€” no additional software needed.
              </p>

              <div className="space-y-5">
                {[
                  { icon: Building2, title: 'Multi-Chamber Support', desc: 'Host multiple doctors in your clinic. Each manages their own schedule and patient queue independently.', color: 'text-violet-400' },
                  { icon: Calendar, title: 'Online Appointment Booking', desc: 'Patients search and book slots from mobile or web â€” no phone calls, no queues at the counter.', color: 'text-blue-400' },
                  { icon: ClipboardList, title: 'Digital Prescriptions', desc: 'Doctors issue prescriptions digitally. Pharmacy billing is auto-triggered from the same prescription.', color: 'text-emerald-400' },
                  { icon: FileText, title: 'Patient History & Records', desc: 'Full visit history, past prescriptions, and medication records accessible in one tap.', color: 'text-yellow-400' },
                ].map(({ icon: Icon, title, desc, color }) => (
                  <div key={title} className="flex gap-4">
                    <div className="w-10 h-10 shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-xl flex items-center justify-center mt-0.5">
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm mb-1">{title}</h3>
                      <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Appointment preview card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 rounded-3xl blur-2xl" />
              <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Today&apos;s Appointments</p>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 font-medium">Live</span>
                </div>
                {[
                  { name: 'Amit Sharma', time: '10:00 AM', badge: 'Confirmed', bc: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  { name: 'Priya Patel', time: '10:30 AM', badge: 'In Queue', bc: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
                  { name: 'Ramesh Gupta', time: '11:00 AM', badge: 'Confirmed', bc: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  { name: 'Sneha Rao', time: '11:30 AM', badge: 'Pending', bc: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  { name: 'Kiran Mehta', time: '12:00 PM', badge: 'Confirmed', bc: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                ].map(({ name, time, badge, bc }) => (
                  <div key={name} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-violet-500/15 rounded-lg flex items-center justify-center">
                        <span className="text-violet-300 text-[10px] font-bold">{name.split(' ').map((n) => n[0]).join('')}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium">{name}</p>
                        <p className="text-[10px] text-gray-600">{time}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bc}`}>{badge}</span>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-white/[0.05] grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: "Avg. Fee", value: 'â‚¹ 350', color: 'text-white' },
                    { label: "Today's Revenue", value: 'â‚¹ 1,750', color: 'text-emerald-400' },
                    { label: 'Total Patients', value: '5', color: 'text-violet-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="text-[10px] text-gray-600 mb-0.5">{label}</p>
                      <p className={`text-sm font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ FEATURES (3 PORTALS) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section id="features" className="py-20 px-4 border-t border-blue-900/30 bg-gradient-to-b from-blue-950/15 via-[#09090f] to-[#09090f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">One Platform, Three Portals</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-sm sm:text-base">Whether you&apos;re a patient, doctor, or clinic â€” RxDesk has a dedicated portal built for your workflow.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Patient */}
            <div className="bg-blue-500/[0.07] border border-blue-500/25 hover:border-blue-400/50 rounded-2xl p-6 transition-all hover:bg-blue-500/[0.12] group shadow-lg shadow-blue-900/10">
              <div className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-5">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-base mb-1">For Patients</h3>
              <p className="text-xs text-gray-600 mb-4">Book appointments in seconds</p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'Search nearby verified doctors',
                  'Book appointments online',
                  'View digital prescriptions',
                  'Track appointment history',
                  'Get SMS & app reminders',
                ].map((f) => (
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
            <div className="bg-violet-500/[0.07] border border-violet-500/25 hover:border-violet-400/50 rounded-2xl p-6 transition-all hover:bg-violet-500/[0.12] group shadow-lg shadow-violet-900/10">
              <div className="w-11 h-11 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center mb-5">
                <Stethoscope className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="font-semibold text-base mb-1">For Doctors</h3>
              <p className="text-xs text-gray-600 mb-4">Grow your practice digitally</p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'Manage chambers & schedules',
                  'View all appointments centrally',
                  'Issue digital prescriptions',
                  'Track full patient history',
                  'Get verified & boost visibility',
                ].map((f) => (
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
            <div className="bg-emerald-500/[0.07] border border-emerald-500/25 hover:border-emerald-400/50 rounded-2xl p-6 transition-all hover:bg-emerald-500/[0.12] group shadow-lg shadow-emerald-900/10">
              <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-5">
                <Store className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-base mb-1">For Medical Shops &amp; Clinics</h3>
              <p className="text-xs text-gray-600 mb-4">Run a smarter pharmacy</p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'GST billing & tax invoices',
                  'Medicine inventory & stock alerts',
                  'Doctor chamber hosting',
                  'Sale / purchase returns',
                  'Accounting & financial reports',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> {f}
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

      {/* â”€â”€ HOW IT WORKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section id="how-it-works" className="py-20 px-4 border-t border-cyan-900/30 bg-gradient-to-b from-cyan-950/15 via-[#09090f] to-[#09090f]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">How It Works</h2>
            <p className="text-gray-500 text-sm sm:text-base">From appointment to prescription to billing â€” one seamless connected flow</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { n: '01', Icon: Search, title: 'Find a Doctor', desc: 'Search verified doctors by specialization or location. See clinic details and available slots near you.', gradFrom: 'from-violet-500/30', gradTo: 'to-indigo-500/25', border: 'border-violet-400/40', iconColor: 'text-violet-300', dot: 'bg-gradient-to-br from-violet-500 to-indigo-500' },
              { n: '02', Icon: Calendar, title: 'Book Appointment', desc: 'Pick a date and time slot online. Receive instant SMS confirmation â€" no calls, no waiting.', gradFrom: 'from-blue-500/30', gradTo: 'to-cyan-500/25', border: 'border-blue-400/40', iconColor: 'text-blue-300', dot: 'bg-gradient-to-br from-blue-500 to-cyan-500' },
              { n: '03', Icon: ClipboardList, title: 'Digital Prescription', desc: 'Doctor issues a digital prescription after consultation â€" accessible instantly on your phone.', gradFrom: 'from-teal-500/30', gradTo: 'to-emerald-500/25', border: 'border-teal-400/40', iconColor: 'text-teal-300', dot: 'bg-gradient-to-br from-teal-500 to-emerald-500' },
              { n: '04', Icon: Receipt, title: 'Pharmacy Billing', desc: 'Medicines dispensed and billed with a GST-compliant invoice in seconds â€" directly from the prescription.', gradFrom: 'from-emerald-500/30', gradTo: 'to-green-500/25', border: 'border-emerald-400/40', iconColor: 'text-emerald-300', dot: 'bg-gradient-to-br from-emerald-500 to-teal-500' },
            ].map(({ n, Icon, title, desc, gradFrom, gradTo, border, iconColor, dot }) => (
              <div key={n} className="text-center">
                <div className="relative inline-flex mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-br ${gradFrom} ${gradTo} border ${border} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <Icon className={`w-7 h-7 ${iconColor}`} />
                  </div>
                  <span className={`absolute -top-2 -right-2 w-6 h-6 ${dot} rounded-full text-[10px] font-bold flex items-center justify-center shadow-lg`}>{n}</span>
                </div>
                <h3 className={`font-semibold mb-2 ${iconColor}`}>{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-16 px-4 border-t border-fuchsia-900/30 bg-gradient-to-b from-fuchsia-950/15 via-[#09090f] to-[#09090f]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { v: '500+', l: 'Verified Doctors', sub: 'across India', vc: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
              { v: '200+', l: 'Medical Shops', sub: 'using our billing', vc: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
              { v: '10,000+', l: 'Appointments Booked', sub: 'and counting', vc: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
              { v: '50,000+', l: 'GST Invoices', sub: 'generated to date', vc: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30' },
            ].map(({ v, l, sub, vc, bg, border }) => (
              <div key={l} className={`${bg} border ${border} rounded-2xl p-5 text-center shadow-lg`}>
                <div className={`text-2xl sm:text-3xl font-extrabold ${vc} mb-1`}>{v}</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-300 mb-0.5">{l}</div>
                <div className="text-[10px] text-gray-500">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ WHY CHOOSE RXDESK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-20 px-4 border-t border-indigo-900/30 bg-gradient-to-b from-indigo-950/15 via-[#09090f] to-[#09090f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Why Pharmacies Choose RxDesk</h2>
            <p className="text-gray-500 text-sm sm:text-base max-w-lg mx-auto">Everything you need to run a modern pharmacy and doctor chamber â€” not spread across 5 different tools</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: IndianRupee, title: 'India-First GST Billing', desc: 'GSTIN, HSN codes, CGST/SGST/IGST â€” all built in. No plugins, no workarounds, no CA headaches.', color: 'text-emerald-300', bg: 'bg-emerald-500/12', border: 'border-emerald-500/30', card: 'bg-emerald-500/[0.05] border-emerald-500/20' },
              { icon: Zap, title: 'Instant Invoices', desc: 'Generate and print GST bills in under 5 seconds. Barcode scanner support for faster checkout.', color: 'text-yellow-300', bg: 'bg-yellow-500/12', border: 'border-yellow-500/30', card: 'bg-yellow-500/[0.05] border-yellow-500/20' },
              { icon: Package, title: 'Smart Inventory', desc: 'Auto-deduct stock on every sale. Real-time alerts when items near expiry or fall below reorder level.', color: 'text-violet-300', bg: 'bg-violet-500/12', border: 'border-violet-500/30', card: 'bg-violet-500/[0.05] border-violet-500/20' },
              { icon: Stethoscope, title: 'Built-in Doctor Scheduling', desc: 'Add doctor chambers to your pharmacy. Manage appointments, prescriptions, and billing from one dashboard.', color: 'text-blue-300', bg: 'bg-blue-500/12', border: 'border-blue-500/30', card: 'bg-blue-500/[0.05] border-blue-500/20' },
              { icon: Shield, title: 'Secure & Role-Based', desc: 'Patient data encrypted at rest and in transit. Role-based access ensures staff see only what they need.', color: 'text-pink-300', bg: 'bg-pink-500/12', border: 'border-pink-500/30', card: 'bg-pink-500/[0.05] border-pink-500/20' },
              { icon: BarChart3, title: 'Powerful Reports', desc: 'Daily sales, GST summaries, purchase registers, and P&L â€” export-ready for your chartered accountant.', color: 'text-teal-300', bg: 'bg-teal-500/12', border: 'border-teal-500/30', card: 'bg-teal-500/[0.05] border-teal-500/20' },
            ].map(({ icon: Icon, title, desc, color, bg, border, card }) => (
              <div key={title} className={`flex gap-4 ${card} border rounded-2xl p-6 hover:brightness-110 transition-all`}>
                <div className={`w-10 h-10 shrink-0 ${bg} border ${border} rounded-xl flex items-center justify-center mt-0.5`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <h3 className={`font-semibold text-sm mb-1 ${color}`}>{title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-20 px-4 border-t border-violet-900/40 bg-gradient-to-b from-violet-950/15 via-[#09090f] to-[#09090f]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative bg-gradient-to-br from-emerald-600/20 via-violet-600/20 to-fuchsia-600/20 border border-violet-500/40 rounded-3xl p-10 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-48 bg-gradient-to-r from-emerald-600/35 via-violet-600/30 to-fuchsia-600/35 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-64 h-32 bg-indigo-600/25 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/40 to-violet-500/40 border border-emerald-400/40 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20">
                <Store className="w-6 h-6 text-emerald-300" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Start Your Free Trial Today</h2>
              <p className="text-gray-400 text-sm mb-2 max-w-md mx-auto">Join 200+ pharmacies and clinics already managing billing and appointments on RxDesk.</p>
              <p className="text-xs text-gray-600 mb-8">No credit card required Â· Setup in minutes Â· Free onboarding support</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/login?register=1" className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2">
                  <Store className="w-4 h-4" /> Register your Pharmacy
                </Link>
                <Link href="/doctor/login" className="px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/30 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" /> Register as Doctor
                </Link>
                <Link href="/patient/login" className="px-5 py-3 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.2] rounded-xl text-sm font-semibold transition-all flex items-center gap-2">
                  <Users className="w-4 h-4" /> I am a Patient
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <footer className="py-12 px-4 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold">RxDesk</span>
              </Link>
              <p className="text-xs text-gray-600 leading-relaxed">India&apos;s integrated pharmacy billing and doctor appointment platform. Built for Indian healthcare.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><Link href="/patient/login" className="hover:text-gray-300 transition-colors">Patient Portal</Link></li>
                <li><Link href="/doctor/login" className="hover:text-gray-300 transition-colors">Doctor Portal</Link></li>
                <li><Link href="/login" className="hover:text-gray-300 transition-colors">Pharmacy / Clinic Portal</Link></li>
                <li><Link href="/admin" className="hover:text-gray-300 transition-colors">Admin Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Features</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><button onClick={() => document.querySelector('#pharmacy-billing')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-gray-300 transition-colors text-left">Pharmacy Billing Software</button></li>
                <li><button onClick={() => document.querySelector('#appointments')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-gray-300 transition-colors text-left">Doctor Appointment Management</button></li>
                <li><button onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-gray-300 transition-colors text-left">Medicine Inventory Management</button></li>
                <li><button onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-gray-300 transition-colors text-left">GST Reports & Accounting</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Company</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><Link href="/contact" className="hover:text-gray-300 transition-colors">Contact Us</Link></li>
                <li><Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-gray-300 transition-colors">Terms of Use</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-600">Â© 2026 RxDesk. All rights reserved.</p>
            <p className="text-xs text-gray-700">Pharmacy Billing Â· Doctor Appointments Â· Inventory Management Â· India</p>
          </div>
        </div>
      </footer>

      {/* â”€â”€ LOGIN ROLE MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                  <div className="text-xs text-gray-500">Billing, inventory &amp; appointment management</div>
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

