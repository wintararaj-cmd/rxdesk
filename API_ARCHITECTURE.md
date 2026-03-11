# RxDesk — API Architecture
### REST API Design Reference (v1)

---

## Base URL & Versioning

```
Production:  https://api.rxdesk.in/api/v1
Staging:     https://staging-api.rxdesk.in/api/v1
Local:       http://localhost:3000/api/v1
```

---

## Authentication Strategy

```
All protected routes require:
  Header: Authorization: Bearer <access_token>

Token Types:
  access_token  → JWT, expires in 15 minutes
  refresh_token → Opaque token stored in Redis, expires in 30 days

RBAC Middleware checks:
  req.user.role must be in allowedRoles[] for each route
```

---

## Response Format (Standard)

```json
// Success
{
  "success": true,
  "data": { ... },
  "message": "Appointment booked successfully",
  "meta": {                         // only for paginated responses
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "SLOT_NOT_AVAILABLE",
    "message": "The selected time slot is no longer available.",
    "details": {}
  }
}
```

---

## API Modules

---

### `/auth` — Authentication

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/auth/otp/send` | Send OTP to phone number | Public |
| POST | `/auth/otp/verify` | Verify OTP, return tokens | Public |
| POST | `/auth/token/refresh` | Refresh access token | All |
| POST | `/auth/logout` | Invalidate refresh token | All |

```json
// POST /auth/otp/send
Request:  { "phone": "+919876543210" }
Response: { "success": true, "data": { "otp_ref": "abc123", "expires_in": 300 } }

// POST /auth/otp/verify
Request:  { "phone": "+919876543210", "otp": "482910", "otp_ref": "abc123" }
Response: {
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "d4f9...",
    "user": { "id": "uuid", "role": "patient", "is_profile_complete": false }
  }
}
```

---

### `/patients` — Patient Profile & History

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/patients/profile` | Create patient profile | patient |
| GET | `/patients/profile` | Get own profile | patient |
| PATCH | `/patients/profile` | Update profile | patient |
| GET | `/patients/:id/appointments` | List appointments (paginated) | patient, admin |
| GET | `/patients/:id/prescriptions` | List prescriptions | patient, admin |
| DELETE | `/patients/account` | Delete account (DPDP right) | patient |

---

### `/doctors` — Doctor Profile & Management

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/doctors/register` | Register doctor (with file upload) | doctor |
| GET | `/doctors/profile` | Get own profile | doctor |
| PATCH | `/doctors/profile` | Update profile | doctor |
| GET | `/doctors/search` | Search doctors (public) | Public |
| GET | `/doctors/:id` | Get doctor public profile | Public |
| GET | `/doctors/:id/chambers` | Get doctor's chambers with schedule | Public |
| GET | `/doctors/dashboard/stats` | Today's count, total patients | doctor |
| GET | `/doctors/dashboard/today` | Today's appointments | doctor |
| PATCH | `/doctors/availability` | Toggle available status | doctor |

```json
// GET /doctors/search?q=cardiologist&pincode=411001&page=1&limit=20
Response: {
  "data": [
    {
      "id": "uuid",
      "full_name": "Dr. Rajesh Kumar",
      "specialization": "General Physician",
      "experience_years": 12,
      "profile_photo": "https://...",
      "chambers": [
        {
          "shop_name": "Sharma Medical",
          "address": "Main Road, Nashik",
          "consultation_fee": 200,
          "next_available": "2024-01-15",
          "available_today": true
        }
      ]
    }
  ]
}
```

---

### `/shops` — Medical Shop Management

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/shops/register` | Register new shop | shop_owner |
| GET | `/shops/profile` | Get own shop profile | shop_owner |
| PATCH | `/shops/profile` | Update shop details | shop_owner |
| GET | `/shops/:id` | Public shop profile | Public |
| GET | `/shops/nearby?lat=&lng=&radius=5` | Shops within radius | Public |
| POST | `/shops/doctors/link-request` | Send link request to doctor | shop_owner |
| GET | `/shops/doctors` | List linked doctors | shop_owner |
| DELETE | `/shops/doctors/:chamberId` | Remove doctor from shop | shop_owner |
| GET | `/shops/dashboard/today` | Today's appointments + queue | shop_owner |

---

### `/chambers` — Doctor ↔ Shop Chamber Management

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/chambers` | Create chamber (doctor adds shop) | doctor |
| GET | `/chambers/:id` | Get chamber details | doctor, shop_owner |
| PATCH | `/chambers/:id` | Update chamber (fee, status) | doctor, shop_owner |
| DELETE | `/chambers/:id` | Deactivate chamber | doctor, shop_owner |
| POST | `/chambers/:id/schedule` | Set schedule for chamber | doctor |
| GET | `/chambers/:id/schedule` | Get schedule | doctor, shop_owner, public |
| PATCH | `/chambers/:id/schedule/:scheduleId` | Update a schedule slot | doctor |
| POST | `/chambers/:id/leave` | Mark leave dates | doctor |
| GET | `/chambers/:id/slots?date=YYYY-MM-DD` | Get available slots for date | Public |
| POST | `/chambers/:id/approve` | Approve link request | shop_owner |

```json
// GET /chambers/:id/slots?date=2024-01-15
Response: {
  "data": {
    "date": "2024-01-15",
    "day": "Monday",
    "doctor": "Dr. Rajesh Kumar",
    "shop": "Sharma Medical",
    "slots": [
      { "start": "09:00", "end": "09:15", "status": "available", "token": 1 },
      { "start": "09:15", "end": "09:30", "status": "booked", "token": 2 },
      { "start": "09:30", "end": "09:45", "status": "available", "token": 3 }
    ]
  }
}
```

---

### `/appointments` — Booking & Management

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/appointments` | Book appointment | patient |
| GET | `/appointments/:id` | Get appointment detail | patient, doctor, shop_owner |
| PATCH | `/appointments/:id/cancel` | Cancel appointment | patient, doctor, shop_owner |
| PATCH | `/appointments/:id/status` | Update status (arrived/completed) | shop_owner, doctor |
| GET | `/appointments/today` | Today's list (for doctor/shop) | doctor, shop_owner |
| POST | `/appointments/:id/checkin` | Mark patient arrived | shop_owner |
| GET | `/appointments/patient/history` | Patient's past appointments | patient |

```json
// POST /appointments
Request: {
  "chamber_id": "uuid",
  "appointment_date": "2024-01-15",
  "slot_start_time": "09:00",
  "chief_complaint": "Fever and cold"
}
Response: {
  "data": {
    "id": "uuid",
    "token_number": 5,
    "confirmation_code": "DN-2024-005",
    "appointment_date": "2024-01-15",
    "slot": "09:00 - 09:15",
    "doctor": "Dr. Rajesh Kumar",
    "shop": "Sharma Medical",
    "fee": 200
  }
}

// PATCH /appointments/:id/status
Request:  { "status": "arrived" }  // shop_owner marks patient arrived
          { "status": "completed" } // doctor marks consultation done
```

---

### `/prescriptions` — Prescription Lifecycle

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/prescriptions` | Issue prescription | doctor |
| GET | `/prescriptions/:id` | View prescription | patient, doctor, shop_owner |
| PATCH | `/prescriptions/:id` | Edit prescription (before dispensed) | doctor |
| GET | `/prescriptions/:id/pdf` | Download PDF (signed URL) | patient, doctor, shop_owner |
| GET | `/prescriptions/:id/verify` | Verify QR scan by shop | shop_owner |
| GET | `/prescriptions/patient/history` | Patient's all prescriptions | patient |

```json
// POST /prescriptions
Request: {
  "appointment_id": "uuid",
  "diagnosis": "Viral Upper Respiratory Tract Infection",
  "chief_complaint": "Fever, cold, body ache for 3 days",
  "vitals": { "bp": "120/80", "temp": "101.2F", "weight": "65kg" },
  "items": [
    {
      "medicine_id": "uuid",
      "medicine_name": "Paracetamol 500mg",
      "dosage": "1 tablet",
      "frequency": "1-1-1",
      "duration": "5 days",
      "instructions": "After food",
      "quantity": 15
    }
  ],
  "advice": "Rest, drink plenty of fluids",
  "follow_up_date": "2024-01-22"
}
```

---

### `/bills` — Billing at Shop

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/bills/from-prescription/:prescriptionId` | Auto-generate bill from prescription | shop_owner |
| GET | `/bills/:id` | View bill detail | patient, shop_owner |
| PATCH | `/bills/:id/items` | Edit bill items (before payment) | shop_owner |
| PATCH | `/bills/:id/payment` | Mark bill as paid | shop_owner |
| GET | `/bills/:id/pdf` | Download bill PDF | patient, shop_owner |
| GET | `/bills/shop/history` | Shop's billing history (paginated) | shop_owner |
| GET | `/bills/patient/history` | Patient's bill history | patient |

---

### `/medicines` — Medicine Search & Availability

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/medicines/search?q=paracetamol` | Search medicine master DB | All |
| GET | `/medicines/:id` | Get medicine detail | All |
| GET | `/medicines/availability?name=&pincode=` | Which shops have this medicine | Public |

```json
// GET /medicines/availability?name=Crocin+500&pincode=411001
Response: {
  "data": [
    {
      "shop_name": "Sharma Medical",
      "address": "Main Road, Nashik",
      "distance_km": 0.8,
      "contact": "+919999999999",
      "stock_qty": 45,
      "mrp": 32.50
    }
  ]
}
```

---

### `/inventory` — Shop Inventory Management

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/inventory` | List shop's inventory | shop_owner |
| POST | `/inventory` | Add medicine to inventory | shop_owner |
| PATCH | `/inventory/:id` | Update stock / price | shop_owner |
| DELETE | `/inventory/:id` | Remove medicine | shop_owner |
| GET | `/inventory/low-stock` | Items below reorder_level | shop_owner |
| POST | `/inventory/bulk-import` | CSV import of medicines | shop_owner |

---

### `/notifications` — Notification Management

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/notifications` | List user notifications | All |
| PATCH | `/notifications/:id/read` | Mark as read | All |
| PATCH | `/notifications/read-all` | Mark all as read | All |
| POST | `/notifications/test-sms` | Test SMS (admin only) | admin |

---

### `/subscriptions` — Shop Subscription Plans

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/subscriptions/plans` | List all plans | Public |
| GET | `/subscriptions/current` | Current shop subscription | shop_owner |
| POST | `/subscriptions/checkout` | Create Razorpay subscription order | shop_owner |
| POST | `/subscriptions/webhook` | Razorpay payment webhook | System |
| POST | `/subscriptions/cancel` | Cancel subscription | shop_owner |

---

### `/admin` — Admin Operations

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/admin/doctors/pending` | Doctors pending verification | admin |
| PATCH | `/admin/doctors/:id/verify` | Approve / reject doctor | admin |
| GET | `/admin/shops/pending` | Shops pending verification | admin |
| PATCH | `/admin/shops/:id/verify` | Approve / reject shop | admin |
| GET | `/admin/analytics` | Platform-wide usage stats | admin |
| GET | `/admin/users` | List all users | admin |

---

### `/accounting` — Shop Accounting & Finance

All endpoints require `shop_owner` role (scoped to the authenticated shop).

#### Suppliers

| Method | Endpoint | Description |
|---|---|---|
| GET | `/accounting/suppliers` | List all suppliers |
| POST | `/accounting/suppliers` | Add new supplier |
| GET | `/accounting/suppliers/:id` | Supplier detail + outstanding balance |
| PATCH | `/accounting/suppliers/:id` | Update supplier info |
| DELETE | `/accounting/suppliers/:id` | Deactivate supplier |
| GET | `/accounting/suppliers/:id/ledger` | Full payment history for supplier |

#### Purchase Entries (Stock In)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/accounting/purchases` | List purchase entries (paginated, filter by date/supplier) |
| POST | `/accounting/purchases` | Create purchase entry (increments inventory) |
| GET | `/accounting/purchases/:id` | Purchase detail with items |
| PATCH | `/accounting/purchases/:id` | Edit purchase (only if payment_status=unpaid) |
| DELETE | `/accounting/purchases/:id` | Delete purchase (reverses stock, only if unpaid) |

```json
// POST /accounting/purchases
Request: {
  "supplier_id": "uuid",
  "invoice_number": "SUP-2026-4421",
  "invoice_date": "2026-03-05",
  "received_date": "2026-03-06",
  "items": [
    {
      "medicine_id": "uuid",
      "medicine_name": "Paracetamol 500mg",
      "batch_number": "B2245",
      "expiry_date": "2027-12-31",
      "quantity": 500,
      "free_qty": 50,
      "purchase_price": 2.10,
      "mrp": 3.20,
      "discount_pct": 5,
      "gst_rate": 12
    }
  ],
  "notes": "Monthly restock"
}
Response: {
  "data": {
    "purchase_id": "uuid",
    "total_amount": 1155.00,
    "inventory_updated": true,
    "expense_entry_created": "uuid"
  }
}
```

#### Supplier Payments

| Method | Endpoint | Description |
|---|---|---|
| POST | `/accounting/supplier-payments` | Record payment to supplier |
| GET | `/accounting/supplier-payments` | List payments (filter by supplier/date) |

```json
// POST /accounting/supplier-payments
Request: {
  "supplier_id": "uuid",
  "purchase_id": "uuid",      // optional — can be advance
  "amount": 1155.00,
  "payment_method": "upi",
  "payment_date": "2026-03-06",
  "reference_no": "UTR123456789012"
}
```

#### Expenses

| Method | Endpoint | Description |
|---|---|---|
| GET | `/accounting/expenses` | List expenses (filter by category/date range) |
| POST | `/accounting/expenses` | Log a new expense |
| PATCH | `/accounting/expenses/:id` | Edit expense entry |
| DELETE | `/accounting/expenses/:id` | Delete expense entry |

```json
// POST /accounting/expenses
Request: {
  "category": "rent",
  "description": "March 2026 shop rent",
  "amount": 8000,
  "payment_method": "cash",
  "entry_date": "2026-03-01"
}
```

#### Income

| Method | Endpoint | Description |
|---|---|---|
| GET | `/accounting/income` | List income entries (auto + manual) |
| POST | `/accounting/income` | Log manual income entry |

#### Credit Customers

| Method | Endpoint | Description |
|---|---|---|
| GET | `/accounting/credit-customers` | List credit customers with outstanding |
| POST | `/accounting/credit-customers` | Add credit customer |
| GET | `/accounting/credit-customers/:id` | Customer detail + full credit ledger |
| POST | `/accounting/credit-customers/:id/payment` | Record repayment from customer |

```json
// GET /accounting/credit-customers
Response: {
  "data": [
    {
      "id": "uuid",
      "name": "Ramesh Gupta",
      "phone": "+919988776655",
      "total_outstanding": 1250.00,
      "last_transaction_date": "2026-02-28",
      "overdue": true   // outstanding > 30 days
    }
  ],
  "summary": {
    "total_customers": 12,
    "total_outstanding": 18450.00
  }
}
```

#### Reports & Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/accounting/reports/pl?from=&to=` | Profit & Loss statement for date range |
| GET | `/accounting/reports/sales-summary?month=&year=` | Monthly sales breakdown |
| GET | `/accounting/reports/stock-valuation` | Current inventory valuation |
| GET | `/accounting/reports/gst-summary?month=&year=` | GST summary (GSTR-1 / 3B) |
| GET | `/accounting/reports/cash-register?date=` | Daily cash register for a date |
| POST | `/accounting/reports/cash-register/close` | Submit end-of-day cash count |
| GET | `/accounting/reports/payment-split?from=&to=` | Cash vs UPI vs Card breakdown |
| GET | `/accounting/reports/top-medicines?month=&year=` | Top medicines by revenue/qty |

```json
// GET /accounting/reports/pl?from=2026-03-01&to=2026-03-31
Response: {
  "data": {
    "period": { "from": "2026-03-01", "to": "2026-03-31" },
    "revenue": {
      "sales_income": 85430.00,
      "other_income": 500.00,
      "total": 85930.00
    },
    "cogs": {
      "medicine_purchase_cost": 52100.00
    },
    "gross_profit": 33830.00,
    "gross_margin_pct": 39.4,
    "expenses": {
      "rent": 8000.00,
      "salary": 12000.00,
      "utilities": 1200.00,
      "miscellaneous": 800.00,
      "total": 22000.00
    },
    "net_profit": 11830.00,
    "net_margin_pct": 13.8
  }
}

// GET /accounting/reports/gst-summary?month=3&year=2026
Response: {
  "data": {
    "outward_supplies": {
      "taxable_value": 74850.00,
      "gst_collected": { "cgst": 4491.00, "sgst": 4491.00, "igst": 0 },
      "total_gst_collected": 8982.00
    },
    "inward_supplies": {
      "taxable_value": 46500.00,
      "itc_available": { "cgst": 2790.00, "sgst": 2790.00 },
      "total_itc": 5580.00
    },
    "net_tax_payable": 3402.00,
    "hsn_summary": [
      { "hsn": "3004", "gst_rate": 12, "taxable": 51200.00, "gst": 6144.00 },
      { "hsn": "3004", "gst_rate": 5,  "taxable": 23650.00, "gst": 1182.50 }
    ]
  }
}
```

---

## WebSocket Events (Real-time Appointment Queue)

**Connection:** `wss://api.rxdesk.in/ws?token=<access_token>`

```json
// Server → Client (shop panel listens)
{ "event": "appointment.booked",  "data": { "appointment": {...} } }
{ "event": "appointment.cancelled", "data": { "appointment_id": "uuid" } }
{ "event": "appointment.status_changed", "data": { "id":"uuid", "status":"arrived" } }
{ "event": "prescription.issued", "data": { "prescription": {...} } }
{ "event": "stock.low",           "data": { "medicine": "...", "qty": 3 } }

// Client → Server
{ "event": "join_shop", "data": { "shop_id": "uuid" } }
{ "event": "join_chamber", "data": { "chamber_id": "uuid" } }
```

---

## Rate Limiting

| Category | Limit |
|---|---|
| OTP send | 3 requests / 10 minutes / phone |
| Authenticated API | 200 requests / minute / user |
| Search endpoints | 60 requests / minute / IP |
| PDF generation | 10 requests / minute / user |
| Admin endpoints | 500 requests / minute |

---

## Error Codes Reference

| Code | HTTP | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Role not allowed for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `SLOT_NOT_AVAILABLE` | 409 | Appointment slot already taken |
| `DOCTOR_ON_LEAVE` | 409 | Doctor marked unavailable on selected date |
| `PRESCRIPTION_DISPENSED` | 409 | Prescription already billed, cannot edit |
| `SHOP_NOT_VERIFIED` | 403 | Shop pending admin verification |
| `DOCTOR_NOT_VERIFIED` | 403 | Doctor pending admin verification |
| `SUBSCRIPTION_LIMIT` | 402 | Shop has reached plan limit |
| `OTP_EXPIRED` | 400 | OTP has expired (5 min window) |
| `OTP_INVALID` | 400 | Wrong OTP entered |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 422 | Request body validation failed |
| `SERVER_ERROR` | 500 | Internal server error |
