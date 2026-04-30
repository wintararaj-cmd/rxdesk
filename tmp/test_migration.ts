import axios from 'axios';

// --- CONFIGURATION ---
const API_BASE = 'http://localhost:3001/api';
const TOKEN = 'YOUR_BEARER_TOKEN_HERE'; // Replace with a valid shop owner token

const api = axios.create({
  baseURL: API_BASE,
  headers: { Authorization: `Bearer ${TOKEN}` },
});

async function testMigration() {
  try {
    console.log('--- Testing Data Migration ---');

    // 1. Bulk Import Stocks
    console.log('\n[1/3] Importing Stocks...');
    const inventoryRes = await api.post('/inventory/import', {
      items: [
        { medicine_name: 'Paracetamol 500mg', mrp: 40, stock_qty: 100, batch_number: 'B123', expiry_date: '2027-12-31' },
        { medicine_name: 'Amoxicillin 250mg Cop', mrp: 120, stock_qty: 50, batch_number: 'AMX45', expiry_date: '2026-06-30' },
      ],
    });
    console.log('Result:', inventoryRes.data.message || inventoryRes.data.data);

    // 2. Import Suppliers with Opening Balances
    console.log('\n[2/3] Importing Suppliers...');
    const supplierRes = await api.post('/accounting/suppliers/import', {
      items: [
        { name: 'Global Pharma Distributors', phone: '9876543210', opening_balance: 15000 },
        { name: 'Local Medicose', opening_balance: 5500 },
      ],
    });
    console.log('Result:', supplierRes.data.message);

    // 3. Import Credit Customers with Opening Balances
    console.log('\n[3/3] Importing Credit Customers...');
    const customerRes = await api.post('/accounting/credit-customers/import', {
      items: [
        { name: 'John Doe', phone: '1122334455', opening_balance: 1250 },
        { name: 'Jane Smith', opening_balance: 800 },
      ],
    });
    console.log('Result:', customerRes.data.message);

    // 4. Verify Outstandings
    console.log('\n[Verifying] Checking Outstandings...');
    const outRes = await api.get('/accounting/outstandings');
    console.log('Receivables (Customers):', outRes.data.data.receivables.length);
    console.log('Payables (Suppliers):', outRes.data.data.payables.length);

    console.log('\n--- Migration Test Completed Successfully ---');
  } catch (err: any) {
    console.error('Migration Test Failed:', err.response?.data || err.message);
  }
}

// testMigration();
