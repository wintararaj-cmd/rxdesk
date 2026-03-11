/**
 * seed-inventory.ts
 *
 * WARNING: This script permanently deletes ALL inventory and medicine catalog data,
 * then reseeds the medicines table with popular Indian medicines.
 *
 * Run with:
 *   npx ts-node prisma/seed-inventory.ts
 */

import { PrismaClient, MedicineForm } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Popular Indian Medicines Catalog ────────────────────────────────────────

const MEDICINES: Array<{
  name: string;
  generic_name: string;
  brand_name: string;
  form: MedicineForm;
  strength: string;
  manufacturer: string;
  hsn_code: string;
  gst_rate: number;
  is_schedule_h: boolean;
}> = [
  // ── Analgesics / Antipyretics ──────────────────────────────────────────────
  { name: 'Paracetamol 500mg', generic_name: 'Paracetamol', brand_name: 'Crocin', form: 'tablet', strength: '500mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Paracetamol 650mg', generic_name: 'Paracetamol', brand_name: 'Dolo 650', form: 'tablet', strength: '650mg', manufacturer: 'Micro Labs', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ibuprofen 400mg', generic_name: 'Ibuprofen', brand_name: 'Brufen', form: 'tablet', strength: '400mg', manufacturer: 'Abbott', hsn_code: '30049074', gst_rate: 12, is_schedule_h: false },
  { name: 'Ibuprofen 200mg Syrup', generic_name: 'Ibuprofen', brand_name: 'Ibugesic Plus', form: 'syrup', strength: '100mg/5ml', manufacturer: 'Cipla', hsn_code: '30049074', gst_rate: 12, is_schedule_h: false },
  { name: 'Diclofenac 50mg', generic_name: 'Diclofenac Sodium', brand_name: 'Voveran', form: 'tablet', strength: '50mg', manufacturer: 'Novartis', hsn_code: '30049074', gst_rate: 12, is_schedule_h: false },
  { name: 'Aceclofenac 100mg', generic_name: 'Aceclofenac', brand_name: 'Zerodol', form: 'tablet', strength: '100mg', manufacturer: 'IPCA', hsn_code: '30049074', gst_rate: 12, is_schedule_h: false },
  { name: 'Aceclofenac + Paracetamol', generic_name: 'Aceclofenac + Paracetamol', brand_name: 'Zerodol-P', form: 'tablet', strength: '100mg+325mg', manufacturer: 'IPCA', hsn_code: '30049074', gst_rate: 12, is_schedule_h: false },
  { name: 'Nimesulide 100mg', generic_name: 'Nimesulide', brand_name: 'Nise', form: 'tablet', strength: '100mg', manufacturer: 'Dr. Reddy\'s', hsn_code: '30049074', gst_rate: 12, is_schedule_h: false },
  { name: 'Tramadol 50mg', generic_name: 'Tramadol HCl', brand_name: 'Contramal', form: 'tablet', strength: '50mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antibiotics ────────────────────────────────────────────────────────────
  { name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', brand_name: 'Mox 500', form: 'capsule', strength: '500mg', manufacturer: 'Cipla', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Amoxicillin + Clavulanate 625mg', generic_name: 'Amoxicillin + Clavulanic Acid', brand_name: 'Augmentin 625', form: 'tablet', strength: '500mg+125mg', manufacturer: 'GSK', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Azithromycin 500mg', generic_name: 'Azithromycin', brand_name: 'Azithral 500', form: 'tablet', strength: '500mg', manufacturer: 'Alembic', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Ciprofloxacin 500mg', generic_name: 'Ciprofloxacin', brand_name: 'Ciplox 500', form: 'tablet', strength: '500mg', manufacturer: 'Cipla', hsn_code: '30041020', gst_rate: 12, is_schedule_h: true },
  { name: 'Doxycycline 100mg', generic_name: 'Doxycycline', brand_name: 'Doxt SL', form: 'capsule', strength: '100mg', manufacturer: 'Sun Pharma', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Metronidazole 400mg', generic_name: 'Metronidazole', brand_name: 'Flagyl 400', form: 'tablet', strength: '400mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Cefixime 200mg', generic_name: 'Cefixime', brand_name: 'Taxim-O 200', form: 'tablet', strength: '200mg', manufacturer: 'Alkem', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Cefuroxime 500mg', generic_name: 'Cefuroxime Axetil', brand_name: 'Zinnat', form: 'tablet', strength: '500mg', manufacturer: 'GSK', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Levofloxacin 500mg', generic_name: 'Levofloxacin', brand_name: 'Levaquin', form: 'tablet', strength: '500mg', manufacturer: 'Dr. Reddy\'s', hsn_code: '30041020', gst_rate: 12, is_schedule_h: true },
  { name: 'Nitrofurantoin 100mg', generic_name: 'Nitrofurantoin', brand_name: 'Macrobid', form: 'capsule', strength: '100mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Clindamycin 300mg', generic_name: 'Clindamycin HCl', brand_name: 'Dalacin-C', form: 'capsule', strength: '300mg', manufacturer: 'Pfizer', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },

  // ── Antidiabetics ──────────────────────────────────────────────────────────
  { name: 'Metformin 500mg', generic_name: 'Metformin HCl', brand_name: 'Glycomet 500', form: 'tablet', strength: '500mg', manufacturer: 'USV', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Metformin 1000mg', generic_name: 'Metformin HCl', brand_name: 'Glycomet 1000', form: 'tablet', strength: '1000mg', manufacturer: 'USV', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Glimepiride 1mg', generic_name: 'Glimepiride', brand_name: 'Amaryl 1', form: 'tablet', strength: '1mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Glimepiride 2mg', generic_name: 'Glimepiride', brand_name: 'Amaryl 2', form: 'tablet', strength: '2mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Glimepiride + Metformin 2mg/500mg', generic_name: 'Glimepiride + Metformin', brand_name: 'Glycomet GP 2', form: 'tablet', strength: '2mg+500mg', manufacturer: 'USV', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Sitagliptin 50mg', generic_name: 'Sitagliptin Phosphate', brand_name: 'Januvia 50', form: 'tablet', strength: '50mg', manufacturer: 'MSD', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Sitagliptin 100mg', generic_name: 'Sitagliptin Phosphate', brand_name: 'Januvia 100', form: 'tablet', strength: '100mg', manufacturer: 'MSD', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Voglibose 0.3mg', generic_name: 'Voglibose', brand_name: 'Volix 0.3', form: 'tablet', strength: '0.3mg', manufacturer: 'Ranbaxy', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antihypertensives ──────────────────────────────────────────────────────
  { name: 'Amlodipine 5mg', generic_name: 'Amlodipine Besylate', brand_name: 'Amlip 5', form: 'tablet', strength: '5mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Amlodipine 10mg', generic_name: 'Amlodipine Besylate', brand_name: 'Amlip 10', form: 'tablet', strength: '10mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Losartan 50mg', generic_name: 'Losartan Potassium', brand_name: 'Losar 50', form: 'tablet', strength: '50mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Telmisartan 40mg', generic_name: 'Telmisartan', brand_name: 'Telma 40', form: 'tablet', strength: '40mg', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Telmisartan 80mg', generic_name: 'Telmisartan', brand_name: 'Telma 80', form: 'tablet', strength: '80mg', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ramipril 5mg', generic_name: 'Ramipril', brand_name: 'Cardace 5', form: 'tablet', strength: '5mg', manufacturer: 'Aventis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Enalapril 5mg', generic_name: 'Enalapril Maleate', brand_name: 'Enam 5', form: 'tablet', strength: '5mg', manufacturer: 'Lupin', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Metoprolol 25mg', generic_name: 'Metoprolol Succinate', brand_name: 'Metolar XR 25', form: 'tablet', strength: '25mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Metoprolol 50mg', generic_name: 'Metoprolol Succinate', brand_name: 'Metolar XR 50', form: 'tablet', strength: '50mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Atenolol 50mg', generic_name: 'Atenolol', brand_name: 'Tenormin 50', form: 'tablet', strength: '50mg', manufacturer: 'AstraZeneca', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Amlodipine + Telmisartan 5/40mg', generic_name: 'Amlodipine + Telmisartan', brand_name: 'Telma-AM', form: 'tablet', strength: '5mg+40mg', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Lipid-Lowering Agents ──────────────────────────────────────────────────
  { name: 'Atorvastatin 10mg', generic_name: 'Atorvastatin Calcium', brand_name: 'Atorva 10', form: 'tablet', strength: '10mg', manufacturer: 'Zydus', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Atorvastatin 20mg', generic_name: 'Atorvastatin Calcium', brand_name: 'Atorva 20', form: 'tablet', strength: '20mg', manufacturer: 'Zydus', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Rosuvastatin 10mg', generic_name: 'Rosuvastatin Calcium', brand_name: 'Rozucor 10', form: 'tablet', strength: '10mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Rosuvastatin 20mg', generic_name: 'Rosuvastatin Calcium', brand_name: 'Rozucor 20', form: 'tablet', strength: '20mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antacids / GI Agents ───────────────────────────────────────────────────
  { name: 'Omeprazole 20mg', generic_name: 'Omeprazole', brand_name: 'Omez 20', form: 'capsule', strength: '20mg', manufacturer: 'Dr. Reddy\'s', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Omeprazole 40mg', generic_name: 'Omeprazole', brand_name: 'Omez 40', form: 'capsule', strength: '40mg', manufacturer: 'Dr. Reddy\'s', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Pantoprazole 40mg', generic_name: 'Pantoprazole Sodium', brand_name: 'Pan 40', form: 'tablet', strength: '40mg', manufacturer: 'Alkem', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Rabeprazole 20mg', generic_name: 'Rabeprazole Sodium', brand_name: 'Razo 20', form: 'tablet', strength: '20mg', manufacturer: 'Dr. Reddy\'s', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Domperidone 10mg', generic_name: 'Domperidone', brand_name: 'Domstal 10', form: 'tablet', strength: '10mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ondansetron 4mg', generic_name: 'Ondansetron HCl', brand_name: 'Emeset 4', form: 'tablet', strength: '4mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Metoclopramide 10mg', generic_name: 'Metoclopramide HCl', brand_name: 'Perinorm', form: 'tablet', strength: '10mg', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ranitidine 150mg', generic_name: 'Ranitidine HCl', brand_name: 'Zinetac 150', form: 'tablet', strength: '150mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Loperamide 2mg', generic_name: 'Loperamide HCl', brand_name: 'Imodium', form: 'tablet', strength: '2mg', manufacturer: 'Janssen', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'ORS Powder', generic_name: 'Oral Rehydration Salts', brand_name: 'Electral Powder', form: 'powder', strength: 'WHO Formula', manufacturer: 'Franco-Indian', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Activated Charcoal 250mg', generic_name: 'Activated Charcoal', brand_name: 'Carbotab', form: 'tablet', strength: '250mg', manufacturer: 'Elder', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Antihistamines / Allergies ─────────────────────────────────────────────
  { name: 'Cetirizine 10mg', generic_name: 'Cetirizine HCl', brand_name: 'Cetzine 10', form: 'tablet', strength: '10mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Levocetirizine 5mg', generic_name: 'Levocetirizine Dihydrochloride', brand_name: 'Levocet 5', form: 'tablet', strength: '5mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Loratadine 10mg', generic_name: 'Loratadine', brand_name: 'Lorfast 10', form: 'tablet', strength: '10mg', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Fexofenadine 120mg', generic_name: 'Fexofenadine HCl', brand_name: 'Allegra 120', form: 'tablet', strength: '120mg', manufacturer: 'Aventis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Fexofenadine 180mg', generic_name: 'Fexofenadine HCl', brand_name: 'Allegra 180', form: 'tablet', strength: '180mg', manufacturer: 'Aventis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Chlorpheniramine 4mg', generic_name: 'Chlorpheniramine Maleate', brand_name: 'Piriton 4', form: 'tablet', strength: '4mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Respiratory ────────────────────────────────────────────────────────────
  { name: 'Montelukast 10mg', generic_name: 'Montelukast Sodium', brand_name: 'Montair 10', form: 'tablet', strength: '10mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Montelukast + Levocetirizine', generic_name: 'Montelukast + Levocetirizine', brand_name: 'Montair-LC', form: 'tablet', strength: '10mg+5mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Salbutamol 2mg', generic_name: 'Salbutamol Sulphate', brand_name: 'Asthalin 2', form: 'tablet', strength: '2mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Salbutamol Inhaler', generic_name: 'Salbutamol', brand_name: 'Asthalin Inhaler', form: 'inhaler', strength: '100mcg/dose', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Budesonide + Formoterol Inhaler', generic_name: 'Budesonide + Formoterol', brand_name: 'Budecort-F', form: 'inhaler', strength: '200mcg+6mcg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Theophylline 200mg', generic_name: 'Theophylline', brand_name: 'Deriphyllin 200', form: 'tablet', strength: '200mg', manufacturer: 'Piramal', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ambroxol 30mg', generic_name: 'Ambroxol HCl', brand_name: 'Ambrodil', form: 'tablet', strength: '30mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ambroxol Syrup', generic_name: 'Ambroxol HCl', brand_name: 'Ambrodil-S', form: 'syrup', strength: '15mg/5ml', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Vitamins & Supplements ─────────────────────────────────────────────────
  { name: 'Vitamin D3 60000 IU', generic_name: 'Cholecalciferol', brand_name: 'D-Rise 60K', form: 'capsule', strength: '60000 IU', manufacturer: 'USV', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Vitamin B12 500mcg', generic_name: 'Methylcobalamin', brand_name: 'Neurobion Forte', form: 'tablet', strength: '500mcg', manufacturer: 'Merck', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Calcium + Vitamin D3', generic_name: 'Calcium Carbonate + Cholecalciferol', brand_name: 'Shelcal 500', form: 'tablet', strength: '500mg+250IU', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Ferrous Sulphate + Folic Acid', generic_name: 'Ferrous Sulphate + Folic Acid', brand_name: 'Fefol', form: 'capsule', strength: '150mg+0.5mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Multivitamin + Multimineral', generic_name: 'Multivitamins + Minerals', brand_name: 'Supradyn Daily', form: 'tablet', strength: 'Varied', manufacturer: 'Bayer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Zinc 10mg', generic_name: 'Zinc Sulphate', brand_name: 'Zincovit', form: 'tablet', strength: '10mg', manufacturer: 'Apex', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Omega-3 Fatty Acids', generic_name: 'Omega-3 (EPA+DHA)', brand_name: 'Zincovit Omega', form: 'capsule', strength: '1000mg', manufacturer: 'Apex', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Dermatology ────────────────────────────────────────────────────────────
  { name: 'Betamethasone Cream', generic_name: 'Betamethasone Valerate', brand_name: 'Betnovate', form: 'ointment', strength: '0.1%', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Clobetasol Cream', generic_name: 'Clobetasol Propionate', brand_name: 'Tenovate', form: 'ointment', strength: '0.05%', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Clotrimazole Cream', generic_name: 'Clotrimazole', brand_name: 'Candid B', form: 'ointment', strength: '1%', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Mupirocin Ointment', generic_name: 'Mupirocin', brand_name: 'T-Bact', form: 'ointment', strength: '2%', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Calamine Lotion', generic_name: 'Calamine', brand_name: 'Lacto Calamine', form: 'other', strength: '8%', manufacturer: 'Piramal', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Eye & Ear Drops ────────────────────────────────────────────────────────
  { name: 'Ciprofloxacin Eye Drops', generic_name: 'Ciprofloxacin HCl', brand_name: 'Ciplox Eye Drops', form: 'drops', strength: '0.3%', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Tobramycin + Dexamethasone Eye Drops', generic_name: 'Tobramycin + Dexamethasone', brand_name: 'Tobaflam', form: 'drops', strength: '0.3%+0.1%', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ofloxacin Ear Drops', generic_name: 'Ofloxacin', brand_name: 'Floxal Ear Drops', form: 'drops', strength: '0.3%', manufacturer: 'Alcon', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Latanoprost Eye Drops', generic_name: 'Latanoprost', brand_name: 'Travatan', form: 'drops', strength: '0.005%', manufacturer: 'Alcon', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Neurological / Psychiatric ─────────────────────────────────────────────
  { name: 'Amitriptyline 10mg', generic_name: 'Amitriptyline HCl', brand_name: 'Tryptomer 10', form: 'tablet', strength: '10mg', manufacturer: 'Merck', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Escitalopram 10mg', generic_name: 'Escitalopram Oxalate', brand_name: 'Nexito 10', form: 'tablet', strength: '10mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Alprazolam 0.25mg', generic_name: 'Alprazolam', brand_name: 'Alprax 0.25', form: 'tablet', strength: '0.25mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Clonazepam 0.5mg', generic_name: 'Clonazepam', brand_name: 'Rivotril 0.5', form: 'tablet', strength: '0.5mg', manufacturer: 'Roche', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Pregabalin 75mg', generic_name: 'Pregabalin', brand_name: 'Lyrica 75', form: 'capsule', strength: '75mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Gabapentin 300mg', generic_name: 'Gabapentin', brand_name: 'Gabantin 300', form: 'capsule', strength: '300mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Thyroid ────────────────────────────────────────────────────────────────
  { name: 'Levothyroxine 25mcg', generic_name: 'Levothyroxine Sodium', brand_name: 'Thyronorm 25', form: 'tablet', strength: '25mcg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Levothyroxine 50mcg', generic_name: 'Levothyroxine Sodium', brand_name: 'Thyronorm 50', form: 'tablet', strength: '50mcg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Levothyroxine 100mcg', generic_name: 'Levothyroxine Sodium', brand_name: 'Thyronorm 100', form: 'tablet', strength: '100mcg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Cardiovascular / Other ─────────────────────────────────────────────────
  { name: 'Aspirin 75mg', generic_name: 'Acetylsalicylic Acid', brand_name: 'Ecosprin 75', form: 'tablet', strength: '75mg', manufacturer: 'USV', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Aspirin 150mg', generic_name: 'Acetylsalicylic Acid', brand_name: 'Ecosprin 150', form: 'tablet', strength: '150mg', manufacturer: 'USV', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Clopidogrel 75mg', generic_name: 'Clopidogrel Bisulphate', brand_name: 'Clopilet 75', form: 'tablet', strength: '75mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Isosorbide Dinitrate 5mg', generic_name: 'Isosorbide Dinitrate', brand_name: 'Isordil 5', form: 'tablet', strength: '5mg', manufacturer: 'Wyeth', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Furosemide 40mg', generic_name: 'Furosemide', brand_name: 'Lasix 40', form: 'tablet', strength: '40mg', manufacturer: 'Aventis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Spironolactone 25mg', generic_name: 'Spironolactone', brand_name: 'Aldactone 25', form: 'tablet', strength: '25mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Digoxin 0.25mg', generic_name: 'Digoxin', brand_name: 'Digoxin', form: 'tablet', strength: '0.25mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antifungals ────────────────────────────────────────────────────────────
  { name: 'Fluconazole 150mg', generic_name: 'Fluconazole', brand_name: 'Flucos 150', form: 'capsule', strength: '150mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Itraconazole 200mg', generic_name: 'Itraconazole', brand_name: 'Canditral 200', form: 'capsule', strength: '200mg', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Injections (common) ────────────────────────────────────────────────────
  { name: 'Ondansetron Injection 4mg', generic_name: 'Ondansetron HCl', brand_name: 'Emeset 4mg Inj', form: 'injection', strength: '4mg/2ml', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Diclofenac Injection 75mg', generic_name: 'Diclofenac Sodium', brand_name: 'Voveran 75 Inj', form: 'injection', strength: '75mg/3ml', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Dexamethasone Injection 4mg', generic_name: 'Dexamethasone Sodium Phosphate', brand_name: 'Decdan 4mg Inj', form: 'injection', strength: '4mg/ml', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Tramadol Injection 50mg', generic_name: 'Tramadol HCl', brand_name: 'Tramazac 50 Inj', form: 'injection', strength: '50mg/ml', manufacturer: 'Zydus', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ranitidine Injection 50mg', generic_name: 'Ranitidine HCl', brand_name: 'Rantac Inj', form: 'injection', strength: '50mg/2ml', manufacturer: 'J.B. Chemicals', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Metoclopramide Injection 10mg', generic_name: 'Metoclopramide HCl', brand_name: 'Perinorm Inj', form: 'injection', strength: '10mg/2ml', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Cough & Cold ───────────────────────────────────────────────────────────
  { name: 'Dextromethorphan + Chlorpheniramine Syrup', generic_name: 'Dextromethorphan + Chlorpheniramine', brand_name: 'Benadryl Cough', form: 'syrup', strength: '10mg+4mg/5ml', manufacturer: 'Johnson & Johnson', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ambroxol + Guaifenesin Syrup', generic_name: 'Ambroxol + Guaifenesin', brand_name: 'Alex Syrup', form: 'syrup', strength: '15mg+50mg/5ml', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Bromhexine 8mg', generic_name: 'Bromhexine HCl', brand_name: 'Bisolvon', form: 'tablet', strength: '8mg', manufacturer: 'Boehringer Ingelheim', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Guaifenesin + Bromhexine + Terbutaline Syrup', generic_name: 'Guaifenesin + Bromhexine + Terbutaline', brand_name: 'Ascoril LS', form: 'syrup', strength: 'Combination', manufacturer: 'Glenmark', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Carbocisteine 375mg', generic_name: 'Carbocisteine', brand_name: 'Mucosolvan', form: 'capsule', strength: '375mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Phenylephrine + Paracetamol Tablet', generic_name: 'Phenylephrine + Paracetamol', brand_name: 'Sinarest', form: 'tablet', strength: '10mg+325mg', manufacturer: 'Centaur', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Xylometazoline Nasal Drops', generic_name: 'Xylometazoline HCl', brand_name: 'Otrivin 0.1%', form: 'drops', strength: '0.1%', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Oxymetazoline Nasal Spray', generic_name: 'Oxymetazoline HCl', brand_name: 'Nasivion', form: 'drops', strength: '0.05%', manufacturer: 'Merck', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Budesonide Nasal Spray', generic_name: 'Budesonide', brand_name: 'Budecort Nasal', form: 'inhaler', strength: '100mcg/dose', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Fluticasone Nasal Spray', generic_name: 'Fluticasone Propionate', brand_name: 'Flomist', form: 'inhaler', strength: '50mcg/dose', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Codeine Phosphate Linctus', generic_name: 'Codeine Phosphate', brand_name: 'Phensedyl', form: 'syrup', strength: '10mg/5ml', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Levosalbutamol + Ambroxol Syrup', generic_name: 'Levosalbutamol + Ambroxol', brand_name: 'Ventorlin-S', form: 'syrup', strength: '1mg+15mg/5ml', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── More Antibiotics ───────────────────────────────────────────────────────
  { name: 'Azithromycin 250mg', generic_name: 'Azithromycin', brand_name: 'Azithral 250', form: 'tablet', strength: '250mg', manufacturer: 'Alembic', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Amoxicillin 250mg Syrup', generic_name: 'Amoxicillin', brand_name: 'Mox Syrup', form: 'syrup', strength: '125mg/5ml', manufacturer: 'Cipla', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Cefpodoxime 200mg', generic_name: 'Cefpodoxime Proxetil', brand_name: 'Cepodem 200', form: 'tablet', strength: '200mg', manufacturer: 'Sun Pharma', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Cefpodoxime 100mg', generic_name: 'Cefpodoxime Proxetil', brand_name: 'Cepodem 100', form: 'tablet', strength: '100mg', manufacturer: 'Sun Pharma', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Ofloxacin 200mg', generic_name: 'Ofloxacin', brand_name: 'Zanocin 200', form: 'tablet', strength: '200mg', manufacturer: 'Sun Pharma', hsn_code: '30041020', gst_rate: 12, is_schedule_h: true },
  { name: 'Ofloxacin + Ornidazole', generic_name: 'Ofloxacin + Ornidazole', brand_name: 'Ornof', form: 'tablet', strength: '200mg+500mg', manufacturer: 'Alkem', hsn_code: '30041020', gst_rate: 12, is_schedule_h: true },
  { name: 'Norfloxacin 400mg', generic_name: 'Norfloxacin', brand_name: 'Norflox 400', form: 'tablet', strength: '400mg', manufacturer: 'Cipla', hsn_code: '30041020', gst_rate: 12, is_schedule_h: true },
  { name: 'Doxycycline 100mg Capsule', generic_name: 'Doxycycline Hyclate', brand_name: 'Vibramycin', form: 'capsule', strength: '100mg', manufacturer: 'Pfizer', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Erythromycin 500mg', generic_name: 'Erythromycin Stearate', brand_name: 'Althrocin 500', form: 'tablet', strength: '500mg', manufacturer: 'Alembic', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Clarithromycin 500mg', generic_name: 'Clarithromycin', brand_name: 'Claribid 500', form: 'tablet', strength: '500mg', manufacturer: 'Abbott', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Tinidazole 500mg', generic_name: 'Tinidazole', brand_name: 'Tiniba 500', form: 'tablet', strength: '500mg', manufacturer: 'Zydus', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ornidazole 500mg', generic_name: 'Ornidazole', brand_name: 'Ornof 500', form: 'tablet', strength: '500mg', manufacturer: 'Alkem', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Cephalexin 500mg', generic_name: 'Cephalexin', brand_name: 'Sporidex 500', form: 'capsule', strength: '500mg', manufacturer: 'Ranbaxy', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Amoxicillin + Clavulanate 375mg', generic_name: 'Amoxicillin + Clavulanic Acid', brand_name: 'Augmentin 375', form: 'tablet', strength: '250mg+125mg', manufacturer: 'GSK', hsn_code: '30041010', gst_rate: 12, is_schedule_h: true },
  { name: 'Sulfamethoxazole + Trimethoprim', generic_name: 'Sulfamethoxazole + Trimethoprim', brand_name: 'Bactrim DS', form: 'tablet', strength: '800mg+160mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Rifampicin 450mg', generic_name: 'Rifampicin', brand_name: 'Rifacin 450', form: 'capsule', strength: '450mg', manufacturer: 'Lupin', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Isoniazid 300mg', generic_name: 'Isoniazid', brand_name: 'INH 300', form: 'tablet', strength: '300mg', manufacturer: 'Lupin', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Pyrazinamide 500mg', generic_name: 'Pyrazinamide', brand_name: 'PZA-Ciba 500', form: 'tablet', strength: '500mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ethambutol 800mg', generic_name: 'Ethambutol HCl', brand_name: 'Myambutol 800', form: 'tablet', strength: '800mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antivirals ─────────────────────────────────────────────────────────────
  { name: 'Acyclovir 400mg', generic_name: 'Acyclovir', brand_name: 'Zovirax 400', form: 'tablet', strength: '400mg', manufacturer: 'GlaxoSmithKline', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Oseltamivir 75mg', generic_name: 'Oseltamivir Phosphate', brand_name: 'Tamiflu 75', form: 'capsule', strength: '75mg', manufacturer: 'Roche', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Tenofovir 300mg', generic_name: 'Tenofovir Disoproxil Fumarate', brand_name: 'Tenvir 300', form: 'tablet', strength: '300mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Efavirenz 600mg', generic_name: 'Efavirenz', brand_name: 'Stocrin 600', form: 'tablet', strength: '600mg', manufacturer: 'MSD', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Valacyclovir 500mg', generic_name: 'Valacyclovir HCl', brand_name: 'Valcivir 500', form: 'tablet', strength: '500mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antimalarials ──────────────────────────────────────────────────────────
  { name: 'Hydroxychloroquine 200mg', generic_name: 'Hydroxychloroquine Sulphate', brand_name: 'Hcqs 200', form: 'tablet', strength: '200mg', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Chloroquine 250mg', generic_name: 'Chloroquine Phosphate', brand_name: 'Lariago 250', form: 'tablet', strength: '250mg', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Artemether + Lumefantrine', generic_name: 'Artemether + Lumefantrine', brand_name: 'Coartem', form: 'tablet', strength: '20mg+120mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Primaquine 7.5mg', generic_name: 'Primaquine Phosphate', brand_name: 'Malarex 7.5', form: 'tablet', strength: '7.5mg', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antiparasitics / Anthelmintics ─────────────────────────────────────────
  { name: 'Albendazole 400mg', generic_name: 'Albendazole', brand_name: 'Zentel 400', form: 'tablet', strength: '400mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Mebendazole 100mg', generic_name: 'Mebendazole', brand_name: 'Mebex 100', form: 'tablet', strength: '100mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ivermectin 12mg', generic_name: 'Ivermectin', brand_name: 'Ivermectin 12', form: 'tablet', strength: '12mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Piperazine 500mg', generic_name: 'Piperazine Citrate', brand_name: 'Hetrazan', form: 'tablet', strength: '500mg', manufacturer: 'Wyeth', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Muscle Relaxants & Combinations ───────────────────────────────────────
  { name: 'Thiocolchicoside 4mg', generic_name: 'Thiocolchicoside', brand_name: 'Muscoril 4', form: 'tablet', strength: '4mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Thiocolchicoside 8mg', generic_name: 'Thiocolchicoside', brand_name: 'Muscoril 8', form: 'tablet', strength: '8mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Etoricoxib 60mg', generic_name: 'Etoricoxib', brand_name: 'Arcoxia 60', form: 'tablet', strength: '60mg', manufacturer: 'MSD', hsn_code: '30049074', gst_rate: 12, is_schedule_h: true },
  { name: 'Etoricoxib 90mg', generic_name: 'Etoricoxib', brand_name: 'Arcoxia 90', form: 'tablet', strength: '90mg', manufacturer: 'MSD', hsn_code: '30049074', gst_rate: 12, is_schedule_h: true },
  { name: 'Diclofenac + Thiocolchicoside', generic_name: 'Diclofenac + Thiocolchicoside', brand_name: 'Signoflam', form: 'tablet', strength: '50mg+4mg', manufacturer: 'Sun Pharma', hsn_code: '30049074', gst_rate: 12, is_schedule_h: true },
  { name: 'Tizanidine 2mg', generic_name: 'Tizanidine HCl', brand_name: 'Tizan 2', form: 'tablet', strength: '2mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Baclofen 10mg', generic_name: 'Baclofen', brand_name: 'Lioresal 10', form: 'tablet', strength: '10mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Methocarbamol 750mg', generic_name: 'Methocarbamol', brand_name: 'Robaxin 750', form: 'tablet', strength: '750mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Antispasmodics / GI ────────────────────────────────────────────────────
  { name: 'Dicyclomine 10mg', generic_name: 'Dicyclomine HCl', brand_name: 'Meftal Spaz', form: 'tablet', strength: '10mg', manufacturer: 'Blue Cross', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Dicyclomine + Paracetamol', generic_name: 'Dicyclomine + Paracetamol', brand_name: 'Cyclopam', form: 'tablet', strength: '20mg+500mg', manufacturer: 'Indoco', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Hyoscine Butylbromide 10mg', generic_name: 'Hyoscine Butylbromide', brand_name: 'Buscopan 10', form: 'tablet', strength: '10mg', manufacturer: 'Boehringer Ingelheim', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Drotaverine 40mg', generic_name: 'Drotaverine HCl', brand_name: 'No-Spa 40', form: 'tablet', strength: '40mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Trimebutine 100mg', generic_name: 'Trimebutine Maleate', brand_name: 'Regutrex 100', form: 'tablet', strength: '100mg', manufacturer: 'Lupin', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Pantoprazole + Domperidone', generic_name: 'Pantoprazole + Domperidone', brand_name: 'Pantop-D', form: 'capsule', strength: '40mg+10mg', manufacturer: 'Aristo', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Rabeprazole + Domperidone', generic_name: 'Rabeprazole + Domperidone', brand_name: 'Razo-D', form: 'capsule', strength: '20mg+30mg SR', manufacturer: 'Dr. Reddy\'s', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Esomeprazole 40mg', generic_name: 'Esomeprazole Magnesium', brand_name: 'Nexpro 40', form: 'tablet', strength: '40mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Sucralfate 1g', generic_name: 'Sucralfate', brand_name: 'Sucral Gel', form: 'other', strength: '1g/5ml', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Lactulose Syrup', generic_name: 'Lactulose', brand_name: 'Duphalac', form: 'syrup', strength: '10g/15ml', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Bisacodyl 5mg', generic_name: 'Bisacodyl', brand_name: 'Dulcolax 5', form: 'tablet', strength: '5mg', manufacturer: 'Boehringer Ingelheim', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ispaghula Husk', generic_name: 'Ispaghula Husk', brand_name: 'Isabgol', form: 'powder', strength: '3.5g/sachet', manufacturer: 'Dabur', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Zinc + ORS Dispersible Tablet', generic_name: 'Zinc + ORS', brand_name: 'ZinCORS', form: 'tablet', strength: '20mg+ORS', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },

  // ── Anti-vertigo / Nausea ──────────────────────────────────────────────────
  { name: 'Betahistine 16mg', generic_name: 'Betahistine Dihydrochloride', brand_name: 'Vertin 16', form: 'tablet', strength: '16mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Betahistine 8mg', generic_name: 'Betahistine Dihydrochloride', brand_name: 'Vertin 8', form: 'tablet', strength: '8mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Cinnarizine 25mg', generic_name: 'Cinnarizine', brand_name: 'Stugeron 25', form: 'tablet', strength: '25mg', manufacturer: 'Janssen', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Promethazine 25mg', generic_name: 'Promethazine HCl', brand_name: 'Phenergan 25', form: 'tablet', strength: '25mg', manufacturer: 'Aventis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Meclizine 25mg', generic_name: 'Meclizine HCl', brand_name: 'Antevert 25', form: 'tablet', strength: '25mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Antiepileptics / Anticonvulsants ───────────────────────────────────────
  { name: 'Phenytoin 100mg', generic_name: 'Phenytoin Sodium', brand_name: 'Eptoin 100', form: 'tablet', strength: '100mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Valproate Sodium 200mg', generic_name: 'Sodium Valproate', brand_name: 'Valparin 200', form: 'tablet', strength: '200mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Valproate 500mg CR', generic_name: 'Sodium Valproate', brand_name: 'Valparin CR 500', form: 'tablet', strength: '500mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Carbamazepine 200mg', generic_name: 'Carbamazepine', brand_name: 'Mazetol 200', form: 'tablet', strength: '200mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Levetiracetam 500mg', generic_name: 'Levetiracetam', brand_name: 'Levroxa 500', form: 'tablet', strength: '500mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Lamotrigine 50mg', generic_name: 'Lamotrigine', brand_name: 'Lamictal 50', form: 'tablet', strength: '50mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Oxcarbazepine 300mg', generic_name: 'Oxcarbazepine', brand_name: 'Oxetol 300', form: 'tablet', strength: '300mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Topiramate 50mg', generic_name: 'Topiramate', brand_name: 'Topamac 50', form: 'tablet', strength: '50mg', manufacturer: 'Janssen', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── More Neurological / Psychiatric ─────────────────────────────────────────
  { name: 'Sertraline 50mg', generic_name: 'Sertraline HCl', brand_name: 'Serta 50', form: 'tablet', strength: '50mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Fluoxetine 20mg', generic_name: 'Fluoxetine HCl', brand_name: 'Fludac 20', form: 'capsule', strength: '20mg', manufacturer: 'Cadila', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Paroxetine 20mg', generic_name: 'Paroxetine HCl', brand_name: 'Paxidep 20', form: 'tablet', strength: '20mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Venlafaxine 75mg', generic_name: 'Venlafaxine HCl', brand_name: 'Venfax 75', form: 'capsule', strength: '75mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Olanzapine 5mg', generic_name: 'Olanzapine', brand_name: 'Olanex 5', form: 'tablet', strength: '5mg', manufacturer: 'Ranbaxy', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Olanzapine 10mg', generic_name: 'Olanzapine', brand_name: 'Olanex 10', form: 'tablet', strength: '10mg', manufacturer: 'Ranbaxy', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Quetiapine 100mg', generic_name: 'Quetiapine Fumarate', brand_name: 'Qutan 100', form: 'tablet', strength: '100mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Risperidone 2mg', generic_name: 'Risperidone', brand_name: 'Risnia 2', form: 'tablet', strength: '2mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Haloperidol 5mg', generic_name: 'Haloperidol', brand_name: 'Serenace 5', form: 'tablet', strength: '5mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Diazepam 5mg', generic_name: 'Diazepam', brand_name: 'Valium 5', form: 'tablet', strength: '5mg', manufacturer: 'Roche', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Zolpidem 10mg', generic_name: 'Zolpidem Tartrate', brand_name: 'Ambien 10', form: 'tablet', strength: '10mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Donepezil 10mg', generic_name: 'Donepezil HCl', brand_name: 'Aricept 10', form: 'tablet', strength: '10mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Methylphenidate 10mg', generic_name: 'Methylphenidate HCl', brand_name: 'Ritalin 10', form: 'tablet', strength: '10mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Newer Antidiabetics ────────────────────────────────────────────────────
  { name: 'Dapagliflozin 10mg', generic_name: 'Dapagliflozin', brand_name: 'Forxiga 10', form: 'tablet', strength: '10mg', manufacturer: 'AstraZeneca', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Empagliflozin 10mg', generic_name: 'Empagliflozin', brand_name: 'Jardiance 10', form: 'tablet', strength: '10mg', manufacturer: 'Boehringer Ingelheim', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Canagliflozin 100mg', generic_name: 'Canagliflozin', brand_name: 'Invokana 100', form: 'tablet', strength: '100mg', manufacturer: 'Janssen', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Saxagliptin 5mg', generic_name: 'Saxagliptin HCl', brand_name: 'Onglyza 5', form: 'tablet', strength: '5mg', manufacturer: 'AstraZeneca', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Teneligliptin 20mg', generic_name: 'Teneligliptin Hydrobromide', brand_name: 'Teneli 20', form: 'tablet', strength: '20mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Gliclazide 80mg', generic_name: 'Gliclazide', brand_name: 'Diamicron 80', form: 'tablet', strength: '80mg', manufacturer: 'Servier', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Gliclazide MR 60mg', generic_name: 'Gliclazide', brand_name: 'Diamicron MR 60', form: 'tablet', strength: '60mg', manufacturer: 'Servier', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Pioglitazone 15mg', generic_name: 'Pioglitazone HCl', brand_name: 'Pioglit 15', form: 'tablet', strength: '15mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Insulin Glargine 100IU/ml', generic_name: 'Insulin Glargine', brand_name: 'Lantus', form: 'injection', strength: '100 IU/ml', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Human Insulin 30/70', generic_name: 'Biphasic Insulin', brand_name: 'Huminsulin 30/70', form: 'injection', strength: '100 IU/ml', manufacturer: 'Eli Lilly', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── More Antihypertensives / Cardiovascular ────────────────────────────────
  { name: 'Olmesartan 20mg', generic_name: 'Olmesartan Medoxomil', brand_name: 'Olsar 20', form: 'tablet', strength: '20mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Olmesartan 40mg', generic_name: 'Olmesartan Medoxomil', brand_name: 'Olsar 40', form: 'tablet', strength: '40mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Valsartan 80mg', generic_name: 'Valsartan', brand_name: 'Diovan 80', form: 'tablet', strength: '80mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Valsartan 160mg', generic_name: 'Valsartan', brand_name: 'Diovan 160', form: 'tablet', strength: '160mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Irbesartan 150mg', generic_name: 'Irbesartan', brand_name: 'Avapro 150', form: 'tablet', strength: '150mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Candesartan 8mg', generic_name: 'Candesartan Cilexetil', brand_name: 'Rite-O-Cand 8', form: 'tablet', strength: '8mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Carvedilol 6.25mg', generic_name: 'Carvedilol', brand_name: 'Cardivas 6.25', form: 'tablet', strength: '6.25mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Nebivolol 5mg', generic_name: 'Nebivolol HCl', brand_name: 'Nebicard 5', form: 'tablet', strength: '5mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Bisoprolol 5mg', generic_name: 'Bisoprolol Fumarate', brand_name: 'Concor 5', form: 'tablet', strength: '5mg', manufacturer: 'Merck', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Hydrochlorothiazide 25mg', generic_name: 'Hydrochlorothiazide', brand_name: 'Esidrex 25', form: 'tablet', strength: '25mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Nifedipine 10mg', generic_name: 'Nifedipine', brand_name: 'Depin 10', form: 'tablet', strength: '10mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Nitroglycerine 0.5mg SL', generic_name: 'Glyceryl Trinitrate', brand_name: 'Sorbitrate 5', form: 'tablet', strength: '0.5mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ivabradine 5mg', generic_name: 'Ivabradine HCl', brand_name: 'Ivabrad 5', form: 'tablet', strength: '5mg', manufacturer: 'Servier', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Sacubitril + Valsartan 50mg', generic_name: 'Sacubitril + Valsartan', brand_name: 'Vymada 50', form: 'tablet', strength: '50mg', manufacturer: 'Novartis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Lipid Lowering (additional) ────────────────────────────────────────────
  { name: 'Fenofibrate 160mg', generic_name: 'Fenofibrate', brand_name: 'Tricor 160', form: 'tablet', strength: '160mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Gemfibrozil 600mg', generic_name: 'Gemfibrozil', brand_name: 'Lopid 600', form: 'tablet', strength: '600mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ezetimibe 10mg', generic_name: 'Ezetimibe', brand_name: 'Ezetrol 10', form: 'tablet', strength: '10mg', manufacturer: 'MSD', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Atorvastatin + Ezetimibe 10/10mg', generic_name: 'Atorvastatin + Ezetimibe', brand_name: 'Atorva-EZ', form: 'tablet', strength: '10mg+10mg', manufacturer: 'Zydus', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Hormones / Women\'s Health ─────────────────────────────────────────────
  { name: 'Progesterone 200mg', generic_name: 'Micronized Progesterone', brand_name: 'Susten 200', form: 'capsule', strength: '200mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Progesterone Injection 25mg', generic_name: 'Progesterone', brand_name: 'Gestone 25 Inj', form: 'injection', strength: '25mg/ml', manufacturer: 'Ferring', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Norethisterone 5mg', generic_name: 'Norethisterone', brand_name: 'Primolut-N 5', form: 'tablet', strength: '5mg', manufacturer: 'Bayer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Estradiol Valerate 2mg', generic_name: 'Estradiol Valerate', brand_name: 'Progynova 2', form: 'tablet', strength: '2mg', manufacturer: 'Bayer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Combined OC Pill (Ethinyl Estradiol + Levonorgestrel)', generic_name: 'EE 0.03mg + LNG 0.15mg', brand_name: 'Ovral-L', form: 'tablet', strength: '0.03mg+0.15mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Emergency Contraceptive (Levonorgestrel 1.5mg)', generic_name: 'Levonorgestrel', brand_name: 'I-Pill', form: 'tablet', strength: '1.5mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Mifepristone 200mg', generic_name: 'Mifepristone', brand_name: 'Mifeprin 200', form: 'tablet', strength: '200mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Folic Acid 5mg', generic_name: 'Folic Acid', brand_name: 'Folvite 5', form: 'tablet', strength: '5mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Iron + Folic Acid Syrup', generic_name: 'Ferric Ammonium Citrate + Folic Acid', brand_name: 'Autrin Syrup', form: 'syrup', strength: '160mg+0.5mg/5ml', manufacturer: 'Wyeth', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Clomiphene 50mg', generic_name: 'Clomiphene Citrate', brand_name: 'Siphene 50', form: 'tablet', strength: '50mg', manufacturer: 'Serum Institute', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Letrozole 2.5mg', generic_name: 'Letrozole', brand_name: 'Fempro 2.5', form: 'tablet', strength: '2.5mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Misoprostol 200mcg', generic_name: 'Misoprostol', brand_name: 'Cytotec 200', form: 'tablet', strength: '200mcg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Medroxyprogesterone Acetate 10mg', generic_name: 'Medroxyprogesterone Acetate', brand_name: 'Provera 10', form: 'tablet', strength: '10mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Urology ────────────────────────────────────────────────────────────────
  { name: 'Tamsulosin 0.4mg', generic_name: 'Tamsulosin HCl', brand_name: 'Urimax 0.4', form: 'capsule', strength: '0.4mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Silodosin 8mg', generic_name: 'Silodosin', brand_name: 'Urorec 8', form: 'capsule', strength: '8mg', manufacturer: 'Torrent', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Finasteride 5mg', generic_name: 'Finasteride', brand_name: 'Proscar 5', form: 'tablet', strength: '5mg', manufacturer: 'MSD', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Dutasteride 0.5mg', generic_name: 'Dutasteride', brand_name: 'Duprost 0.5', form: 'capsule', strength: '0.5mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Solifenacin 5mg', generic_name: 'Solifenacin Succinate', brand_name: 'Vesicare 5', form: 'tablet', strength: '5mg', manufacturer: 'Astellas', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Tadalafil 10mg', generic_name: 'Tadalafil', brand_name: 'Tadalis 10', form: 'tablet', strength: '10mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Tadalafil 5mg OAD', generic_name: 'Tadalafil', brand_name: 'Tadalis 5', form: 'tablet', strength: '5mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Liver Protection ───────────────────────────────────────────────────────
  { name: 'Silymarin 140mg', generic_name: 'Silymarin', brand_name: 'Liv.52 DS', form: 'tablet', strength: '140mg', manufacturer: 'Himalaya', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ursodeoxycholic Acid 300mg', generic_name: 'Ursodeoxycholic Acid', brand_name: 'Udiliv 300', form: 'tablet', strength: '300mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Betaine + Silymarin Syrup', generic_name: 'Betaine + Silymarin', brand_name: 'Livogen Z', form: 'syrup', strength: 'Combination', manufacturer: 'Merck', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'N-Acetylcysteine 600mg', generic_name: 'N-Acetylcysteine', brand_name: 'Mucomyst 600', form: 'tablet', strength: '600mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Tenofovir + Entecavir 0.5mg', generic_name: 'Entecavir', brand_name: 'Entavir 0.5', form: 'tablet', strength: '0.5mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Gout ───────────────────────────────────────────────────────────────────
  { name: 'Allopurinol 100mg', generic_name: 'Allopurinol', brand_name: 'Zyloric 100', form: 'tablet', strength: '100mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Allopurinol 300mg', generic_name: 'Allopurinol', brand_name: 'Zyloric 300', form: 'tablet', strength: '300mg', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Febuxostat 40mg', generic_name: 'Febuxostat', brand_name: 'Febustat 40', form: 'tablet', strength: '40mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Colchicine 0.5mg', generic_name: 'Colchicine', brand_name: 'Colchicine 0.5', form: 'tablet', strength: '0.5mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Benzbromarone 50mg', generic_name: 'Benzbromarone', brand_name: 'Benzbromaron 50', form: 'tablet', strength: '50mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Steroids / Immunosuppressants ──────────────────────────────────────────
  { name: 'Prednisolone 5mg', generic_name: 'Prednisolone', brand_name: 'Wysolone 5', form: 'tablet', strength: '5mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Prednisolone 10mg', generic_name: 'Prednisolone', brand_name: 'Wysolone 10', form: 'tablet', strength: '10mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Prednisolone 20mg', generic_name: 'Prednisolone', brand_name: 'Wysolone 20', form: 'tablet', strength: '20mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Dexamethasone 0.5mg', generic_name: 'Dexamethasone', brand_name: 'Dexona 0.5', form: 'tablet', strength: '0.5mg', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Methylprednisolone 4mg', generic_name: 'Methylprednisolone', brand_name: 'Medrol 4', form: 'tablet', strength: '4mg', manufacturer: 'Pfizer', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Hydroxychloroquine 400mg', generic_name: 'Hydroxychloroquine Sulphate', brand_name: 'Hcqs 400', form: 'tablet', strength: '400mg', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Methotrexate 2.5mg', generic_name: 'Methotrexate', brand_name: 'Folitrax 2.5', form: 'tablet', strength: '2.5mg', manufacturer: 'IPCA', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Azathioprine 50mg', generic_name: 'Azathioprine', brand_name: 'Azoran 50', form: 'tablet', strength: '50mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Haematinics / Supplements ──────────────────────────────────────────────
  { name: 'Ferrous Ascorbate + Folic Acid', generic_name: 'Ferrous Ascorbate + Folic Acid', brand_name: 'Dexorange', form: 'capsule', strength: '100mg+1.5mg', manufacturer: 'Franco-Indian', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Iron (IV) Sucrose 100mg Inj', generic_name: 'Iron Sucrose', brand_name: 'Sufer 100', form: 'injection', strength: '100mg/5ml', manufacturer: 'Emcure', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Vitamin B-Complex Injection', generic_name: 'Vitamin B Complex', brand_name: 'Neurobion Inj', form: 'injection', strength: 'Combination', manufacturer: 'Merck', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ascorbic Acid 500mg', generic_name: 'Ascorbic Acid (Vitamin C)', brand_name: 'Limcee 500', form: 'tablet', strength: '500mg', manufacturer: 'Abbott', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Vitamin A 50000 IU', generic_name: 'Retinol (Vitamin A)', brand_name: 'Akovit', form: 'capsule', strength: '50000 IU', manufacturer: 'Lupin', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Magnesium + B6 Tablet', generic_name: 'Magnesium + Pyridoxine', brand_name: 'Magne-B6', form: 'tablet', strength: '50mg+10mg', manufacturer: 'Sanofi', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Biotin 10mg', generic_name: 'Biotin (Vitamin B7)', brand_name: 'Biotin 10', form: 'tablet', strength: '10mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },
  { name: 'Mecobalamin 1500mcg', generic_name: 'Methylcobalamin', brand_name: 'Mecobal 1500', form: 'tablet', strength: '1500mcg', manufacturer: 'Micro Labs', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },

  // ── More Dermatology / Topical ─────────────────────────────────────────────
  { name: 'Mometasone Furoate Cream', generic_name: 'Mometasone Furoate', brand_name: 'Elocon', form: 'ointment', strength: '0.1%', manufacturer: 'MSD', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Tacrolimus Ointment 0.03%', generic_name: 'Tacrolimus', brand_name: 'Protopic 0.03%', form: 'ointment', strength: '0.03%', manufacturer: 'Astellas', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ketoconazole 2% Cream', generic_name: 'Ketoconazole', brand_name: 'Nizoral Cream', form: 'ointment', strength: '2%', manufacturer: 'Janssen', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ketoconazole 2% Shampoo', generic_name: 'Ketoconazole', brand_name: 'Nizoral Shampoo', form: 'other', strength: '2%', manufacturer: 'Janssen', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Permethrin 5% Cream', generic_name: 'Permethrin', brand_name: 'Scabagen', form: 'ointment', strength: '5%', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Benzoyl Peroxide 5% Gel', generic_name: 'Benzoyl Peroxide', brand_name: 'Benzac 5%', form: 'ointment', strength: '5%', manufacturer: 'Galderma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Tretinoin 0.025% Cream', generic_name: 'Tretinoin', brand_name: 'Retino-A 0.025%', form: 'ointment', strength: '0.025%', manufacturer: 'Johnson & Johnson', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Coal Tar + Salicylic Acid Shampoo', generic_name: 'Coal Tar + Salicylic Acid', brand_name: 'T-Gel', form: 'other', strength: '1%+2%', manufacturer: 'Neutrogena', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Fusidic Acid Cream', generic_name: 'Fusidic Acid', brand_name: 'Fucidin', form: 'ointment', strength: '2%', manufacturer: 'Leo Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Silver Sulfadiazine Cream', generic_name: 'Silver Sulfadiazine', brand_name: 'Silverex', form: 'ointment', strength: '1%', manufacturer: 'Alkem', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Ophthalmology ──────────────────────────────────────────────────────────
  { name: 'Moxifloxacin Eye Drops 0.5%', generic_name: 'Moxifloxacin HCl', brand_name: 'Moxicip Eye', form: 'drops', strength: '0.5%', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Carboxymethylcellulose Eye Drops', generic_name: 'Carboxymethylcellulose', brand_name: 'Refresh Tears', form: 'drops', strength: '0.5%', manufacturer: 'Allergan', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Timolol Eye Drops 0.5%', generic_name: 'Timolol Maleate', brand_name: 'Glucomol 0.5%', form: 'drops', strength: '0.5%', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Prednisolone Eye Drops 1%', generic_name: 'Prednisolone Acetate', brand_name: 'Prednol Eye', form: 'drops', strength: '1%', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Brimonidine Eye Drops 0.2%', generic_name: 'Brimonidine Tartrate', brand_name: 'Alphagan', form: 'drops', strength: '0.2%', manufacturer: 'Allergan', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },

  // ── Pediatric / Syrups ─────────────────────────────────────────────────────
  { name: 'Paracetamol Drops 100mg/ml', generic_name: 'Paracetamol', brand_name: 'Calpol Drops', form: 'drops', strength: '100mg/ml', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Paracetamol Syrup 120mg/5ml', generic_name: 'Paracetamol', brand_name: 'Calpol 120', form: 'syrup', strength: '120mg/5ml', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ibuprofen Syrup 100mg/5ml', generic_name: 'Ibuprofen', brand_name: 'Brufen 100', form: 'syrup', strength: '100mg/5ml', manufacturer: 'Abbott', hsn_code: '30049074', gst_rate: 12, is_schedule_h: false },
  { name: 'Cetirizine Syrup 5mg/5ml', generic_name: 'Cetirizine HCl', brand_name: 'Cetzine Syrup', form: 'syrup', strength: '5mg/5ml', manufacturer: 'GSK', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Ondansetron 2mg/5ml Syrup', generic_name: 'Ondansetron HCl', brand_name: 'Emeset Syrup', form: 'syrup', strength: '2mg/5ml', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Azithromycin 200mg/5ml Syrup', generic_name: 'Azithromycin', brand_name: 'Azithral 200', form: 'syrup', strength: '200mg/5ml', manufacturer: 'Alembic', hsn_code: '30041050', gst_rate: 12, is_schedule_h: true },
  { name: 'Salbutamol 2mg/5ml Syrup', generic_name: 'Salbutamol Sulphate', brand_name: 'Asthalin Syrup', form: 'syrup', strength: '2mg/5ml', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Vitamin D3 400IU Drops', generic_name: 'Cholecalciferol', brand_name: 'D-Rise Drops', form: 'drops', strength: '400 IU/drop', manufacturer: 'USV', hsn_code: '30049099', gst_rate: 5, is_schedule_h: false },

  // ── Wound Care / Surgical ──────────────────────────────────────────────────
  { name: 'Povidone Iodine 5% Ointment', generic_name: 'Povidone Iodine', brand_name: 'Betadine 5%', form: 'ointment', strength: '5%', manufacturer: 'Win-Medicare', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Povidone Iodine 7.5% Solution', generic_name: 'Povidone Iodine', brand_name: 'Betadine 7.5%', form: 'other', strength: '7.5%', manufacturer: 'Win-Medicare', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Hydrogen Peroxide 3% Solution', generic_name: 'Hydrogen Peroxide', brand_name: 'H2O2 3%', form: 'other', strength: '3%', manufacturer: 'Various', hsn_code: '28470000', gst_rate: 18, is_schedule_h: false },
  { name: 'Chlorhexidine 4% Soap', generic_name: 'Chlorhexidine Gluconate', brand_name: 'Savlon 4%', form: 'other', strength: '4%', manufacturer: 'ICI India', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },
  { name: 'Framycetin Sulphate Cream', generic_name: 'Framycetin Sulphate', brand_name: 'Soframycin Cream', form: 'ointment', strength: '1%', manufacturer: 'Aventis', hsn_code: '30049099', gst_rate: 12, is_schedule_h: false },

  // ── Palliative / Oncology Support ──────────────────────────────────────────
  { name: 'Morphine 10mg Tablet', generic_name: 'Morphine Sulphate', brand_name: 'MS Contin 10', form: 'tablet', strength: '10mg', manufacturer: 'Mundipharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Tramadol + Paracetamol', generic_name: 'Tramadol + Paracetamol', brand_name: 'Dolowin Plus', form: 'tablet', strength: '37.5mg+325mg', manufacturer: 'Win-Medicare', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Ondansetron 8mg', generic_name: 'Ondansetron HCl', brand_name: 'Emeset 8', form: 'tablet', strength: '8mg', manufacturer: 'Cipla', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
  { name: 'Metoclopramide + Ondansetron Combo', generic_name: 'Metoclopramide + Ondansetron', brand_name: 'Vomiset Plus', form: 'tablet', strength: '10mg+4mg', manufacturer: 'Sun Pharma', hsn_code: '30049099', gst_rate: 12, is_schedule_h: true },
];

// ─── Inventory booster for the dev shop (seeded by seed-dev-shop.ts) ─────────
// Mirrors the medicines list with realistic stock for testing.
const INVENTORY_SEED: Array<{
  medicine_name: string;
  batch_number: string;
  expiry_months: number;   // months from now
  mrp: number;
  purchase_price: number;
  gst_rate: number;
  stock_qty: number;
  reorder_level: number;
  unit: string;
}> = [
  { medicine_name: 'Paracetamol 500mg', batch_number: 'BTH-001', expiry_months: 24, mrp: 15.00, purchase_price: 9.50, gst_rate: 12, stock_qty: 500, reorder_level: 50, unit: 'strip' },
  { medicine_name: 'Paracetamol 650mg', batch_number: 'BTH-002', expiry_months: 24, mrp: 20.00, purchase_price: 12.00, gst_rate: 12, stock_qty: 400, reorder_level: 50, unit: 'strip' },
  { medicine_name: 'Ibuprofen 400mg', batch_number: 'BTH-003', expiry_months: 18, mrp: 18.00, purchase_price: 11.00, gst_rate: 12, stock_qty: 300, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Diclofenac 50mg', batch_number: 'BTH-004', expiry_months: 18, mrp: 12.00, purchase_price: 7.00, gst_rate: 12, stock_qty: 250, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Aceclofenac 100mg', batch_number: 'BTH-005', expiry_months: 18, mrp: 22.00, purchase_price: 13.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Aceclofenac + Paracetamol', batch_number: 'BTH-006', expiry_months: 18, mrp: 30.00, purchase_price: 18.00, gst_rate: 12, stock_qty: 150, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Amoxicillin 500mg', batch_number: 'BTH-007', expiry_months: 24, mrp: 65.00, purchase_price: 40.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Amoxicillin + Clavulanate 625mg', batch_number: 'BTH-008', expiry_months: 24, mrp: 180.00, purchase_price: 110.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Azithromycin 500mg', batch_number: 'BTH-009', expiry_months: 24, mrp: 85.00, purchase_price: 52.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Ciprofloxacin 500mg', batch_number: 'BTH-010', expiry_months: 24, mrp: 55.00, purchase_price: 34.00, gst_rate: 12, stock_qty: 180, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Metformin 500mg', batch_number: 'BTH-011', expiry_months: 36, mrp: 9.00, purchase_price: 5.50, gst_rate: 12, stock_qty: 600, reorder_level: 60, unit: 'strip' },
  { medicine_name: 'Metformin 1000mg', batch_number: 'BTH-012', expiry_months: 36, mrp: 15.00, purchase_price: 9.00, gst_rate: 12, stock_qty: 400, reorder_level: 40, unit: 'strip' },
  { medicine_name: 'Glimepiride 1mg', batch_number: 'BTH-013', expiry_months: 24, mrp: 28.00, purchase_price: 17.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Glimepiride 2mg', batch_number: 'BTH-014', expiry_months: 24, mrp: 38.00, purchase_price: 23.00, gst_rate: 12, stock_qty: 180, reorder_level: 18, unit: 'strip' },
  { medicine_name: 'Amlodipine 5mg', batch_number: 'BTH-015', expiry_months: 36, mrp: 14.00, purchase_price: 8.50, gst_rate: 12, stock_qty: 400, reorder_level: 40, unit: 'strip' },
  { medicine_name: 'Amlodipine 10mg', batch_number: 'BTH-016', expiry_months: 36, mrp: 22.00, purchase_price: 13.00, gst_rate: 12, stock_qty: 250, reorder_level: 25, unit: 'strip' },
  { medicine_name: 'Losartan 50mg', batch_number: 'BTH-017', expiry_months: 36, mrp: 18.00, purchase_price: 11.00, gst_rate: 12, stock_qty: 300, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Telmisartan 40mg', batch_number: 'BTH-018', expiry_months: 36, mrp: 25.00, purchase_price: 15.00, gst_rate: 12, stock_qty: 280, reorder_level: 28, unit: 'strip' },
  { medicine_name: 'Telmisartan 80mg', batch_number: 'BTH-019', expiry_months: 36, mrp: 38.00, purchase_price: 23.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Metoprolol 50mg', batch_number: 'BTH-020', expiry_months: 36, mrp: 32.00, purchase_price: 19.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Atorvastatin 10mg', batch_number: 'BTH-021', expiry_months: 36, mrp: 35.00, purchase_price: 21.00, gst_rate: 12, stock_qty: 350, reorder_level: 35, unit: 'strip' },
  { medicine_name: 'Atorvastatin 20mg', batch_number: 'BTH-022', expiry_months: 36, mrp: 55.00, purchase_price: 34.00, gst_rate: 12, stock_qty: 250, reorder_level: 25, unit: 'strip' },
  { medicine_name: 'Rosuvastatin 10mg', batch_number: 'BTH-023', expiry_months: 36, mrp: 65.00, purchase_price: 40.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Omeprazole 20mg', batch_number: 'BTH-024', expiry_months: 24, mrp: 18.00, purchase_price: 11.00, gst_rate: 12, stock_qty: 400, reorder_level: 40, unit: 'strip' },
  { medicine_name: 'Omeprazole 40mg', batch_number: 'BTH-025', expiry_months: 24, mrp: 28.00, purchase_price: 17.00, gst_rate: 12, stock_qty: 300, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Pantoprazole 40mg', batch_number: 'BTH-026', expiry_months: 24, mrp: 22.00, purchase_price: 13.00, gst_rate: 12, stock_qty: 350, reorder_level: 35, unit: 'strip' },
  { medicine_name: 'Domperidone 10mg', batch_number: 'BTH-027', expiry_months: 24, mrp: 12.00, purchase_price: 7.50, gst_rate: 12, stock_qty: 250, reorder_level: 25, unit: 'strip' },
  { medicine_name: 'Ondansetron 4mg', batch_number: 'BTH-028', expiry_months: 24, mrp: 22.00, purchase_price: 13.50, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Cetirizine 10mg', batch_number: 'BTH-029', expiry_months: 24, mrp: 8.00, purchase_price: 5.00, gst_rate: 12, stock_qty: 400, reorder_level: 40, unit: 'strip' },
  { medicine_name: 'Levocetirizine 5mg', batch_number: 'BTH-030', expiry_months: 24, mrp: 12.00, purchase_price: 7.50, gst_rate: 12, stock_qty: 350, reorder_level: 35, unit: 'strip' },
  { medicine_name: 'Fexofenadine 120mg', batch_number: 'BTH-031', expiry_months: 24, mrp: 45.00, purchase_price: 28.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Montelukast 10mg', batch_number: 'BTH-032', expiry_months: 24, mrp: 55.00, purchase_price: 34.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Montelukast + Levocetirizine', batch_number: 'BTH-033', expiry_months: 24, mrp: 75.00, purchase_price: 46.00, gst_rate: 12, stock_qty: 180, reorder_level: 18, unit: 'strip' },
  { medicine_name: 'Salbutamol Inhaler', batch_number: 'BTH-034', expiry_months: 18, mrp: 95.00, purchase_price: 58.00, gst_rate: 12, stock_qty: 50, reorder_level: 10, unit: 'piece' },
  { medicine_name: 'Vitamin D3 60000 IU', batch_number: 'BTH-035', expiry_months: 24, mrp: 55.00, purchase_price: 34.00, gst_rate: 5, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Vitamin B12 500mcg', batch_number: 'BTH-036', expiry_months: 24, mrp: 35.00, purchase_price: 21.00, gst_rate: 5, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Calcium + Vitamin D3', batch_number: 'BTH-037', expiry_months: 24, mrp: 22.00, purchase_price: 13.00, gst_rate: 5, stock_qty: 300, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Multivitamin + Multimineral', batch_number: 'BTH-038', expiry_months: 24, mrp: 85.00, purchase_price: 52.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'ORS Powder', batch_number: 'BTH-039', expiry_months: 36, mrp: 12.00, purchase_price: 7.50, gst_rate: 5, stock_qty: 200, reorder_level: 20, unit: 'packet' },
  { medicine_name: 'Aspirin 75mg', batch_number: 'BTH-040', expiry_months: 36, mrp: 8.00, purchase_price: 5.00, gst_rate: 12, stock_qty: 500, reorder_level: 50, unit: 'strip' },
  { medicine_name: 'Clopidogrel 75mg', batch_number: 'BTH-041', expiry_months: 36, mrp: 45.00, purchase_price: 28.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Levothyroxine 50mcg', batch_number: 'BTH-042', expiry_months: 24, mrp: 32.00, purchase_price: 19.50, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Levothyroxine 100mcg', batch_number: 'BTH-043', expiry_months: 24, mrp: 48.00, purchase_price: 29.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Fluconazole 150mg', batch_number: 'BTH-044', expiry_months: 24, mrp: 38.00, purchase_price: 23.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Ambroxol Syrup', batch_number: 'BTH-045', expiry_months: 18, mrp: 55.00, purchase_price: 34.00, gst_rate: 12, stock_qty: 80, reorder_level: 10, unit: 'bottle' },

  // Injections
  { medicine_name: 'Tramadol Injection 50mg', batch_number: 'BTH-046', expiry_months: 36, mrp: 22.00, purchase_price: 13.00, gst_rate: 12, stock_qty: 60, reorder_level: 10, unit: 'vial' },
  { medicine_name: 'Ranitidine Injection 50mg', batch_number: 'BTH-047', expiry_months: 30, mrp: 18.00, purchase_price: 11.00, gst_rate: 12, stock_qty: 60, reorder_level: 10, unit: 'vial' },
  { medicine_name: 'Metoclopramide Injection 10mg', batch_number: 'BTH-048', expiry_months: 30, mrp: 12.00, purchase_price: 7.00, gst_rate: 12, stock_qty: 60, reorder_level: 10, unit: 'vial' },
  { medicine_name: 'Insulin Glargine 100IU/ml', batch_number: 'BTH-049', expiry_months: 24, mrp: 680.00, purchase_price: 420.00, gst_rate: 12, stock_qty: 30, reorder_level: 5, unit: 'vial' },
  { medicine_name: 'Human Insulin 30/70', batch_number: 'BTH-050', expiry_months: 24, mrp: 210.00, purchase_price: 130.00, gst_rate: 12, stock_qty: 40, reorder_level: 5, unit: 'vial' },
  { medicine_name: 'Iron (IV) Sucrose 100mg Inj', batch_number: 'BTH-051', expiry_months: 36, mrp: 280.00, purchase_price: 170.00, gst_rate: 12, stock_qty: 20, reorder_level: 5, unit: 'vial' },
  { medicine_name: 'Vitamin B-Complex Injection', batch_number: 'BTH-052', expiry_months: 36, mrp: 28.00, purchase_price: 17.00, gst_rate: 12, stock_qty: 60, reorder_level: 10, unit: 'vial' },
  { medicine_name: 'Progesterone Injection 25mg', batch_number: 'BTH-053', expiry_months: 24, mrp: 75.00, purchase_price: 46.00, gst_rate: 12, stock_qty: 20, reorder_level: 5, unit: 'vial' },

  // Cough & Cold
  { medicine_name: 'Dextromethorphan + Chlorpheniramine Syrup', batch_number: 'BTH-054', expiry_months: 24, mrp: 85.00, purchase_price: 52.00, gst_rate: 12, stock_qty: 60, reorder_level: 10, unit: 'bottle' },
  { medicine_name: 'Ambroxol + Guaifenesin Syrup', batch_number: 'BTH-055', expiry_months: 18, mrp: 72.00, purchase_price: 44.00, gst_rate: 12, stock_qty: 60, reorder_level: 10, unit: 'bottle' },
  { medicine_name: 'Guaifenesin + Bromhexine + Terbutaline Syrup', batch_number: 'BTH-056', expiry_months: 18, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 50, reorder_level: 10, unit: 'bottle' },
  { medicine_name: 'Phenylephrine + Paracetamol Tablet', batch_number: 'BTH-057', expiry_months: 24, mrp: 32.00, purchase_price: 19.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Xylometazoline Nasal Drops', batch_number: 'BTH-058', expiry_months: 24, mrp: 68.00, purchase_price: 42.00, gst_rate: 12, stock_qty: 40, reorder_level: 8, unit: 'bottle' },
  { medicine_name: 'Oxymetazoline Nasal Spray', batch_number: 'BTH-059', expiry_months: 24, mrp: 82.00, purchase_price: 50.00, gst_rate: 12, stock_qty: 40, reorder_level: 8, unit: 'bottle' },

  // More Antibiotics
  { medicine_name: 'Azithromycin 250mg', batch_number: 'BTH-060', expiry_months: 36, mrp: 42.00, purchase_price: 26.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Cefpodoxime 200mg', batch_number: 'BTH-061', expiry_months: 36, mrp: 115.00, purchase_price: 70.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Ofloxacin + Ornidazole', batch_number: 'BTH-062', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Doxycycline 100mg Capsule', batch_number: 'BTH-063', expiry_months: 36, mrp: 55.00, purchase_price: 34.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Clarithromycin 500mg', batch_number: 'BTH-064', expiry_months: 36, mrp: 148.00, purchase_price: 90.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Amoxicillin + Clavulanate 375mg', batch_number: 'BTH-065', expiry_months: 36, mrp: 125.00, purchase_price: 76.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Cephalexin 500mg', batch_number: 'BTH-066', expiry_months: 36, mrp: 75.00, purchase_price: 46.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Tinidazole 500mg', batch_number: 'BTH-067', expiry_months: 36, mrp: 38.00, purchase_price: 23.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },

  // Muscle Relaxants
  { medicine_name: 'Thiocolchicoside 4mg', batch_number: 'BTH-068', expiry_months: 36, mrp: 62.00, purchase_price: 38.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Etoricoxib 90mg', batch_number: 'BTH-069', expiry_months: 36, mrp: 145.00, purchase_price: 88.00, gst_rate: 12, stock_qty: 120, reorder_level: 12, unit: 'strip' },
  { medicine_name: 'Diclofenac + Thiocolchicoside', batch_number: 'BTH-070', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 120, reorder_level: 12, unit: 'strip' },
  { medicine_name: 'Tizanidine 2mg', batch_number: 'BTH-071', expiry_months: 36, mrp: 42.00, purchase_price: 26.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },

  // Antispasmodics / GI
  { medicine_name: 'Dicyclomine + Paracetamol', batch_number: 'BTH-072', expiry_months: 36, mrp: 45.00, purchase_price: 28.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Hyoscine Butylbromide 10mg', batch_number: 'BTH-073', expiry_months: 36, mrp: 52.00, purchase_price: 32.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Drotaverine 40mg', batch_number: 'BTH-074', expiry_months: 36, mrp: 58.00, purchase_price: 36.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Pantoprazole + Domperidone', batch_number: 'BTH-075', expiry_months: 36, mrp: 95.00, purchase_price: 58.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Esomeprazole 40mg', batch_number: 'BTH-076', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Lactulose Syrup', batch_number: 'BTH-077', expiry_months: 24, mrp: 95.00, purchase_price: 58.00, gst_rate: 12, stock_qty: 40, reorder_level: 5, unit: 'bottle' },
  { medicine_name: 'Bisacodyl 5mg', batch_number: 'BTH-078', expiry_months: 36, mrp: 22.00, purchase_price: 13.00, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Ispaghula Husk', batch_number: 'BTH-079', expiry_months: 24, mrp: 85.00, purchase_price: 52.00, gst_rate: 5, stock_qty: 80, reorder_level: 10, unit: 'box' },

  // Anti-vertigo
  { medicine_name: 'Betahistine 16mg', batch_number: 'BTH-080', expiry_months: 36, mrp: 72.00, purchase_price: 44.00, gst_rate: 12, stock_qty: 120, reorder_level: 12, unit: 'strip' },
  { medicine_name: 'Cinnarizine 25mg', batch_number: 'BTH-081', expiry_months: 36, mrp: 28.00, purchase_price: 17.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },

  // Antiepileptics
  { medicine_name: 'Valproate Sodium 200mg', batch_number: 'BTH-082', expiry_months: 36, mrp: 55.00, purchase_price: 34.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Carbamazepine 200mg', batch_number: 'BTH-083', expiry_months: 36, mrp: 48.00, purchase_price: 29.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Levetiracetam 500mg', batch_number: 'BTH-084', expiry_months: 36, mrp: 165.00, purchase_price: 100.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },
  { medicine_name: 'Phenytoin 100mg', batch_number: 'BTH-085', expiry_months: 36, mrp: 38.00, purchase_price: 23.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },

  // Psychiatric / Neurological
  { medicine_name: 'Sertraline 50mg', batch_number: 'BTH-086', expiry_months: 36, mrp: 98.00, purchase_price: 60.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Fluoxetine 20mg', batch_number: 'BTH-087', expiry_months: 36, mrp: 62.00, purchase_price: 38.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Olanzapine 10mg', batch_number: 'BTH-088', expiry_months: 36, mrp: 115.00, purchase_price: 70.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },
  { medicine_name: 'Risperidone 2mg', batch_number: 'BTH-089', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },

  // Newer Antidiabetics
  { medicine_name: 'Dapagliflozin 10mg', batch_number: 'BTH-090', expiry_months: 36, mrp: 420.00, purchase_price: 258.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },
  { medicine_name: 'Empagliflozin 10mg', batch_number: 'BTH-091', expiry_months: 36, mrp: 385.00, purchase_price: 236.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },
  { medicine_name: 'Teneligliptin 20mg', batch_number: 'BTH-092', expiry_months: 36, mrp: 195.00, purchase_price: 119.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },
  { medicine_name: 'Gliclazide MR 60mg', batch_number: 'BTH-093', expiry_months: 36, mrp: 110.00, purchase_price: 67.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },

  // Cardiovascular extras
  { medicine_name: 'Olmesartan 20mg', batch_number: 'BTH-094', expiry_months: 36, mrp: 115.00, purchase_price: 70.00, gst_rate: 12, stock_qty: 120, reorder_level: 12, unit: 'strip' },
  { medicine_name: 'Nebivolol 5mg', batch_number: 'BTH-095', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 120, reorder_level: 12, unit: 'strip' },
  { medicine_name: 'Bisoprolol 5mg', batch_number: 'BTH-096', expiry_months: 36, mrp: 95.00, purchase_price: 58.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Ezetimibe 10mg', batch_number: 'BTH-097', expiry_months: 36, mrp: 145.00, purchase_price: 88.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },

  // Hormones / Women's Health
  { medicine_name: 'Progesterone 200mg', batch_number: 'BTH-098', expiry_months: 24, mrp: 220.00, purchase_price: 135.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },
  { medicine_name: 'Emergency Contraceptive (Levonorgestrel 1.5mg)', batch_number: 'BTH-099', expiry_months: 36, mrp: 75.00, purchase_price: 46.00, gst_rate: 12, stock_qty: 80, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Folic Acid 5mg', batch_number: 'BTH-100', expiry_months: 36, mrp: 18.00, purchase_price: 11.00, gst_rate: 5, stock_qty: 300, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Iron + Folic Acid Syrup', batch_number: 'BTH-101', expiry_months: 24, mrp: 68.00, purchase_price: 42.00, gst_rate: 5, stock_qty: 60, reorder_level: 8, unit: 'bottle' },
  { medicine_name: 'Ferrous Ascorbate + Folic Acid', batch_number: 'BTH-102', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 5, stock_qty: 120, reorder_level: 12, unit: 'strip' },

  // Urology
  { medicine_name: 'Tamsulosin 0.4mg', batch_number: 'BTH-103', expiry_months: 36, mrp: 115.00, purchase_price: 70.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Finasteride 5mg', batch_number: 'BTH-104', expiry_months: 36, mrp: 195.00, purchase_price: 119.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },
  { medicine_name: 'Solifenacin 5mg', batch_number: 'BTH-105', expiry_months: 36, mrp: 175.00, purchase_price: 107.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },
  { medicine_name: 'Tadalafil 10mg', batch_number: 'BTH-106', expiry_months: 36, mrp: 285.00, purchase_price: 175.00, gst_rate: 12, stock_qty: 40, reorder_level: 5, unit: 'strip' },

  // Liver protection / Gout
  { medicine_name: 'Ursodeoxycholic Acid 300mg', batch_number: 'BTH-107', expiry_months: 36, mrp: 188.00, purchase_price: 115.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },
  { medicine_name: 'Allopurinol 300mg', batch_number: 'BTH-108', expiry_months: 36, mrp: 45.00, purchase_price: 28.00, gst_rate: 12, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Febuxostat 40mg', batch_number: 'BTH-109', expiry_months: 36, mrp: 138.00, purchase_price: 84.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },

  // Steroids
  { medicine_name: 'Prednisolone 10mg', batch_number: 'BTH-110', expiry_months: 36, mrp: 32.00, purchase_price: 19.50, gst_rate: 12, stock_qty: 200, reorder_level: 20, unit: 'strip' },
  { medicine_name: 'Methylprednisolone 4mg', batch_number: 'BTH-111', expiry_months: 36, mrp: 68.00, purchase_price: 42.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },

  // Dermatology / Topical
  { medicine_name: 'Mometasone Furoate Cream', batch_number: 'BTH-112', expiry_months: 36, mrp: 95.00, purchase_price: 58.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'tube' },
  { medicine_name: 'Ketoconazole 2% Cream', batch_number: 'BTH-113', expiry_months: 36, mrp: 72.00, purchase_price: 44.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'tube' },
  { medicine_name: 'Permethrin 5% Cream', batch_number: 'BTH-114', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'tube' },
  { medicine_name: 'Silver Sulfadiazine Cream', batch_number: 'BTH-115', expiry_months: 36, mrp: 62.00, purchase_price: 38.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'tube' },
  { medicine_name: 'Fusidic Acid Cream', batch_number: 'BTH-116', expiry_months: 36, mrp: 115.00, purchase_price: 70.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'tube' },
  { medicine_name: 'Framycetin Sulphate Cream', batch_number: 'BTH-117', expiry_months: 36, mrp: 85.00, purchase_price: 52.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'tube' },
  { medicine_name: 'Povidone Iodine 5% Ointment', batch_number: 'BTH-118', expiry_months: 24, mrp: 55.00, purchase_price: 34.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'tube' },

  // Ophthalmology
  { medicine_name: 'Moxifloxacin Eye Drops 0.5%', batch_number: 'BTH-119', expiry_months: 18, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'bottle' },
  { medicine_name: 'Carboxymethylcellulose Eye Drops', batch_number: 'BTH-120', expiry_months: 18, mrp: 125.00, purchase_price: 76.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'bottle' },
  { medicine_name: 'Timolol Eye Drops 0.5%', batch_number: 'BTH-121', expiry_months: 18, mrp: 68.00, purchase_price: 42.00, gst_rate: 12, stock_qty: 40, reorder_level: 5, unit: 'bottle' },

  // Pediatric
  { medicine_name: 'Paracetamol Drops 100mg/ml', batch_number: 'BTH-122', expiry_months: 18, mrp: 45.00, purchase_price: 28.00, gst_rate: 12, stock_qty: 60, reorder_level: 8, unit: 'bottle' },
  { medicine_name: 'Paracetamol Syrup 120mg/5ml', batch_number: 'BTH-123', expiry_months: 18, mrp: 38.00, purchase_price: 23.00, gst_rate: 12, stock_qty: 80, reorder_level: 10, unit: 'bottle' },
  { medicine_name: 'Ibuprofen Syrup 100mg/5ml', batch_number: 'BTH-124', expiry_months: 18, mrp: 48.00, purchase_price: 29.00, gst_rate: 12, stock_qty: 60, reorder_level: 8, unit: 'bottle' },
  { medicine_name: 'Cetirizine Syrup 5mg/5ml', batch_number: 'BTH-125', expiry_months: 18, mrp: 42.00, purchase_price: 26.00, gst_rate: 12, stock_qty: 60, reorder_level: 8, unit: 'bottle' },
  { medicine_name: 'Azithromycin 200mg/5ml Syrup', batch_number: 'BTH-126', expiry_months: 18, mrp: 68.00, purchase_price: 42.00, gst_rate: 12, stock_qty: 40, reorder_level: 5, unit: 'bottle' },
  { medicine_name: 'Vitamin D3 400IU Drops', batch_number: 'BTH-127', expiry_months: 24, mrp: 165.00, purchase_price: 100.00, gst_rate: 5, stock_qty: 40, reorder_level: 5, unit: 'bottle' },

  // Supplements & Vitamins
  { medicine_name: 'Ascorbic Acid 500mg', batch_number: 'BTH-128', expiry_months: 36, mrp: 18.00, purchase_price: 11.00, gst_rate: 5, stock_qty: 300, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Mecobalamin 1500mcg', batch_number: 'BTH-129', expiry_months: 36, mrp: 85.00, purchase_price: 52.00, gst_rate: 5, stock_qty: 150, reorder_level: 15, unit: 'strip' },
  { medicine_name: 'Biotin 10mg', batch_number: 'BTH-130', expiry_months: 36, mrp: 95.00, purchase_price: 58.00, gst_rate: 5, stock_qty: 100, reorder_level: 10, unit: 'strip' },

  // Antiparasitics / Antimalarials
  { medicine_name: 'Albendazole 400mg', batch_number: 'BTH-131', expiry_months: 36, mrp: 15.00, purchase_price: 9.00, gst_rate: 12, stock_qty: 300, reorder_level: 30, unit: 'strip' },
  { medicine_name: 'Hydroxychloroquine 200mg', batch_number: 'BTH-132', expiry_months: 36, mrp: 48.00, purchase_price: 29.00, gst_rate: 12, stock_qty: 120, reorder_level: 12, unit: 'strip' },
  { medicine_name: 'Ivermectin 12mg', batch_number: 'BTH-133', expiry_months: 36, mrp: 45.00, purchase_price: 28.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },

  // Anti-TB
  { medicine_name: 'Rifampicin 450mg', batch_number: 'BTH-134', expiry_months: 24, mrp: 38.00, purchase_price: 23.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },
  { medicine_name: 'Isoniazid 300mg', batch_number: 'BTH-135', expiry_months: 36, mrp: 12.00, purchase_price: 7.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },

  // Antivirals
  { medicine_name: 'Acyclovir 400mg', batch_number: 'BTH-136', expiry_months: 36, mrp: 72.00, purchase_price: 44.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },
  { medicine_name: 'Valacyclovir 500mg', batch_number: 'BTH-137', expiry_months: 36, mrp: 195.00, purchase_price: 119.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },

  // Methotrexate / Immunosuppressants
  { medicine_name: 'Methotrexate 2.5mg', batch_number: 'BTH-138', expiry_months: 24, mrp: 28.00, purchase_price: 17.00, gst_rate: 12, stock_qty: 60, reorder_level: 6, unit: 'strip' },

  // Oncology Support
  { medicine_name: 'Ondansetron 8mg', batch_number: 'BTH-139', expiry_months: 36, mrp: 75.00, purchase_price: 46.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },
  { medicine_name: 'Tramadol + Paracetamol', batch_number: 'BTH-140', expiry_months: 36, mrp: 62.00, purchase_price: 38.00, gst_rate: 12, stock_qty: 100, reorder_level: 10, unit: 'strip' },

  // Liver Protection
  { medicine_name: 'Silymarin 140mg', batch_number: 'BTH-141', expiry_months: 36, mrp: 88.00, purchase_price: 54.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },
  { medicine_name: 'N-Acetylcysteine 600mg', batch_number: 'BTH-142', expiry_months: 36, mrp: 65.00, purchase_price: 40.00, gst_rate: 12, stock_qty: 80, reorder_level: 8, unit: 'strip' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗑️  Starting inventory data purge...\n');

  // Step 1: Delete all shop inventory (has FK to medicines)
  const deletedInventory = await prisma.shopInventory.deleteMany({});
  console.log(`✅ Deleted ${deletedInventory.count} shop_inventory records`);

  // Step 2: Unlink medicine references in prescription_items (optional FK)
  const updatedPrescItems = await prisma.prescriptionItem.updateMany({
    data: { medicine_id: null },
  });
  console.log(`✅ Unlinked medicine_id in ${updatedPrescItems.count} prescription_items`);

  // Step 3: Unlink medicine references in purchase_items (optional FK)
  const updatedPurchItems = await prisma.purchaseItem.updateMany({
    data: { medicine_id: null },
  });
  console.log(`✅ Unlinked medicine_id in ${updatedPurchItems.count} purchase_items`);

  // Step 4: Delete all medicines
  const deletedMedicines = await prisma.medicine.deleteMany({});
  console.log(`✅ Deleted ${deletedMedicines.count} medicine records\n`);

  // Step 5: Seed new medicines
  console.log('💊 Seeding popular Indian medicines...');
  const created = await prisma.medicine.createMany({
    data: MEDICINES,
    skipDuplicates: true,
  });
  console.log(`✅ Created ${created.count} medicines in the catalog\n`);

  // Step 6: Seed shop_inventory for the demo shop (if it exists)
  const demoShop = await prisma.medicalShop.findFirst({
    where: { drug_license_no: 'DEV-DL-001' },
  });

  if (!demoShop) {
    console.log('ℹ️  Demo shop not found — skipping shop_inventory seed.');
    console.log('   Run: npx ts-node prisma/seed-dev-shop.ts first, then re-run this script.');
  } else {
    console.log(`🏪 Seeding inventory for shop: ${demoShop.shop_name}`);

    // Build a name → id map for the newly created medicines
    const medicineMap = new Map<string, string>();
    const allMeds = await prisma.medicine.findMany({ select: { id: true, name: true } });
    for (const m of allMeds) medicineMap.set(m.name, m.id);

    const now = new Date();
    let invCount = 0;

    for (const inv of INVENTORY_SEED) {
      const medicineId = medicineMap.get(inv.medicine_name);
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + inv.expiry_months);

      await prisma.shopInventory.create({
        data: {
          shop_id: demoShop.id,
          medicine_id: medicineId ?? null,
          medicine_name: inv.medicine_name,
          batch_number: inv.batch_number,
          expiry_date: expiryDate,
          mrp: inv.mrp,
          purchase_price: inv.purchase_price,
          gst_rate: inv.gst_rate,
          stock_qty: inv.stock_qty,
          reorder_level: inv.reorder_level,
          unit: inv.unit,
        },
      });
      invCount++;
    }
    console.log(`✅ Created ${invCount} inventory items for ${demoShop.shop_name}\n`);
  }

  console.log('🎉 Inventory reseed complete!');
  console.log(`   Total medicines in catalog : ${created.count}`);
}

main()
  .catch((err) => {
    console.error('❌ Error during inventory seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
