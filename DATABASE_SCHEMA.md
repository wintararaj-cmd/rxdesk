# RxDesk — Database Schema
### PostgreSQL Relational Schema with Prisma ORM notation

---

## Entity Relationship Overview

```
users ──────────────┬──► patients
                    ├──► doctors
                    └──► shop_owners

doctors ◄───────────────► medical_shops   (via doctor_chambers)

appointments ──────────► doctor_chambers
appointments ──────────► patients

prescriptions ─────────► appointments
prescription_items ────► prescriptions
prescription_items ────► medicines

bills ─────────────────► prescriptions
bills ─────────────────► medical_shops
bill_items ────────────► bills
bill_items ────────────► shop_inventory

shop_inventory ────────► medical_shops
shop_inventory ────────► medicines

subscriptions ─────────► medical_shops
notifications ─────────► users
```

---

## Table Definitions

### 1. `users` — Base authentication table

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(13) UNIQUE NOT NULL,   -- +91XXXXXXXXXX
  role          ENUM('patient','doctor','shop_owner','admin') NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  is_verified   BOOLEAN DEFAULT false,          -- admin-verified for doctors/shops
  fcm_token     TEXT,                           -- Firebase push token
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

---

### 2. `patients` — Patient profile

```sql
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(100) NOT NULL,
  age             INTEGER,
  gender          ENUM('male','female','other'),
  date_of_birth   DATE,
  blood_group     VARCHAR(5),                   -- A+, B-, O+, etc.
  address_line    TEXT,
  city            VARCHAR(100),
  pin_code        VARCHAR(6),
  state           VARCHAR(100),
  emergency_contact VARCHAR(13),
  profile_photo   TEXT,                         -- S3 URL
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

### 3. `doctors` — Doctor profile

```sql
CREATE TABLE doctors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name           VARCHAR(100) NOT NULL,
  mci_number          VARCHAR(50) UNIQUE NOT NULL,  -- Medical Council of India reg no.
  specialization      VARCHAR(100),                  -- MBBS, MD, Cardiologist, etc.
  qualifications      TEXT[],                        -- ['MBBS', 'MD Medicine']
  experience_years    INTEGER DEFAULT 0,
  profile_photo       TEXT,                          -- S3 URL
  degree_cert_url     TEXT,                          -- S3 URL (uploaded during registration)
  id_proof_url        TEXT,                          -- S3 URL
  gender              ENUM('male','female','other'),
  languages           TEXT[],                        -- ['Hindi', 'English', 'Marathi']
  verification_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  rejection_reason    TEXT,
  verified_by         UUID REFERENCES users(id),     -- admin who approved
  verified_at         TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

---

### 4. `medical_shops` — Shop / Clinic profile

```sql
CREATE TABLE medical_shops (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  shop_name         VARCHAR(150) NOT NULL,
  shop_type         ENUM('medical_shop','clinic','pharmacy','dispensary') DEFAULT 'medical_shop',
  gst_number        VARCHAR(15),
  drug_license_no   VARCHAR(50) NOT NULL,
  drug_license_url  TEXT,                       -- S3 URL
  address_line      TEXT NOT NULL,
  city              VARCHAR(100) NOT NULL,
  district          VARCHAR(100),
  state             VARCHAR(100) NOT NULL,
  pin_code          VARCHAR(6) NOT NULL,
  latitude          DECIMAL(10, 8),
  longitude         DECIMAL(11, 8),
  contact_phone     VARCHAR(13) NOT NULL,
  contact_email     VARCHAR(255),
  opening_time      TIME,
  closing_time      TIME,
  working_days      TEXT[],                     -- ['Mon','Tue','Wed','Thu','Fri','Sat']
  is_active         BOOLEAN DEFAULT true,
  verification_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Spatial index for nearby search
CREATE INDEX idx_shops_location ON medical_shops USING GIST (
  ll_to_earth(latitude, longitude)
);
CREATE INDEX idx_shops_pincode ON medical_shops(pin_code);
```

---

### 5. `doctor_chambers` — Doctor ↔ Shop many-to-many with schedule

```sql
CREATE TABLE doctor_chambers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         UUID REFERENCES doctors(id) ON DELETE CASCADE,
  shop_id           UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  consultation_fee  DECIMAL(10,2) DEFAULT 0,
  status            ENUM('pending','active','inactive') DEFAULT 'pending',
  -- Doctor requests, shop approves (or vice versa)
  requested_by      ENUM('doctor','shop'),
  approved_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(doctor_id, shop_id)
);

-- Doctor schedule per chamber
CREATE TABLE chamber_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamber_id      UUID REFERENCES doctor_chambers(id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL,            -- 0=Sun, 1=Mon ... 6=Sat
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  slot_duration   SMALLINT DEFAULT 15,          -- minutes per patient
  max_patients    SMALLINT DEFAULT 20,
  is_active       BOOLEAN DEFAULT true
);

-- Doctor leave / block dates
CREATE TABLE chamber_leaves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamber_id  UUID REFERENCES doctor_chambers(id) ON DELETE CASCADE,
  leave_date  DATE NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

### 6. `appointments`

```sql
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id) ON DELETE RESTRICT,
  chamber_id      UUID REFERENCES doctor_chambers(id) ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  slot_start_time  TIME NOT NULL,
  slot_end_time    TIME NOT NULL,
  token_number    SMALLINT,                     -- queue token (1, 2, 3...)
  chief_complaint TEXT,                         -- optional, filled by patient
  status          ENUM('booked','confirmed','arrived','in_consultation',
                       'completed','cancelled','no_show') DEFAULT 'booked',
  cancelled_by    ENUM('patient','doctor','shop'),
  cancel_reason   TEXT,
  reminder_sent   BOOLEAN DEFAULT false,
  payment_status  ENUM('pending','paid','not_required') DEFAULT 'not_required',
  payment_amount  DECIMAL(10,2),
  payment_ref     VARCHAR(100),                 -- Razorpay payment ID
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_chamber_date ON appointments(chamber_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
```

---

### 7. `prescriptions`

```sql
CREATE TABLE prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID UNIQUE REFERENCES appointments(id) ON DELETE RESTRICT,
  doctor_id       UUID REFERENCES doctors(id),
  patient_id      UUID REFERENCES patients(id),
  shop_id         UUID REFERENCES medical_shops(id),
  diagnosis       TEXT,
  chief_complaint TEXT,
  vitals          JSONB,                        -- {"bp": "120/80", "weight": "65kg", "temp": "98.6F"}
  advice          TEXT,
  follow_up_date  DATE,
  is_valid        BOOLEAN DEFAULT true,         -- invalidated if suspected misuse
  dispensed       BOOLEAN DEFAULT false,        -- true once shop generates bill
  qr_code_hash    VARCHAR(255),                 -- HMAC signed QR code content
  pdf_url         TEXT,                         -- S3 URL of generated PDF
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

### 8. `prescription_items`

```sql
CREATE TABLE prescription_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id     UUID REFERENCES medicines(id),
  medicine_name   VARCHAR(200) NOT NULL,        -- store name even if medicine is deleted
  dosage          VARCHAR(100),                 -- "500mg", "1 tablet"
  frequency       VARCHAR(100),                 -- "1-0-1", "Twice daily", "SOS"
  duration        VARCHAR(100),                 -- "5 days", "1 week"
  instructions    TEXT,                         -- "Take after food", "With warm water"
  quantity        SMALLINT,                     -- total tablets/units to dispense
  sort_order      SMALLINT DEFAULT 0
);
```

---

### 9. `medicines` — Master medicine database

```sql
CREATE TABLE medicines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,        -- "Paracetamol 500mg"
  generic_name    VARCHAR(200),                 -- "Acetaminophen"
  brand_name      VARCHAR(200),                 -- "Crocin", "Dolo"
  form            ENUM('tablet','capsule','syrup','injection',
                       'ointment','drops','inhaler','powder','other'),
  strength        VARCHAR(50),                  -- "500mg", "5ml/5ml"
  manufacturer    VARCHAR(200),
  hsn_code        VARCHAR(10),                  -- GST HSN code for billing
  gst_rate        DECIMAL(5,2) DEFAULT 12.0,    -- GST percentage
  is_schedule_h   BOOLEAN DEFAULT false,        -- Prescription-only drug
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_medicines_name ON medicines USING GIN(to_tsvector('english', name));
CREATE INDEX idx_medicines_generic ON medicines(generic_name);
```

---

### 10. `shop_inventory`

```sql
CREATE TABLE shop_inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  medicine_id     UUID REFERENCES medicines(id),
  medicine_name   VARCHAR(200) NOT NULL,        -- for custom/unlisted medicines
  batch_number    VARCHAR(50),
  expiry_date     DATE,
  mrp             DECIMAL(10,2) NOT NULL,
  purchase_price  DECIMAL(10,2),
  stock_qty       INTEGER DEFAULT 0,
  reorder_level   INTEGER DEFAULT 10,           -- alert threshold
  unit            VARCHAR(20) DEFAULT 'strip',  -- strip, bottle, vial
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, medicine_id, batch_number)
);

CREATE INDEX idx_inventory_shop ON shop_inventory(shop_id);
CREATE INDEX idx_inventory_medicine ON shop_inventory(medicine_id);
```

---

### 11. `bills`

```sql
CREATE TABLE bills (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id   UUID REFERENCES prescriptions(id),
  shop_id           UUID REFERENCES medical_shops(id),
  patient_id        UUID REFERENCES patients(id),
  bill_number       VARCHAR(50) UNIQUE NOT NULL,  -- auto-generated: DOC-2024-001234
  subtotal          DECIMAL(12,2) NOT NULL,
  discount_amount   DECIMAL(12,2) DEFAULT 0,
  gst_amount        DECIMAL(12,2) DEFAULT 0,
  total_amount      DECIMAL(12,2) NOT NULL,
  payment_method    ENUM('cash','upi','card','credit') DEFAULT 'cash',
  payment_status    ENUM('paid','pending','partial') DEFAULT 'pending',
  staff_id          UUID REFERENCES users(id),    -- shop staff who generated bill
  pdf_url           TEXT,                          -- S3 URL
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

---

### 12. `bill_items`

```sql
CREATE TABLE bill_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id         UUID REFERENCES bills(id) ON DELETE CASCADE,
  inventory_id    UUID REFERENCES shop_inventory(id),
  medicine_name   VARCHAR(200) NOT NULL,
  batch_number    VARCHAR(50),
  expiry_date     DATE,
  mrp             DECIMAL(10,2) NOT NULL,
  quantity        SMALLINT NOT NULL,
  discount_pct    DECIMAL(5,2) DEFAULT 0,
  gst_rate        DECIMAL(5,2) DEFAULT 12.0,
  line_total      DECIMAL(12,2) NOT NULL
);
```

---

### 13. `subscriptions` — Shop subscription plans

```sql
CREATE TABLE subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(50) NOT NULL,          -- Basic, Standard, Premium
  price_monthly DECIMAL(10,2) NOT NULL,
  max_doctors   SMALLINT DEFAULT 1,
  max_appointments_per_month INTEGER DEFAULT 50,
  features      JSONB,                         -- {"whatsapp": false, "analytics": true}
  is_active     BOOLEAN DEFAULT true
);

CREATE TABLE shop_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES subscription_plans(id),
  status          ENUM('trial','active','expired','cancelled') DEFAULT 'trial',
  trial_ends_at   TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end   TIMESTAMP,
  razorpay_sub_id VARCHAR(100),               -- Razorpay subscription ID
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

### 14. `notifications`

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  type            ENUM('sms','push','whatsapp'),
  category        ENUM('appointment_reminder','appointment_confirmed',
                       'prescription_ready','bill_generated',
                       'stock_alert','subscription_expiry','general'),
  title           VARCHAR(200),
  body            TEXT NOT NULL,
  reference_id    UUID,                        -- appointment_id / prescription_id etc.
  reference_type  VARCHAR(50),
  is_read         BOOLEAN DEFAULT false,
  sent_at         TIMESTAMP,
  status          ENUM('pending','sent','failed') DEFAULT 'pending',
  provider_ref    VARCHAR(200),               -- MSG91 message ID
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

---

### 15. `audit_logs`

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,          -- 'prescription.create', 'bill.generate'
  resource    VARCHAR(100),                   -- 'prescription'
  resource_id UUID,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  old_data    JSONB,
  new_data    JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource, resource_id);
```

---

## Indexing & Performance Strategy

```sql
-- Full-text search on doctor names and specializations
CREATE INDEX idx_doctors_search ON doctors 
  USING GIN(to_tsvector('english', full_name || ' ' || COALESCE(specialization,'')));

-- Appointment queue lookup (most frequent query for shop panel)
CREATE INDEX idx_appt_status_date ON appointments(chamber_id, appointment_date, status);

-- Medicine availability search across shops
CREATE INDEX idx_inventory_available ON shop_inventory(medicine_id, shop_id) 
  WHERE stock_qty > 0;
```

---

## Seed Data Requirements

- `subscription_plans`: 3 rows (Basic/Standard/Premium)
- `medicines`: ~5,000 common Indian medicines (migrated from public sources or manual)
- Admin `users` record for operations team

---

## Accounting Module Tables

### 16. `suppliers` — Medicine supplier master

```sql
CREATE TABLE suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  contact_person  VARCHAR(100),
  phone           VARCHAR(13),
  email           VARCHAR(255),
  address         TEXT,
  gst_number      VARCHAR(15),
  drug_license_no VARCHAR(50),
  bank_name       VARCHAR(100),
  bank_account    VARCHAR(30),
  bank_ifsc       VARCHAR(11),
  credit_limit    DECIMAL(12,2) DEFAULT 0,         -- max credit extended by supplier
  payment_terms   VARCHAR(100),                    -- "30 days", "COD", "weekly"
  is_active       BOOLEAN DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

### 17. `purchase_entries` — Stock received from supplier (header)

```sql
CREATE TABLE purchase_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  supplier_id       UUID REFERENCES suppliers(id),
  invoice_number    VARCHAR(100),                  -- supplier's invoice no.
  invoice_date      DATE NOT NULL,
  received_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal          DECIMAL(12,2) NOT NULL,
  discount_amount   DECIMAL(12,2) DEFAULT 0,
  gst_amount        DECIMAL(12,2) DEFAULT 0,
  total_amount      DECIMAL(12,2) NOT NULL,
  payment_status    ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  amount_paid       DECIMAL(12,2) DEFAULT 0,
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_purchase_shop ON purchase_entries(shop_id, invoice_date);
```

---

### 18. `purchase_items` — Line items of a purchase entry

```sql
CREATE TABLE purchase_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id       UUID REFERENCES purchase_entries(id) ON DELETE CASCADE,
  medicine_id       UUID REFERENCES medicines(id),
  medicine_name     VARCHAR(200) NOT NULL,
  batch_number      VARCHAR(50) NOT NULL,
  expiry_date       DATE NOT NULL,
  quantity          INTEGER NOT NULL,
  free_qty          INTEGER DEFAULT 0,             -- bonus free units from supplier
  purchase_price    DECIMAL(10,2) NOT NULL,        -- price per unit (excl. GST)
  mrp               DECIMAL(10,2) NOT NULL,
  discount_pct      DECIMAL(5,2) DEFAULT 0,
  gst_rate          DECIMAL(5,2) DEFAULT 12.0,
  line_total        DECIMAL(12,2) NOT NULL
  -- After insert: trigger increments shop_inventory.stock_qty
);
```

---

### 19. `supplier_payments` — Payments made to suppliers

```sql
CREATE TABLE supplier_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES suppliers(id),
  purchase_id     UUID REFERENCES purchase_entries(id),  -- optional, can be advance
  amount          DECIMAL(12,2) NOT NULL,
  payment_method  ENUM('cash','upi','neft','cheque','card') DEFAULT 'cash',
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_no    VARCHAR(100),                    -- UTR / cheque no. / transaction ID
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);
```

---

### 20. `income_entries` — All shop income records

```sql
CREATE TABLE income_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  entry_type      ENUM('sale_income','consultation_fee_collection',
                       'misc_income','refund_reversal') NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  payment_method  ENUM('cash','upi','card','credit','neft') DEFAULT 'cash',
  reference_bill_id UUID REFERENCES bills(id),    -- auto-linked when bill is paid
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_income_shop_date ON income_entries(shop_id, entry_date);
```

---

### 21. `expense_entries` — All shop expense records

```sql
CREATE TABLE expense_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  category        ENUM('medicine_purchase','rent','salary','utilities',
                       'transport','maintenance','miscellaneous') NOT NULL,
  description     VARCHAR(255),
  amount          DECIMAL(12,2) NOT NULL,
  payment_method  ENUM('cash','upi','neft','cheque','card') DEFAULT 'cash',
  reference_no    VARCHAR(100),
  linked_purchase_id UUID REFERENCES purchase_entries(id),  -- if category = medicine_purchase
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url     TEXT,                            -- S3 URL of uploaded receipt photo
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_shop_date ON expense_entries(shop_id, entry_date);
CREATE INDEX idx_expense_category ON expense_entries(shop_id, category);
```

---

### 22. `credit_customers` — Credit (udhar) customer master

```sql
CREATE TABLE credit_customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id),   -- null if walk-in not on app
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(13),
  address         TEXT,
  credit_limit    DECIMAL(10,2) DEFAULT 0,         -- 0 = no limit
  total_outstanding DECIMAL(12,2) DEFAULT 0,       -- computed / cached
  is_active       BOOLEAN DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_cust_shop ON credit_customers(shop_id);
```

---

### 23. `credit_transactions` — Credit given / repayment records

```sql
CREATE TABLE credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES credit_customers(id) ON DELETE CASCADE,
  shop_id         UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  type            ENUM('credit_given','payment_received') NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  bill_id         UUID REFERENCES bills(id),       -- for credit_given entries
  payment_method  ENUM('cash','upi','card','neft') DEFAULT 'cash',
  reference_no    VARCHAR(100),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_txn_customer ON credit_transactions(customer_id, transaction_date);
```

---

### 24. `daily_cash_register` — End-of-day cash reconciliation

```sql
CREATE TABLE daily_cash_register (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID REFERENCES medical_shops(id) ON DELETE CASCADE,
  register_date         DATE NOT NULL,
  opening_balance       DECIMAL(12,2) DEFAULT 0,
  cash_sales_total      DECIMAL(12,2) DEFAULT 0,   -- from income_entries
  cash_expenses_total   DECIMAL(12,2) DEFAULT 0,   -- from expense_entries (cash only)
  cash_supplier_paid    DECIMAL(12,2) DEFAULT 0,   -- from supplier_payments (cash)
  expected_closing_bal  DECIMAL(12,2),             -- computed
  actual_closing_bal    DECIMAL(12,2),             -- entered by shopkeeper
  variance              DECIMAL(12,2),             -- actual − expected
  closed_by             UUID REFERENCES users(id),
  closed_at             TIMESTAMP,
  notes                 TEXT,
  UNIQUE(shop_id, register_date)
);
```

---

## Extended Entity Relationship (Accounting)

```
medical_shops ──────────┬──► income_entries
                         ├──► expense_entries
                         ├──► suppliers ──────────► purchase_entries ──► purchase_items
                         │                                    └──────────► supplier_payments
                         ├──► credit_customers ──► credit_transactions
                         └──► daily_cash_register

bills ──────────────────────► income_entries  (auto on payment)
purchase_entries ───────────► shop_inventory  (stock increment trigger)
purchase_entries ───────────► expense_entries (auto expense creation)
```
