import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowLeft, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — RxDesk',
  description: 'Learn how RxDesk collects, uses, and protects your personal and medical data.',
};

const LAST_UPDATED = 'March 11, 2026';
const CONTACT_EMAIL = 'privacy@rxdesk.in';
const GRIEVANCE_NAME = 'Grievance Officer, RxDesk';

const sections = [
  {
    id: 'overview',
    title: '1. Overview',
    content: `RxDesk ("we", "our", or "us") operates a digital healthcare platform that connects patients with doctors and medical shops across India. This Privacy Policy explains what personal data we collect, why we collect it, how we use it, and your rights under the Digital Personal Data Protection Act, 2023 (DPDPA) and other applicable laws.

By using our app or website, you consent to the practices described in this policy. If you do not agree, please discontinue use of our services.`,
  },
  {
    id: 'data-collected',
    title: '2. Data We Collect',
    subsections: [
      {
        title: 'Personal Information',
        items: [
          'Full name, phone number, and address',
          'Date of birth and gender (for patient profiles)',
          'Medical Registration Number (for doctors)',
          'Drug License Number (for medical shops)',
        ],
      },
      {
        title: 'Medical & Health Data',
        items: [
          'Appointment records including date, time, and doctor details',
          'Digital prescriptions issued by doctors',
          'Medical history and notes added by your doctor',
          'Billing records for consultations and medicines',
        ],
      },
      {
        title: 'Financial Data',
        items: [
          'Subscription plan and billing history (shop owners)',
          'Payment references from Razorpay (we do not store card/bank details)',
        ],
      },
      {
        title: 'Technical Data',
        items: [
          'Device type, operating system, and app version',
          'IP address and approximate location (if permitted)',
          'Push notification tokens (Firebase FCM) for reminders',
          'Session tokens for authentication',
        ],
      },
    ],
  },
  {
    id: 'how-we-use',
    title: '3. How We Use Your Data',
    items: [
      'Connecting patients with nearby doctors and medical shops',
      'Booking, managing, and sending reminders for appointments',
      'Generating and storing digital prescriptions',
      'Processing bills and maintaining billing records',
      'Verifying identity via OTP (through MSG91)',
      'Sending appointment reminders and health alerts via SMS and push notifications',
      'Improving platform performance and fixing technical issues',
      'Complying with legal and regulatory obligations',
    ],
  },
  {
    id: 'data-sharing',
    title: '4. Data Sharing & Third Parties',
    content: `We do not sell your personal data. We share data only as follows:`,
    items: [
      'Doctors: see only the data of their own patients (appointments, prescriptions)',
      'Medical Shops: see only their own billing and inventory records',
      'Razorpay: processes subscription payments — governed by Razorpay\'s Privacy Policy',
      'MSG91: delivers OTP and SMS notifications — your phone number is shared for delivery only',
      'Firebase (Google): delivers push notifications — governed by Google\'s Privacy Policy',
      'Legal authorities: if required by law, court order, or to protect rights and safety',
    ],
  },
  {
    id: 'data-storage',
    title: '5. Data Storage & Security',
    content: `Your data is stored on secure servers located in India. We implement the following safeguards:`,
    items: [
      'All data in transit is encrypted using HTTPS/TLS',
      'Passwords are securely hashed and never stored in plain text',
      'Access tokens (JWT) expire automatically and are rotated on refresh',
      'Session management limits the number of simultaneous active sessions per account',
      'Database access is restricted to authorised backend services only',
      'Prescription QR codes are HMAC-signed to prevent tampering',
    ],
  },
  {
    id: 'retention',
    title: '6. Data Retention',
    items: [
      'Active accounts: data retained for the duration of the account',
      'Deleted accounts: personal data purged within 30 days of deletion request',
      'Prescription and medical records: may be retained for up to 7 years to comply with medical record-keeping regulations',
      'Financial/billing records: retained for 8 years as required by tax laws',
      'Anonymised or aggregated analytics data may be retained indefinitely',
    ],
  },
  {
    id: 'your-rights',
    title: '7. Your Rights (DPDPA 2023)',
    content: `Under the Digital Personal Data Protection Act, 2023, you have the following rights:`,
    items: [
      'Right to Access: request a summary of personal data we hold about you',
      'Right to Correction: request correction of inaccurate or incomplete data',
      'Right to Erasure: request deletion of your personal data, subject to legal retention requirements',
      'Right to Withdraw Consent: withdraw consent for data processing at any time',
      'Right to Grievance Redressal: raise a complaint with our Grievance Officer (see Section 10)',
      'Right to Nominate: nominate a person to exercise rights on your behalf in case of death or incapacity',
    ],
    footer: 'To exercise any right, email us at privacy@rxdesk.in. We will respond within 30 days.',
  },
  {
    id: 'children',
    title: '8. Children\'s Privacy',
    content: `RxDesk is not intended for use by children under 18 years of age without parental or guardian consent. We do not knowingly collect personal data from children under 18 without verifiable parental consent. If you believe a child's data has been collected without consent, please contact us immediately and we will delete such data promptly.`,
  },
  {
    id: 'cookies',
    title: '9. Cookies & Local Storage',
    content: `Our web application uses browser local storage to maintain your login session. We do not use third-party advertising cookies. The mobile app uses device secure storage (Expo SecureStore) for authentication tokens. You can clear this data by logging out or uninstalling the app.`,
  },
  {
    id: 'grievance',
    title: '10. Grievance Officer',
    content: `In accordance with the Digital Personal Data Protection Act, 2023, and the Information Technology Act, 2000, we have appointed a Grievance Officer to address data-related concerns:`,
    contact: true,
  },
  {
    id: 'changes',
    title: '11. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. When we make significant changes, we will notify you via the app or email. Continued use of RxDesk after changes are posted constitutes acceptance of the revised policy. The date at the top of this page always reflects when the policy was last updated.`,
  },
];

export default function PrivacyPage() {
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
            <Shield className="w-3 h-3" /> Your Privacy Matters
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Privacy Policy
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

              {section.footer && (
                <p className="mt-3 text-sm text-violet-400">{section.footer}</p>
              )}

              {section.contact && (
                <div className="mt-3 bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-1.5 text-sm text-gray-400">
                  <p><span className="text-gray-300 font-medium">Name:</span> {GRIEVANCE_NAME}</p>
                  <p>
                    <span className="text-gray-300 font-medium">Email:</span>{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:underline">
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                  <p>
                    <span className="text-gray-300 font-medium">Phone:</span>{' '}
                    <a href="tel:+919830450252" className="text-violet-400 hover:underline">+91 98304 50252</a>
                    <span className="ml-1 text-gray-500">(Mon–Sat, 9 AM – 5 PM IST)</span>
                  </p>
                  <p><span className="text-gray-300 font-medium">Response time:</span> Within 30 days of receiving your complaint</p>
                  <p className="pt-1 text-gray-500 text-xs">
                    If you are not satisfied with our response, you may lodge a complaint with the Data Protection Board of India once it is constituted under the DPDPA, 2023.
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-14 bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-300 mb-3">
            Questions about your privacy? We&apos;re here to help.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold text-white transition-colors shadow shadow-violet-500/20"
          >
            Contact Privacy Team
          </a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-8 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} RxDesk. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/privacy" className="text-violet-400">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms of Use</Link>
            <Link href="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
