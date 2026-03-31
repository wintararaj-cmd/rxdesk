'use client';

import { Mail, Phone, Clock, MessageSquare, ExternalLink, HelpCircle, LayoutDashboard, Calendar, Users, Package, Receipt, BarChart3, Calculator, Settings } from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
    const supportContact = {
        email: 'support@rxdesk.in',
        phone: '+91 98304 50252',
        hours: 'Monday - Saturday: 5:00 PM to 9:00 PM',
    };

    const helpCategories = [
        {
            title: 'Getting Started',
            icon: <LayoutDashboard className="w-5 h-5 text-blue-500" />,
            desc: 'New to RxDesk? Learn the basics of setting up your shop and managing your first patient.',
            links: [
                { label: 'Shop Profile Setup', href: '/dashboard/settings' },
                { label: 'Subscription Plans', href: '/dashboard/settings' },
                { label: 'Adding your first Doctor', href: '/dashboard/appointments' }
            ]
        },
        {
            title: 'Pharmacy & Billing',
            icon: <Receipt className="w-5 h-5 text-amber-500" />,
            desc: 'Master the POS. Search medicines, generate GST bills, and manage customer credit/outstandings.',
            links: [
                { label: 'Creating an Invoice', href: '/dashboard/billing' },
                { label: 'Batch & Expiry Entry', href: '/dashboard/inventory' },
                { label: 'Return & Credit Notes', href: '/dashboard/accounting' }
            ]
        },
        {
            title: 'Stock Management',
            icon: <Package className="w-5 h-5 text-emerald-500" />,
            desc: 'Keep your inventory accurate. Track purchase entries, low stock alerts, and rack locations.',
            links: [
                { label: 'Purchase Inward', href: '/dashboard/accounting' },
                { label: 'Stock Adjustments', href: '/dashboard/inventory' },
                { label: 'Expiry Tracking', href: '/dashboard/inventory' }
            ]
        },
        {
            title: 'Accounting & GST',
            icon: <Calculator className="w-5 h-5 text-violet-500" />,
            desc: 'File your taxes with ease. Generate GSTR-1, 2, and 3B summaries and track supplier payments.',
            links: [
                { label: 'Financial SOP Guide', href: '/dashboard/help/accounting-sop' },
                { label: 'GST Summary Guide', href: '/dashboard/accounting' },
                { label: 'Expense Records', href: '/dashboard/accounting' },
                { label: 'Cash & Bank Books', href: '/dashboard/accounting' }
            ]
        }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ... (Hero section same) ... */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[2.5rem] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl -ml-20 -mb-20" />
                
                <div className="relative z-10 text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                        <HelpCircle className="w-4 h-4" />
                        Help Center
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">How can we help you today?</h1>
                    <p className="text-indigo-100 text-lg max-w-xl mx-auto font-medium">
                        Search our guides or reach out to our dedicated support team for personalized assistance.
                    </p>
                </div>
            </div>

            {/* Support Channels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a href={`mailto:${supportContact.email}`} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-center text-center space-y-3">
                    <div className="p-3 bg-blue-50 rounded-2xl group-hover:scale-110 transition-transform">
                        <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-gray-900 font-bold">Email Support</p>
                        <p className="text-sm text-gray-500 mt-1">{supportContact.email}</p>
                    </div>
                </a>
                
                <a href={`tel:${supportContact.phone}`} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-center text-center space-y-3">
                    <div className="p-3 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform">
                        <Phone className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-gray-900 font-bold">Call Us</p>
                        <p className="text-sm text-gray-500 mt-1">{supportContact.phone}</p>
                    </div>
                </a>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-3">
                    <div className="p-3 bg-violet-50 rounded-2xl">
                        <Clock className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                        <p className="text-gray-900 font-bold">Support Hours</p>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-tight">{supportContact.hours}</p>
                    </div>
                </div>
            </div>

            {/* Help Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {helpCategories.map((cat, idx) => (
                    <div key={idx} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:border-violet-200 transition-all flex flex-col h-full">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-gray-50 rounded-2xl">
                                {cat.icon}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{cat.title}</h3>
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-1">
                            {cat.desc}
                        </p>
                        <div className="space-y-3">
                            {cat.links.map((link, lidx) => (
                                <Link key={lidx} href={link.href} className="w-full flex items-center justify-between text-left px-4 py-2 bg-gray-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors">
                                    {link.label}
                                    <ExternalLink className="w-3 h-3 opacity-50" />
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Explore Guide (Re-used from settings) */}
            <div className="bg-violet-50/50 rounded-[2.5rem] p-10 border border-violet-100 flex flex-col sm:flex-row items-center gap-8">
                <div className="flex-1 space-y-4 text-center sm:text-left">
                    <h2 className="text-2xl font-black text-gray-900">Still exploring?</h2>
                    <p className="text-gray-600 font-medium">Check out our feature-by-feature guide in the settings page to master the application in minutes.</p>
                    <Link href="/dashboard/settings" className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-200">
                        View Feature Guide
                        <LayoutDashboard className="w-4 h-4" />
                    </Link>
                </div>
                <div className="w-48 h-48 bg-white rounded-3xl p-6 shadow-xl relative group">
                    <div className="absolute inset-0 bg-violet-600 scale-0 group-hover:scale-100 transition-transform rounded-3xl -z-10 opacity-10" />
                    <HelpCircle className="w-full h-full text-violet-600" />
                </div>
            </div>
        </div>
    );
}
