import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Use — RxDesk',
  description: 'Read the Terms of Use governing your access to and use of the RxDesk platform.',
};

const LAST_UPDATED = 'March 11, 2026';
const CONTACT_EMAIL = 'legal@rxdesk.in';

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By downloading, installing, or using the RxDesk mobile application or web platform ("Service"), you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms, do not use the Service.

These Terms constitute a legally binding agreement between you and RxDesk ("we", "us", or "our"). We reserve the right to modify these Terms at any time. Continued use of the Service after changes are posted constitutes your acceptance of the revised Terms.`,
  },
  {
    id: 'eligibility',
    title: '2. Eligibility',
    items: [
      'You must be at least 18 years old to create an account. Users under 18 may use the Service only with verifiable parental or guardian consent.',
      'Doctors registering on RxDesk must hold a valid medical registration certificate issued by the Medical Council of India or a State Medical Council.',
      'Medical shop owners must possess a valid drug license issued under the Drugs and Cosmetics Act, 1940.',
      'You must provide accurate, current, and complete information during registration and keep it updated.',
    ],
  },
  {
    id: 'accounts',
    title: '3. User Accounts & Security',
    items: [
      'You are responsible for maintaining the confidentiality of your login credentials.',
      'You are responsible for all activity that occurs under your account.',
      'Notify us immediately at legal@rxdesk.in if you suspect unauthorised access to your account.',
      'We reserve the right to suspend or terminate accounts that violate these Terms.',
      'You may not create multiple accounts, impersonate another person, or use a false identity.',
    ],
  },
  {
    id: 'roles',
    title: '4. Platform Roles & Permitted Use',
    subsections: [
      {
        title: 'Patients',
        items: [
          'Search for doctors and medical shops near you',
          'Book, reschedule, or cancel appointments',
          'View digital prescriptions issued by your doctor',
          'Access your appointment history and billing records',
        ],
      },
      {
        title: 'Doctors',
        items: [
          'Manage your profile, qualifications, and consultation fees',
          'Set up and manage clinic chambers',
          'View your appointment queue and mark attendance',
          'Issue digital prescriptions to patients',
          'Access your appointment history',
        ],
      },
      {
        title: 'Medical Shop Owners',
        items: [
          'Register your shop with a valid drug license',
          'Manage doctor chambers associated with your shop',
          'Create and manage bills for walk-in and counter patients',
          'Manage inventory and stock records',
          'Subscribe to a plan to unlock features',
        ],
      },
    ],
  },
  {
    id: 'prohibited',
    title: '5. Prohibited Conduct',
    content: 'You agree not to:',
    items: [
      'Use the Service for any unlawful purpose or in violation of any applicable law',
      'Upload false, misleading, or fraudulent information including fake credentials',
      'Impersonate a medical professional without a valid registration',
      'Harvest, scrape, or collect data from the platform using automated tools',
      'Attempt to gain unauthorised access to any part of the Service or its infrastructure',
      'Interfere with or disrupt the integrity or performance of the Service',
      'Upload or transmit viruses, malware, or any other harmful code',
      'Use the Service to send unsolicited commercial communications (spam)',
      'Reverse-engineer, decompile, or disassemble any part of the Service',
      'Share your account credentials with any third party',
    ],
  },
  {
    id: 'medical-disclaimer',
    title: '6. Medical Disclaimer',
    content: `RxDesk is a technology platform that facilitates connections between patients, doctors, and medical shops. We are not a medical institution, hospital, or healthcare provider.

The information available on RxDesk — including doctor profiles, prescriptions, and health-related content — is for informational purposes only and does not constitute medical advice, diagnosis, or treatment.

Always seek the advice of a qualified medical professional for any medical condition. Never disregard professional medical advice or delay seeking it because of information found on RxDesk.

In case of a medical emergency, contact emergency services (112 in India) immediately. RxDesk is not an emergency service and should not be used in life-threatening situations.`,
  },
  {
    id: 'subscriptions',
    title: '7. Subscriptions & Payments',
    items: [
      'Shop owners must subscribe to a paid plan to access full platform features after the trial period.',
      'Subscription fees are billed monthly as per the plan selected.',
      'Payments are processed securely through Razorpay. RxDesk does not store your card or banking details.',
      'Subscriptions auto-renew at the end of each billing cycle unless cancelled.',
      'Refunds are not provided for partially used billing periods unless required by applicable law.',
      'We reserve the right to modify pricing with 30 days advance notice.',
      'Failure to pay may result in suspension or downgrade of your account features.',
    ],
  },
  {
    id: 'ip',
    title: '8. Intellectual Property',
    content: `All content on the RxDesk platform — including the logo, design, software, text, and graphics — is the property of RxDesk or its licensors and is protected by applicable intellectual property laws.

You are granted a limited, non-exclusive, non-transferable, revocable licence to use the Service for its intended purpose. You may not copy, reproduce, distribute, or create derivative works from any part of the Service without our prior written consent.

User-generated content (such as prescription data and billing information) remains the property of the respective users. By uploading content, you grant RxDesk a limited licence to store and process it solely to provide the Service.`,
  },
  {
    id: 'privacy',
    title: '9. Privacy',
    content: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand our data practices.`,
    link: { href: '/privacy', label: 'Read our Privacy Policy →' },
  },
  {
    id: 'termination',
    title: '10. Termination',
    items: [
      'You may delete your account at any time through the app settings.',
      'We may suspend or terminate your access immediately if you violate these Terms, provide false information, or engage in fraudulent or harmful activity.',
      'Upon termination, your right to use the Service ceases immediately.',
      'Data deletion following account termination is governed by our Privacy Policy.',
    ],
  },
  {
    id: 'liability',
    title: '11. Limitation of Liability',
    content: `To the maximum extent permitted by applicable law:`,
    items: [
      'RxDesk provides the Service "as is" and "as available" without warranties of any kind, express or implied.',
      'We do not warrant that the Service will be uninterrupted, error-free, or free of viruses.',
      'We are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.',
      'Our total liability to you for any claim arising from these Terms or your use of the Service shall not exceed the amount you paid to RxDesk in the 3 months preceding the claim.',
      'We are not responsible for the conduct, advice, or actions of any doctor or medical shop on the platform.',
    ],
  },
  {
    id: 'governing-law',
    title: '12. Governing Law & Disputes',
    content: `These Terms are governed by and construed in accordance with the laws of India. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts located in [Your City], India.

Before initiating any legal proceedings, you agree to first attempt to resolve the dispute informally by contacting us at legal@rxdesk.in. We will try to resolve the dispute within 30 days.`,
  },
  {
    id: 'contact',
    title: '13. Contact Us',
    content: `If you have any questions about these Terms, please contact us:`,
    contact: true,
  },
];

export default function TermsPage() {
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
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-400 mb-6 font-medium">
            <FileText className="w-3 h-3" /> Please Read Carefully
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Terms of Use
          </h1>
          <p className="text-gray-400 text-sm">
            Last updated: <span className="text-gray-300">{LAST_UPDATED}</span>
          </p>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">

        {/* Quick nav */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-10">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Contents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-sm text-gray-400 hover:text-violet-400 transition-colors py-0.5"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-lg font-bold text-white mb-3 pb-2 border-b border-white/[0.07]">
                {section.title}
              </h2>

              {section.content && (
                <p className="text-gray-400 text-sm leading-relaxed mb-4 whitespace-pre-line">
                  {section.content}
                </p>
              )}

              {section.subsections && (
                <div className="space-y-4">
                  {section.subsections.map((sub) => (
                    <div key={sub.title}>
                      <p className="text-sm font-semibold text-gray-300 mb-2">{sub.title}</p>
                      <ul className="space-y-1.5">
                        {sub.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm text-gray-400">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/70 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {section.items && (
                <ul className="space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-400">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/70 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {section.link && (
                <Link
                  href={section.link.href}
                  className="inline-block mt-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {section.link.label}
                </Link>
              )}

              {section.contact && (
                <div className="mt-3 bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-1.5 text-sm text-gray-400">
                  <p><span className="text-gray-300 font-medium">Email:</span>{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:underline">
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                  <p>
                    <span className="text-gray-300 font-medium">Phone:</span>{' '}
                    <a href="tel:+919830450252" className="text-violet-400 hover:underline">+91 98304 50252</a>
                    <span className="ml-1 text-gray-500">(Mon–Sat, 9 AM – 5 PM IST)</span>
                  </p>
                  <p><span className="text-gray-300 font-medium">Response time:</span> Within 30 days</p>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-14 bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-300 mb-1">Questions about these terms?</p>
          <p className="text-xs text-gray-500 mb-4">Also see our Privacy Policy for how we handle your data.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold text-white transition-colors shadow shadow-violet-500/20"
            >
              Contact Legal Team
            </a>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-sm font-semibold text-gray-300 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-8 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} RxDesk. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-violet-400">Terms of Use</Link>
            <Link href="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
