# RxDesk — Healthcare App System Design & Development Plan
### Connecting Patients, Doctors & Medical Shops in Local India

> **Vision:** Every patient in small-town India should be able to find their local doctor,
> book an appointment, receive a digital prescription, and get medicines billed — all from one app.

---

## Table of Contents

1. [Complete Feature Breakdown](#1-complete-feature-breakdown)
2. [Database Schema](#2-database-schema)
3. [API Architecture](#3-api-architecture)
4. [Recommended Tech Stack](#4-recommended-tech-stack)
5. [MVP Version Plan](#5-mvp-version-plan)
6. [Revenue & Scalability Plan](#6-revenue--scalability-plan)
7. [Potential Challenges & Solutions](#7-potential-challenges--solutions)
8. [UI/UX Screen Flow](#8-uiux-screen-flow)
9. [Pharmacy Billing System Design](#9-pharmacy-billing-system-design)
10. [Accounting Module Structure](#10-accounting-module-structure)
11. [Security & Compliance (India)](#11-security--compliance-india)
12. [Estimated Development Timeline](#12-estimated-development-timeline)

---

## 1. Complete Feature Breakdown

### 1.1 Patient App (Mobile — Android-first)

| Module | Features |
|---|---|
| **Onboarding** | Mobile OTP login, profile setup (name, age, gender, address, blood group) |
| **Doctor Search** | Search by name / specialization / area / pin code, filter by fee range, available today |
| **Chamber Listing** | View all shops/clinics where a doctor sits, timings per location, days available |
| **Appointment Booking** | Select shop, select time slot, pay consultation fee (optional online), get confirmation SMS |
| **Reminders** | SMS + push notification 1 hour before appointment, day-before reminder |
| **Digital Prescription** | View prescription issued by doctor, download PDF, share to WhatsApp |
| **Bill History** | View all bills generated at medical shop, itemised medicine list |
| **Medicine Availability** | Search any medicine, see which nearby shops have it in stock with quantity |
| **Shop Contact** | Call shop directly from app, see map location |
| **Patient History** | View all past appointments, prescriptions, diagnoses |

---

### 1.2 Doctor App (Mobile — Android-first)

| Module | Features |
|---|---|
| **Onboarding** | Register with medical registration number (MCI), upload degree certificate, photo ID |
| **Verification** | Admin reviews & approves doctor profile (manual + automated checks) |
| **Dashboard** | Today's appointment count, pending/completed breakdowns, earnings summary |
| **Appointment List** | Real-time list of today's patients per chamber, with patient details |
| **Digital Prescription** | Write diagnosis, symptoms, medicines (from integrated database), dosage, duration |
| **Patient History** | View patient's past prescriptions and visits across all chambers |
| **Chamber Management** | Add / remove chambers (medical shops), set schedule per chamber, set days & hours |
| **Consultation Fee** | Set fee per chamber (can differ for each location) |
| **Patient Count** | Total patients today, this week, this month — per chamber and combined |
| **Leave Management** | Mark unavailable dates, chambers auto-block new appointments |

---

### 1.3 Medical Shop / Clinic Panel (Mobile App + Web Panel)

| Module | Features |
|---|---|
| **Shop Registration** | Shop name, GST number, drug license number, owner details, location, contact |
| **Doctor Linking** | Search doctor by name/MCI number, send link request, doctor approves |
| **Appointment Dashboard** | Real-time view of all appointments for all linked doctors today |
| **Appointment Management** | Mark patient arrived, in-consultation, completed, no-show |
| **Prescription Viewer** | View digital prescription issued by doctor for any patient |
| **Automatic Billing** | Auto-generate bill from prescription medicines, edit quantities, add extra items |
| **Medicine Inventory** | Add medicines (name, batch, expiry, MRP, stock qty), update on sale |
| **Out-of-Stock Alert** | Push notification when any medicine stock falls below threshold |
| **Nearby Shop Availability** | Search if a medicine is available at other registered shops in pin code |
| **PDF Generation** | Print prescription (letterhead format) and bill (GST invoice format) |
| **Sales Report** | Daily / monthly sales, top medicines sold, doctor-wise patient inflow |
| **Subscription Management** | View current plan, upgrade/downgrade, billing history |

---

## 2. Database Schema

> Full schema details are in [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)

### Core Entity Summary

```
users               → base table for all roles (patient, doctor, shop_owner, admin)
patients            → profile linked to user
doctors             → profile, MCI number, specialization, verification status
medical_shops       → shop details, GST, drug license, location coordinates
doctor_chambers     → many-to-many: doctor ↔ shop with schedule info
appointments        → patient books slot at a specific doctor_chamber
prescriptions       → issued by doctor for an appointment
prescription_items  → medicines listed in a prescription
medicines           → master medicine database (name, form, strength)
shop_inventory      → shop-specific stock of each medicine
bills               → generated from prescription at shop
bill_items          → line items of a bill
notifications       → SMS/push log per user
subscriptions       → shop subscription plan & billing
```

### Key Relationships

```
Patient      ─── books ──────────► Appointment
Appointment  ─── at ─────────────► DoctorChamber (Doctor + Shop)
Appointment  ─── generates ──────► Prescription
Prescription ─── contains ───────► PrescriptionItems (Medicine)
Prescription ─── triggers ───────► Bill (at Shop)
Bill         ─── deducts from ───► ShopInventory
```

---

## 3. API Architecture

> Full API reference is in [`API_ARCHITECTURE.md`](./API_ARCHITECTURE.md)

### Architecture Style

- **REST API** with versioning (`/api/v1/`)
- **JWT-based authentication** with role-based access control
- **WebSocket** for real-time appointment queue updates (shop panel)
- **Webhook** for SMS gateway integration

### Module Groupings

```
/auth              → OTP login, register, token refresh
/patients          → profile CRUD, history
/doctors           → profile, verification, chamber schedule
/shops             → registration, doctor linking, inventory
/appointments      → book, cancel, status update, today's list
/prescriptions     → create, view, PDF export
/bills             → generate from prescription, itemize, GST
/medicines         → search, availability across shops
/notifications     → send SMS, push, view history
/subscriptions     → plan management, Razorpay webhook
/admin             → doctor verification, shop approval, analytics
```

---

## 4. Recommended Tech Stack

> Full tech stack details are in [`TECH_STACK.md`](./TECH_STACK.md)

### Summary Table

| Layer | Technology | Reason |
|---|---|---|
| Patient & Doctor App | React Native (Expo) | Single codebase, Android-first, fast iteration |
| Shop Panel (Web) | React.js + Tailwind CSS | Desktop-friendly for shop owners |
| Shop Panel (Mobile) | Same React Native app (separate role) | Shopkeepers use phones |
| Backend API | Node.js + Express.js | Fast, scalable, large ecosystem |
| Database | PostgreSQL | Relational data, ACID compliance for billing |
| Cache | Redis | Session store, real-time queue, rate limiting |
| File Storage | AWS S3 / Cloudflare R2 | Prescription PDFs, doctor certificates |
| SMS Gateway | MSG91 / Fast2SMS | Indian OTP & reminder SMS |
| Push Notifications | Firebase Cloud Messaging (FCM) | Free, reliable Android push |
| Payment Gateway | Razorpay | Indian UPI/card support, easy integration |
| PDF Generation | Puppeteer / PDFKit (Node.js) | Server-side prescription & bill PDF |
| Maps | Google Maps API / Mapbox | Shop location, nearby search |
| Deployment | AWS EC2 / Railway / Render | Scalable cloud hosting |
| CI/CD | GitHub Actions | Automated test & deploy pipeline |

---

## 5. MVP Version Plan

### Phase 0 — Pre-MVP (Weeks 1–2): Foundation

- [ ] Finalize wireframes for all 3 roles
- [ ] Set up monorepo (backend + frontend apps)
- [ ] Configure PostgreSQL schema, Redis, S3 bucket
- [ ] Integrate MSG91 SMS OTP
- [ ] Admin dashboard (basic) for doctor verification

### Phase 1 — MVP Core (Weeks 3–10)

**Sprint 1 (Wk 3–4): Auth & Profiles**
- OTP login for all 3 roles
- Patient profile setup
- Doctor profile + MCI registration
- Shop registration

**Sprint 2 (Wk 5–6): Doctor & Chamber System**
- Doctor adds chambers (links to shops)
- Shop approves doctor link
- Schedule setup per chamber (days, time slots)
- Doctor search by area/specialization

**Sprint 3 (Wk 7–8): Appointments**
- Patient books appointment at a doctor's chamber
- Shop panel sees real-time appointment list
- Doctor sees today's patient queue
- SMS confirmation to patient

**Sprint 4 (Wk 9–10): Prescription & Billing**
- Doctor writes digital prescription
- Shop views prescription, generates bill
- Basic medicine inventory (manual entry)
- PDF download for prescription

### Phase 2 — Growth Features (Weeks 11–16)

- Medicine availability search across shops
- Out-of-stock alerts
- Patient history & past prescriptions
- Consultation fee & payment (optional)
- Razorpay subscription for shops
- Sales reports for shops
- Nearby shop medicine transfer query

### Phase 3 — Scale Features (Month 5–6)

- Medicine master database integration (OpenFDA / custom DB)
- WhatsApp prescription sharing (WhatsApp Business API)
- Analytics dashboard for admin
- Multi-language support (Hindi, regional languages)
- Telemedicine module (video consult via WebRTC)

---

## 6. Revenue & Scalability Plan

### Primary Revenue: Medical Shop Subscriptions

| Plan | Price/Month | Features |
|---|---|---|
| **Basic** | ₹499 | 1 doctor link, 50 appointments/month, 2 active sessions, basic billing |
| **Standard** | ₹999 | 5 doctor links, 250 appointments/month, 5 active sessions, inventory alerts, PDF bills |
| **Premium** | ₹1,999 | 15 doctor links, unlimited appointments, 10 active sessions, all features, WhatsApp notifications, sales analytics |
| **One-time Onboarding** | ₹999 | Profile setup, training, verification support |

### Revenue Projections

```
Year 1 Target:  200 shops onboarded
                Avg revenue/shop = ₹800/month
                Monthly Revenue  = ₹1,60,000
                Annual Revenue   = ₹19,20,000

Year 2 Target:  1,000 shops (expand to 5 districts)
                Monthly Revenue  = ₹8,00,000
                Annual Revenue   = ₹96,00,000

Year 3 Target:  5,000 shops (state-wide)
                Monthly Revenue  = ₹40,00,000
                Annual Revenue   = ₹4.8 Crore
```

### Secondary Revenue Streams (Post-MVP)

| Stream | Model |
|---|---|
| **Medicine Supplier Tie-ups** | Commission per bulk order referral from inventory alerts |
| **Diagnostic Labs** | Referral fee when doctor recommends lab tests via app |
| **Health Insurance** | Commission if patient buys policy via app |
| **Telemedicine** | Revenue share on video consultation fee |
| **Data Analytics (Anonymised)** | Aggregate prescription trends sold to pharma companies |
| **B2B SaaS** | White-label the platform for hospital chains |

### Scalability Strategy

1. **City-cluster approach** — Dominate 1 city's medical shops before moving to next
2. **Field sales agents** — Hire local agents on commission to onboard shops
3. **Doctor network effect** — Once top doctors use the app, their shops follow
4. **Vernacular support** — Hindi & regional language UI increases adoption in Tier-3 towns
5. **Offline mode** — Appointment queue works offline, syncs when connected (critical for low-connectivity areas)

---

## 7. Potential Challenges & Solutions

| # | Challenge | Root Cause | Solution |
|---|---|---|---|
| 1 | **Doctor adoption resistance** | Doctors fear tech, don't want to change paper habits | Minimal-input prescription UI, pre-loaded medicine suggestions, receptionist can enter data on doctor's behalf |
| 2 | **Low smartphone literacy at shops** | Older shopkeepers unfamiliar with apps | Simple shop panel UI, WhatsApp-based notifications as fallback, field agent training |
| 3 | **Poor internet in rural areas** | 2G/3G connectivity | Offline-first mobile app using SQLite local cache + background sync |
| 4 | **Doctor verification fraud** | Fake doctors registering | Admin manual review + MCI number API check (NMC India) + document upload |
| 5 | **Medicine database gaps** | Indian brands not in global DBs | Build custom Indian medicine database, crowd-source via shops, integrate with Pharmarack/1mg API |
| 6 | **Data privacy concerns** | Patients wary about medical data online | Encrypted storage, no data sold, clear privacy policy in local language, DPDP Act compliance |
| 7 | **Multi-doctor at same shop conflicts** | 2 doctors at same shop, appointment clash | Per-doctor time slots within a shop, slot locking during booking |
| 8 | **Non-payment by shops** | Shops using app but not paying after trial | 30-day free trial, then feature lockout (not full block), easy UPI payment via Razorpay |
| 9 | **Competition from large apps** | Practo, 1mg entering local market | Hyper-local focus, offline capability, shop-centric billing model that large apps don't serve |
| 10 | **Prescription misuse** | Digital prescriptions being reused/forged | Prescription QR code with validity date, shop must scan to dispense, one-time use flag |

---

## 8. UI/UX Screen Flow

### 8.1 Patient App Flow

```
Splash Screen
    └── OTP Login → Profile Setup (first time)
            └── Home Dashboard
                    ├── Search Bar (doctor name / specialization / area)
                    │       └── Search Results (doctor cards with photo, specs, fee)
                    │               └── Doctor Profile Page
                    │                       ├── About / Qualifications
                    │                       ├── Chamber List (shop name, address, days, timings)
                    │                       └── Book Appointment Button
                    │                               └── Select Chamber → Select Date → Select Slot
                    │                                       └── Confirm Booking → SMS Confirmation
                    │
                    ├── My Appointments
                    │       └── Upcoming / Past tabs
                    │               └── Appointment Detail → View Prescription → Download PDF
                    │
                    ├── My Prescriptions
                    │       └── List of all prescriptions (sorted by date)
                    │               └── Prescription Detail (medicines, dosage, doctor note)
                    │
                    ├── Medicine Search
                    │       └── Type medicine name → See shops with stock + distance
                    │               └── Shop Detail (contact, address, in-stock qty)
                    │
                    └── Profile
                            └── Edit profile, blood group, emergency contact, notification settings
```

### 8.2 Doctor App Flow

```
OTP Login → Doctor Registration (MCI, specs, photo, degree)
    └── Pending Verification Screen (wait for admin approval)
            └── Home Dashboard (after approved)
                    ├── Today's Queue
                    │       └── Patient card (name, age, complaint if entered)
                    │               └── Write Prescription
                    │                       ├── Chief Complaint / Diagnosis (text)
                    │                       ├── Add Medicine (search from DB, dosage, duration)
                    │                       ├── Advice / Follow-up note
                    │                       └── Issue Prescription → Patient notified
                    │
                    ├── My Chambers
                    │       └── List of linked shops
                    │               └── Chamber Detail → Edit schedule → Set fee
                    │               └── Add New Chamber → Search Shop → Send Link Request
                    │
                    ├── Patient History
                    │       └── Search patient by name/phone → See all past visits
                    │
                    └── Stats
                            └── Total patients (today / week / month), per chamber breakdown
```

### 8.3 Medical Shop Panel Flow

```
OTP Login → Shop Registration (GST, drug license, address, location pin)
    └── Home Dashboard (after admin approval)
            ├── Today's Appointments
            │       └── Real-time list (WebSocket) → Mark arrived / done / no-show
            │               └── Patient card → View prescription (if issued)
            │                       └── Generate Bill → Review medicines → Add items → Print / Share PDF
            │
            ├── Doctors
            │       └── Linked doctors list → Add doctor (search by name/MCI)
            │               └── Doctor requests doctor approval from their app
            │
            ├── Inventory
            │       └── Medicine list with stock levels
            │               ├── Add medicine (name, batch, expiry, MRP, qty)
            │               ├── Update stock (on delivery)
            │               └── Out-of-stock badge + alert notification
            │
            ├── Medicine Search (Nearby)
            │       └── Search medicine → see other shops in pin code that have it
            │
            ├── Reports
            │       └── Sales today / this month, top medicines, doctor-wise patients
            │
            └── Settings
                    └── Subscription plan, shop profile, notification preferences
```

---

## 9. Pharmacy Billing System Design

### 9.1 Billing Modes

The shop panel supports **three billing entry modes**:

| Mode | Trigger | Workflow |
|---|---|---|
| **Prescription-linked** | Doctor issues digital prescription → shop receives it | Auto-populate bill items from prescription medicines → shop reviews/edits → confirm |
| **Walk-in (Manual)** | Patient walks in without appointment/prescription | Barcode scan or type medicine name, add qty, calculate total |
| **Partial prescription** | Some medicines not in stock | Bill available medicines, note out-of-stock items, suggest nearby shop |

---

### 9.2 GST Billing Rules (India)

Medicines in India fall into three GST slabs. The system auto-selects HSN code from the medicine master:

| GST Slab | Medicine Category | HSN Range |
|---|---|---|
| 0% (Nil) | Life-saving drugs (insulin, cancer drugs, dialysis supplies) | 3004 (select) |
| 5% | Most formulations listed in Pharma Price Control Order | 3003, 3004 |
| 12% | Non-essential pharma, medical devices, OTC supplements | 3006, 9021 |
| 18% | Cosmetic/herbal products, sanitizers | 3304, 3808 |

```
Bill Line Item Calculation:
  line_subtotal  = mrp × quantity
  discount_amt   = line_subtotal × (discount_pct / 100)
  taxable_value  = line_subtotal − discount_amt
  cgst_amount    = taxable_value × (gst_rate / 2 / 100)   // intra-state
  sgst_amount    = taxable_value × (gst_rate / 2 / 100)   // intra-state
  igst_amount    = taxable_value × (gst_rate / 100)        // inter-state only
  line_total     = taxable_value + cgst_amount + sgst_amount
```

The invoice PDF groups items by GST slab and prints a GST Summary table at the bottom (mandatory for GST-registered shops).

---

### 9.3 Bill Lifecycle & State Machine

```
DRAFT ──► CONFIRMED ──► PAID ──► REFUNDED
            │                       ▲
            └──► PARTIALLY_PAID ───┘
            │
            └──► CANCELLED
```

| State | Description |
|---|---|
| `draft` | Auto-generated from prescription; shop is reviewing/editing items |
| `confirmed` | Shop finalised items and total; ready for payment |
| `paid` | Full payment received (cash/UPI/card) |
| `partially_paid` | Credit sale — partial amount received, rest on credit |
| `cancelled` | Bill voided (returns inventory back to stock) |
| `refunded` | Full return processed; stock incremented |

---

### 9.4 Barcode / Medicine Entry

```
Barcode scan flow:
  1. Camera scans barcode (EAN-13 or custom)
  2. App looks up barcode in shop_inventory
  3. If found → auto-fill medicine row (name, batch, MRP, GST)
  4. Staff enters quantity → line total auto-calculated
  5. If not found → prompt to add manually or search from master DB

Manual search flow:
  1. Staff types 3+ chars of medicine name
  2. Debounced search across shop inventory (stock > 0 first)
  3. Select medicine → row added
  4. Quantity input → line total calculated
```

Barcode library: `expo-barcode-scanner` (mobile), browser `zxing` (web panel).

---

### 9.5 Invoice Generation

A **GST-compliant invoice** must contain:

```
[Shop Letterhead: Name, Address, GST No., Drug License No., Contact]
─────────────────────────────────────────────────────────────────────
Invoice No: DOC-2026-001234        Date: 06/03/2026
Patient: Rahul Sharma              Doctor: Dr. Anita Singh
─────────────────────────────────────────────────────────────────────
S# | Medicine          | Batch  | Exp   | Qty | MRP   | Disc%| Total
1  | Paracetamol 500mg | B2245  | 12/26 | 10  | 32.00 | 0    | 32.00
2  | Amoxicillin 500mg | A3310  | 06/26 | 14  | 85.00 | 5%   | 79.75
─────────────────────────────────────────────────────────────────────
                              Subtotal:          ₹111.75
                              CGST (6%):         ₹ 4.79 (on ₹79.75)
                              SGST (6%):         ₹ 4.79
                              Round-off:         ₹ 0.17
                              TOTAL:             ₹121.50
─────────────────────────────────────────────────────────────────────
Payment: Cash ✓    UPI □    Card □
Signature: ________________
```

Invoice delivery options:
- **Print** — thermal (58mm/80mm) or A4 via browser `window.print()`
- **PDF share** — server-generated PDF sent via WhatsApp (WhatsApp Business API) or downloadable
- **SMS** — short bill summary + PDF link via MSG91

---

### 9.6 Daily Sales Report

The shop panel **Reports** section shows:

| Metric | Display |
|---|---|
| Total sales (day/week/month) | ₹ value + bill count |
| Cash vs UPI vs Card breakdown | Pie chart |
| Top 10 medicines sold | Bar chart (qty + revenue) |
| Doctor-wise patient invoices | Grouped by linked doctor |
| Outstanding credits | Total owed by credit customers |
| Low-stock items | Count + list |

---

### 9.7 Return & Refund Flow

```
1. Shop searches bill by invoice no. or patient phone
2. Select items to return (partial or full return)
3. System checks: return allowed within 7 days & sealed/unused
4. On confirm:
   - bill_items marked returned
   - shop_inventory.stock_qty incremented
   - refund_amount calculated
   - payment_method = 'cash' → cash refund logged
   - payment_method = 'upi'  → manual UPI refund, log reference no.
5. Credit note PDF generated
```

---

## 10. Accounting Module Structure

### 10.1 Overview

The accounting module is **shop-centric** — each medical shop gets its own books. It is NOT a full double-entry accounting system (which would be too complex for small-town shop owners). Instead, it is a **single-entry cashbook + stock ledger** that is practical and GST-ready.

```
Accounting Data Model:
  income_entries     ← bills paid (auto-created on payment)
  expense_entries    ← manual: supplier payments, rent, salary, utilities
  purchase_entries   ← medicine stock received from supplier
  supplier_ledgers   ← per-supplier payable tracking
  credit_customers   ← customers who owe money (credit sales)
  credit_transactions← credit given / received payments
```

---

### 10.2 Income Tracking

Income entries are **auto-created** whenever a bill is marked as `paid` or `partially_paid`:

```json
{
  "entry_type": "sale_income",
  "amount": 321.50,
  "payment_method": "upi",
  "reference_bill_id": "uuid",
  "date": "2026-03-06",
  "notes": "Patient: Rahul Sharma — Invoice DOC-2026-001234"
}
```

Manual income categories (for non-prescription sales):
- OTC medicine walk-in sales
- Medical equipment / consumable sales
- Consultation fee collected on behalf of doctor (if applicable)

---

### 10.3 Expense Tracking

Shopkeepers log daily expenses manually:

| Category | Examples |
|---|---|
| `medicine_purchase` | Stock bought from supplier (auto-linked to purchase_entry) |
| `rent` | Shop rent paid |
| `salary` | Staff salary |
| `utilities` | Electricity, water, internet |
| `transport` | Delivery / freight charges |
| `maintenance` | AC repair, computer maintenance |
| `miscellaneous` | Any other expense |

---

### 10.4 Supplier & Purchase Module

```
supplier_purchase flow:
  1. Shopkeeper receives stock from supplier
  2. Enters purchase entry:
     - Supplier name (from saved suppliers list)
     - Invoice number, date
     - Items: medicine, batch, expiry, qty, purchase price, MRP
  3. System:
     - Increments shop_inventory stock_qty
     - Creates expense_entry of type 'medicine_purchase'
     - Updates supplier_ledger (amount owed to supplier)
  4. Shopkeeper marks payment (full/partial) to supplier
     - supplier_ledger balance reduces
     - payment logged with method (cash/NEFT/UPI/cheque)
```

**Supplier Ledger** tracks:
- Total purchases from supplier (cumulative)
- Total payments made
- Outstanding payable balance
- Payment history (dates, amounts, modes)

---

### 10.5 Credit Customer Management

Many small-town shops give **credit (udhar)** to regular customers:

```
credit_customers table:
  - customer_name, phone, address
  - credit_limit (optional cap)
  - total_outstanding (calculated)

credit_transactions:
  - type: 'credit_given' (bill not fully paid)
  - type: 'payment_received' (customer pays back)
  - linked bill_id, amount, date, notes

UI shows:
  - Complete credit book per customer
  - Total outstanding across all credit customers
  - Overdue alerts (> 30 days unpaid)
```

---

### 10.6 Profit & Loss Overview

P&L calculated on demand (not real-time bookkeeping) for the selected date range:

```
Revenue:
  (+) Total bill payments received (cash + digital)
  (+) Any other income entries

Cost of Goods Sold (COGS):
  (−) Purchase price of medicines billed (from bill_items × purchase_price)

Gross Profit = Revenue − COGS
Gross Margin % = (Gross Profit / Revenue) × 100

Operating Expenses:
  (−) Rent
  (−) Salaries
  (−) Utilities
  (−) Other logged expenses

Net Profit = Gross Profit − Operating Expenses
```

> **Note:** Tax (GST) collected is a liability, not income. GST collected is shown separately for GSTR-1 filing reference. GST paid on purchases (input tax credit) is shown as ITC available.

---

### 10.7 Stock Valuation

Two valuation methods supported:

| Method | Formula | Use |
|---|---|---|
| **Weighted Average Cost (WAC)** | (Total purchase cost) / (Total units in stock) | Default — suitable for FIFO dispensing |
| **FIFO** | Oldest batch cost first | More accurate for expiry-sensitive stock |

Stock valuation report:
```
Medicine Name       | In Stock | Avg Cost | Stock Value
Paracetamol 500mg   |    250   |   ₹2.10  |  ₹525.00
Amoxicillin 500mg   |     80   |   ₹5.40  |  ₹432.00
...
─────────────────────────────────────────────────────
Total Inventory Value:                     ₹1,23,450.00
```

---

### 10.8 Monthly Analytics Dashboard

```
Dashboard Cards (Shop Panel — Reports Tab):
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  This Month  │  │  Last Month  │  │ Outstanding  │  │ Stock Value  │
  │  ₹45,230     │  │  ₹38,760     │  │  ₹6,800 CR   │  │  ₹1,23,450  │
  │  Sales       │  │  Sales       │  │  (Credit)    │  │  Inventory   │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

Charts:
  - Monthly sales trend (12-month bar chart)
  - Payment method split (Cash/UPI/Card donut)
  - Top 20 medicines by revenue
  - Daily sales heatmap (calendar view)
  - Doctor-wise patient count (stacked bar)
  - Expense vs Income (area chart)

GST Reports:
  - GSTR-1 summary (outward supplies — sales)
  - GSTR-3B estimate (net tax payable)
  - HSN-wise sales summary
  (Export as Excel/CSV for CA/filing)
```

---

### 10.9 Cash vs Digital Payment Tracking

```
Payment ledger groups:
  CASH    → Physical currency received
  UPI     → GPay, PhonePe, Paytm (UPI ref number logged)
  CARD    → Debit/Credit card (POS terminal ref logged)
  CREDIT  → Udhar / credit sale (tracked separately)
  NEFT    → Bank transfer for supplier payments
  CHEQUE  → Cheque payments to/from suppliers

Daily closing:
  Expected cash at counter = Opening balance
                            + Cash sales today
                            − Cash expenses today
                            − Cash supplier payments today

  Shopkeeper enters actual cash in drawer → variance highlighted if mismatch
```

---

### 10.10 Accounting Module Table Summary

| Table | Purpose |
|---|---|
| `income_entries` | All income records (auto from bills + manual) |
| `expense_entries` | All expense records (manual entry) |
| `suppliers` | Supplier master (name, phone, address, GST) |
| `purchase_entries` | Stock received from supplier (header) |
| `purchase_items` | Line items of a purchase entry |
| `supplier_payments` | Payments made to suppliers |
| `credit_customers` | Credit customer master |
| `credit_transactions` | Credit given / repayment records |

> Full SQL for these tables is in [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) under the **Accounting Module** section.

---

## 11. Security & Compliance (India)

### 11.1 Legal & Regulatory

| Area | Requirement | Implementation |
|---|---|---|
| **DPDP Act 2023** | Digital Personal Data Protection Act — India's primary data law | Consent-based data collection, right to erasure, data processing agreement |
| **IT Act 2000 (amended)** | Secure sensitive personal data (health data = sensitive) | Encryption at rest and in transit, audit logs |
| **MCI / NMC Regulations** | Only registered doctors can issue prescriptions | MCI number verification, certificate upload, admin approval |
| **Drugs & Cosmetics Act** | Medical shops need valid drug license | Drug license number mandatory during shop registration |
| **GST Compliance** | Bills must have HSN codes for medicines | Auto-populate HSN codes from medicine master database |
| **Telemedicine Guidelines 2020 (MoHFW)** | Video consults must follow govt guidelines | Implement in Phase 3, follow MoHFW telemedicine protocol |

### 11.2 Data Security

```
Transport Security:
  - All APIs served over HTTPS (TLS 1.3)
  - Certificate pinning in mobile apps

Database Security:
  - Patient health data encrypted at rest (AES-256)
  - Role-based access: doctors see only their patients
  - No patient PII in API logs

Authentication:
  - OTP via SMS (no password, reduces phishing risk)
  - JWT access token (15 min expiry) + refresh token (30 days)
  - Token rotation on every refresh
  - Device fingerprinting to detect suspicious logins

Prescription Integrity:
  - Every prescription gets a unique signed QR code
  - QR contains prescription ID + HMAC signature
  - Shop scans QR to verify authenticity before billing

Access Control (RBAC):
  - Patient: cannot see other patients' data
  - Doctor: sees only patients booked at their chambers
  - Shop: sees prescriptions only when patient visits their shop
  - Admin: full read access, write only for approval actions

Audit Logging:
  - Every prescription creation, edit, and view is logged
  - Billing actions logged with staff ID
  - Logs retained for 7 years (medical record compliance)
```

### 11.3 Infrastructure Security

- AWS VPC with private subnets for database tier
- WAF (Web Application Firewall) on API gateway
- DDoS protection via CloudFlare
- Automated daily backups with point-in-time recovery (PostgreSQL)
- Dependency vulnerability scanning in CI/CD pipeline (npm audit, Snyk)
- Regular penetration testing (quarterly after launch)

### 11.4 Patient Trust Features

- Visible privacy policy in Hindi & English
- Data usage consent during onboarding (granular — appointment data, prescription data)
- Patient can delete account and all associated data (DPDP right to erasure)
- No ads inside the patient app; data never sold to third parties

---

## 12. Estimated Development Timeline

### Team Composition (Lean Startup)

| Role | Count |
|---|---|
| Full-stack Developer (Node.js + React Native) | 2 |
| Frontend Developer (React.js — Shop Web Panel) | 1 |
| UI/UX Designer | 1 |
| QA Engineer | 1 |
| Product Manager / Tech Lead | 1 |
| **Total** | **6 people** |

### Timeline Overview

```
Month 1   ├── Design & Architecture (Weeks 1–2)
          │     UI/UX wireframes, DB schema finalization, API design, repo setup
          │
          ├── Sprint 1: Auth + Profiles (Weeks 3–4)
          │     OTP login, patient/doctor/shop registration, admin approval flow
          │
Month 2   ├── Sprint 2: Doctor Chambers + Search (Weeks 5–6)
          │     Chamber linking, schedule management, doctor search API + UI
          │
          ├── Sprint 3: Appointments (Weeks 7–8)
          │     Booking flow, real-time queue (WebSocket), SMS confirmation
          │
Month 3   ├── Sprint 4: Prescriptions + Billing (Weeks 9–10)
          │     Prescription writing, PDF generation, bill generation, inventory basics
          │
          ├── Sprint 5: Polish + Testing (Weeks 11–12)
          │     Bug fixes, performance testing, security audit, Play Store submission
          │
Month 4   ├── BETA LAUNCH (controlled — 1 city, 20–30 shops)
          │     Field onboarding, feedback collection, quick fixes
          │
Month 5–6 ├── Phase 2 Features
          │     Medicine availability search, payment integration, sales reports,
          │     shop subscription billing, WhatsApp integration
          │
Month 7   ├── Full Public Launch (city-wide)
          │     Marketing, field agents, referral program for shops
          │
Month 8–12├── Scale & Phase 3
                Expand to 3–5 cities, telemedicine, multi-language, analytics
```

### Milestone Summary

| Milestone | Target Date | Deliverable |
|---|---|---|
| Wireframes complete | Week 2 | Figma screens for all 3 roles |
| Backend API v1 live | Week 8 | Auth, profiles, appointments, chambers |
| MVP app builds | Week 10 | Android APKs for all 3 roles |
| Beta launch | Month 4 | 20–30 shops in 1 city |
| Phase 2 complete | Month 6 | Full feature set, subscription billing live |
| 200 shops target | Month 9 | Revenue positive (₹1.6L/month) |
| 1,000 shops target | Month 18 | Expand to 5 districts |

---

---

## Appendix: Project File Structure

```
rxdesk/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── patients/
│   │   │   ├── doctors/
│   │   │   ├── shops/
│   │   │   ├── appointments/
│   │   │   ├── prescriptions/
│   │   │   ├── bills/
│   │   │   ├── medicines/
│   │   │   ├── inventory/
│   │   │   ├── notifications/
│   │   │   └── subscriptions/
│   │   ├── middleware/         # auth, RBAC, rate-limit, error handler
│   │   ├── utils/              # PDF generator, SMS sender, QR signer
│   │   └── config/             # DB, Redis, S3 config
│   └── prisma/                 # Prisma ORM schema & migrations
│
├── mobile/                     # React Native (Expo) — all 3 roles
│   ├── src/
│   │   ├── screens/
│   │   │   ├── patient/
│   │   │   ├── doctor/
│   │   │   └── shop/
│   │   ├── components/         # shared UI components
│   │   ├── navigation/         # role-based navigation stacks
│   │   ├── store/              # Zustand state management
│   │   ├── api/                # Axios API layer
│   │   └── utils/
│   └── assets/
│
├── web/                        # React.js — Shop web panel
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│
└── docs/                       # This documentation
    ├── SYSTEM_DESIGN.md        ← You are here
    ├── DATABASE_SCHEMA.md
    ├── API_ARCHITECTURE.md
    └── TECH_STACK.md
```

---

*RxDesk — Built for Bharat's local healthcare ecosystem.*
