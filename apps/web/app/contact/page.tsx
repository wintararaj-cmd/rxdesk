import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowLeft, Phone, Mail, Clock, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us — RxDesk',
  description: 'Get in touch with the RxDesk support team. We\'re here to help.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#09090f] text-white">

      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 h-16 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">RxDesk</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="relative pt-28 pb-12 px-4">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-violet-700/6 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 mb-6 font-medium">
            <MessageCircle className="w-3 h-3" /> We&apos;re here to help
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Contact Us
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Have a question, issue, or feedback? Reach out to our support team and we&apos;ll get back to you as soon as possible.
          </p>
        </div>
      </div>

      {/* ── CONTACT CARDS ── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">

          {/* Phone */}
          <a
            href="tel:+919830450252"
            className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] hover:border-violet-500/30 rounded-2xl p-6 transition-all"
          >
            <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
              <Phone className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Phone Support</p>
            <p className="text-white font-bold text-lg mb-1">+91 98304 50252</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              Mon – Sat, 9 AM – 5 PM IST
            </div>
          </a>

          {/* Email */}
          <a
            href="mailto:support@rxdesk.in"
            className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] hover:border-violet-500/30 rounded-2xl p-6 transition-all"
          >
            <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
              <Mail className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Email Support</p>
            <p className="text-white font-bold text-lg mb-1">support@rxdesk.in</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              Response within 24 hours
            </div>
          </a>
        </div>

        {/* Contact form */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-1">Send us a message</h2>
          <p className="text-sm text-gray-500 mb-6">Fill in the form and we&apos;ll respond within 24 hours.</p>

          <form
            action={`mailto:support@rxdesk.in`}
            method="get"
            encType="text/plain"
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1.5">Full Name</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Your name"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1.5">Phone Number</label>
                <input
                  name="phone"
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Email Address</label>
              <input
                name="email"
                type="email"
                placeholder="your@email.com"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Subject</label>
              <select
                name="subject"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
              >
                <option value="" className="bg-[#1a1a2e]">Select a topic</option>
                <option value="account" className="bg-[#1a1a2e]">Account &amp; Login</option>
                <option value="subscription" className="bg-[#1a1a2e]">Subscription &amp; Billing</option>
                <option value="appointment" className="bg-[#1a1a2e]">Appointments</option>
                <option value="prescription" className="bg-[#1a1a2e]">Prescriptions</option>
                <option value="technical" className="bg-[#1a1a2e]">Technical Issue</option>
                <option value="privacy" className="bg-[#1a1a2e]">Privacy &amp; Data</option>
                <option value="other" className="bg-[#1a1a2e]">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Message</label>
              <textarea
                name="body"
                rows={4}
                placeholder="Describe your issue or question..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold text-white transition-colors shadow shadow-violet-500/20"
            >
              Send Message
            </button>
          </form>
        </div>

        {/* Legal links */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-600">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Use</Link>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-8 px-4">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} RxDesk. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms of Use</Link>
            <Link href="/contact" className="text-violet-400">Contact</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
