# RxDesk — Medical Shop User Manual
**Comprehensive Guide to Pharmacy Management & Accounting**

---

## 1. Overview
RxDesk is an all-in-one pharmacy management platform designed to digitize your medical shop's entire workflow — from appointment booking and digital prescriptions to GST billing, inventory, and full-scale accounting.

## 2. Financial Center (Accounting)
The **Financial Center** is your command hub for all monetary transactions. Access it via the **Accounting** link in your sidebar.

### 2.1 Supplier Management
*   **Adding Suppliers**: Go to the **Suppliers** tab to add new distributors. Include GST numbers and bank details for faster reconciliation.
*   **Supplier Ledger**: Click on any supplier to view their full transaction history (purchases vs. payments).

### 2.2 Purchase Invoices
*   **Recording Purchases**: Use the **Purchases** tab to log new stock arrivals. You can add multiple medicine line items with batch numbers and expiry dates.
*   **Inventory Integration**: Every purchase entry automatically updates your shop's stock levels.
*   **Quick Payments (New ✨)**:
    1.  Click on any purchase in the list to open the **Purchase Detail** modal.
    2.  If there is a balance due, a **Quick Payment** section will appear on the left.
    3.  Click **Record Payment**, enter the amount, select the method (Cash/UPI/Card), and confirm.
    4.  Your supplier ledger and shop balance will update instantly.

### 2.3 Outstandings & Credit Customers
*   **Monitor Receivables**: The **Outstandings** tab shows you exactly who owes you money (Patients/Credit Customers) and who you owe money to (Suppliers).
*   **Settling Accounts**: Click a customer row to view their ledger. You can record partial or full repayments directly from this screen.
*   **WhatsApp Reminders**: Use the "Send WhatsApp Report" button to instantly share a balance summary with your customers.

### 2.4 Expense Tracking
*   **Log Expenses**: Categorize your spending (Rent, Salary, Utilities, etc.) in the **Expenses** tab.
*   **Linked Purchases**: Expenses for medicine purchases are automatically linked to their respective invoices.

### 2.5 Financial Reports
*   **P&L (Profit & Loss)**: View your gross and net margins over any date range.
*   **GST Summary**: Access rate-wise breakdown of GSTR-1 (Sales) and ITC (Purchases) for easy tax filing.
*   **Cashbook & Bankbook**: Track every rupee moving in and out of your physical cash counter and bank accounts.

---

## 3. Automated Daily Backup (New ✨)
Ensure your business data is always safe with our new automated local backup system.

### 3.1 Configuring Auto-Backup
To set up your automated backup schedule:
1.  Navigate to the **Settings** tab within the Financial Center.
2.  Switch the **Enable Daily Auto-Backup** toggle to **ON**.
3.  Select an **Execution Time** (e.g., `22:00` for a nightly backup after shop closing).
4.  Specify a **Backup Destination Path** (e.g., `D:\MyBackups` or `/rxdesk`).
5.  Click **Apply Settings**.

### 3.2 How it Works
*   **Local Storage**: Every day at your chosen time, the system exports all accounting data (Suppliers, Purchases, Expenses, etc.) to your local drive.
*   **Location**: Backups are stored in the folder you specified. If you enter an absolute path like `D:\Backups`, the system will create a shop-specific subfolder there.
*   **Rotation**: To save disk space, the system automatically keeps only the **top 3 most recent backups**. Older backups are automatically pruned.
*   **Manual Backup**: You can still trigger a manual download at any time if needed.

---

## 4. Billing & Inventory
*   **Prescription Billing**: If a doctor uses RxDesk, their prescription will automatically appear in your Billing screen. Simply scan or select it to generate a final bill.
*   **Stock Alerts**: The dashboard will highlight "Low Stock" items based on the reorder levels you set in your inventory settings.

---

## 5. Support & Troubleshooting
If you encounter any issues or need custom feature requests:
*   **Email**: support@rxdesk.in
*   **Phone**: +91-XXXXXXXXXX
*   **Admin Panel**: Use the Help Desk icon in your top navigation bar.
