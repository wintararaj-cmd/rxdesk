// Quick script to create a dev shop_owner user for testing
// Run with: npx ts-node prisma/seed-dev-shop.ts

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const phone = '+918888888888';

    // Create or find user
    const user = await prisma.user.upsert({
        where: { phone },
        update: { role: UserRole.shop_owner, is_verified: true, is_active: true },
        create: {
            phone,
            role: UserRole.shop_owner,
            is_verified: true,
            is_active: true,
        },
    });
    console.log(`✅ Shop owner user: ${user.id} (${phone})`);

    // Create or find shop
    const shop = await prisma.medicalShop.upsert({
        where: { owner_user_id: user.id },
        update: {},
        create: {
            owner_user_id: user.id,
            shop_name: 'RxDesk Demo Pharmacy',
            shop_type: 'pharmacy',
            drug_license_no: 'DEV-DL-001',
            address_line: '42, MG Road, Near City Hospital',
            city: 'Bangalore',
            state: 'Karnataka',
            pin_code: '560001',
            contact_phone: phone,
            contact_email: 'demo@rxdesk.in',
            gst_number: '29DEVGS0001T1Z1',
            opening_time: '08:00',
            closing_time: '22:00',
            working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            verification_status: 'approved',
            is_active: true,
        },
    });
    console.log(`✅ Shop created: ${shop.shop_name} (${shop.id})`);

    // Create a few sample bills  
    const patient = await prisma.user.upsert({
        where: { phone: '+917777777777' },
        update: {},
        create: { phone: '+917777777777', role: UserRole.patient, is_verified: true, is_active: true },
    });
    const patientProfile = await prisma.patient.upsert({
        where: { user_id: patient.id },
        update: {},
        create: {
            user_id: patient.id,
            full_name: 'Rahul Sharma',
            age: 32,
            gender: 'male',
            city: 'Bangalore',
            state: 'Karnataka',
            pin_code: '560001',
        },
    });

    const patient2 = await prisma.user.upsert({
        where: { phone: '+916666666666' },
        update: {},
        create: { phone: '+916666666666', role: UserRole.patient, is_verified: true, is_active: true },
    });
    const patientProfile2 = await prisma.patient.upsert({
        where: { user_id: patient2.id },
        update: {},
        create: {
            user_id: patient2.id,
            full_name: 'Priya Patel',
            age: 28,
            gender: 'female',
            city: 'Bangalore',
            state: 'Karnataka',
            pin_code: '560002',
        },
    });

    const patient3 = await prisma.user.upsert({
        where: { phone: '+915555555555' },
        update: {},
        create: { phone: '+915555555555', role: UserRole.patient, is_verified: true, is_active: true },
    });
    const patientProfile3 = await prisma.patient.upsert({
        where: { user_id: patient3.id },
        update: {},
        create: {
            user_id: patient3.id,
            full_name: 'Amit Kumar',
            age: 45,
            gender: 'male',
            city: 'Bangalore',
            state: 'Karnataka',
            pin_code: '560003',
        },
    });

    // Sample bills
    const sampleBills = [
        { patient_id: patientProfile.id, bill_number: 'DN-2026-000001', subtotal: 450, gst_amount: 54, discount_amount: 0, total_amount: 504, payment_method: 'cash' as const, payment_status: 'paid' as const, items: [{ medicine_name: 'Paracetamol 500mg', mrp: 15, quantity: 10, line_total: 150, gst_rate: 12 }, { medicine_name: 'Azithromycin 500mg', mrp: 60, quantity: 5, line_total: 300, gst_rate: 12 }] },
        { patient_id: patientProfile2.id, bill_number: 'DN-2026-000002', subtotal: 1200, gst_amount: 144, discount_amount: 50, total_amount: 1294, payment_method: 'upi' as const, payment_status: 'paid' as const, items: [{ medicine_name: 'Metformin 500mg', mrp: 8, quantity: 30, line_total: 240, gst_rate: 12 }, { medicine_name: 'Amlodipine 5mg', mrp: 12, quantity: 30, line_total: 360, gst_rate: 12 }, { medicine_name: 'Atorvastatin 10mg', mrp: 20, quantity: 30, line_total: 600, gst_rate: 12 }] },
        { patient_id: patientProfile3.id, bill_number: 'DN-2026-000003', subtotal: 280, gst_amount: 33.60, discount_amount: 0, total_amount: 313.60, payment_method: 'card' as const, payment_status: 'pending' as const, items: [{ medicine_name: 'Omeprazole 20mg', mrp: 14, quantity: 20, line_total: 280, gst_rate: 12 }] },
        { patient_id: patientProfile.id, bill_number: 'DN-2026-000004', subtotal: 650, gst_amount: 78, discount_amount: 25, total_amount: 703, payment_method: 'cash' as const, payment_status: 'paid' as const, items: [{ medicine_name: 'Cetirizine 10mg', mrp: 5, quantity: 30, line_total: 150, gst_rate: 12 }, { medicine_name: 'Montelukast 10mg', mrp: 25, quantity: 20, line_total: 500, gst_rate: 12 }] },
        { patient_id: patientProfile2.id, bill_number: 'DN-2026-000005', subtotal: 890, gst_amount: 106.80, discount_amount: 0, total_amount: 996.80, payment_method: 'upi' as const, payment_status: 'paid' as const, items: [{ medicine_name: 'Vitamin D3 60000 IU', mrp: 45, quantity: 8, line_total: 360, gst_rate: 12 }, { medicine_name: 'Calcium + D3', mrp: 17.67, quantity: 30, line_total: 530, gst_rate: 12 }] },
        { patient_id: patientProfile3.id, bill_number: 'DN-2026-000006', subtotal: 180, gst_amount: 21.60, discount_amount: 0, total_amount: 201.60, payment_method: 'credit' as const, payment_status: 'partial' as const, items: [{ medicine_name: 'Ibuprofen 400mg', mrp: 6, quantity: 30, line_total: 180, gst_rate: 12 }] },
        { patient_id: patientProfile.id, bill_number: 'DN-2026-000007', subtotal: 350, gst_amount: 42, discount_amount: 10, total_amount: 382, payment_method: 'cash' as const, payment_status: 'paid' as const, items: [{ medicine_name: 'Pantoprazole 40mg', mrp: 7, quantity: 30, line_total: 210, gst_rate: 12 }, { medicine_name: 'Diclofenac 50mg', mrp: 7, quantity: 20, line_total: 140, gst_rate: 12 }] },
        { patient_id: patientProfile2.id, bill_number: 'DN-2026-000008', subtotal: 520, gst_amount: 62.40, discount_amount: 0, total_amount: 582.40, payment_method: 'upi' as const, payment_status: 'pending' as const, items: [{ medicine_name: 'Losartan 50mg', mrp: 10, quantity: 30, line_total: 300, gst_rate: 12 }, { medicine_name: 'Metoprolol 25mg', mrp: 11, quantity: 20, line_total: 220, gst_rate: 12 }] },
    ];

    // Vary created_at across the last 15 days
    let billCount = 0;
    for (let i = 0; i < sampleBills.length; i++) {
        const b = sampleBills[i];
        const daysAgo = Math.floor(i * 2); // spread over ~15 days
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        createdAt.setHours(9 + (i % 8), (i * 17) % 60);

        const existing = await prisma.bill.findUnique({ where: { bill_number: b.bill_number } });
        if (existing) { billCount++; continue; }

        await prisma.bill.create({
            data: {
                shop_id: shop.id,
                patient_id: b.patient_id,
                bill_number: b.bill_number,
                subtotal: b.subtotal,
                gst_amount: b.gst_amount,
                discount_amount: b.discount_amount,
                total_amount: b.total_amount,
                payment_method: b.payment_method,
                payment_status: b.payment_status,
                staff_id: user.id,
                created_at: createdAt,
                items: {
                    create: b.items.map(item => ({
                        medicine_name: item.medicine_name,
                        mrp: item.mrp,
                        quantity: item.quantity,
                        line_total: item.line_total,
                        gst_rate: item.gst_rate,
                        discount_pct: 0,
                    })),
                },
            },
        });
        billCount++;
    }
    console.log(`✅ Created ${billCount} sample bills`);

    console.log('\n🎉 Dev shop seeded!');
    console.log('📱 Login with phone: 8888888888 | OTP: 123456');
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
