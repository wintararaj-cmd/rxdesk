/**
 * seed-medicine-catalog.ts
 *
 * Seeds the global medicines table with a curated catalog of commonly
 * dispensed Indian medicines. Uses upsert (name-based) so it is safe
 * to re-run on every deployment without creating duplicates.
 *
 * Called automatically by seed.ts during `prisma db seed` / deployment.
 */

import { PrismaClient, MedicineForm } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Catalog ─────────────────────────────────────────────────────────────────
// Format: [name, generic_name, brand_name, form, strength, manufacturer?, gst_rate?, is_schedule_h?]
// gst_rate defaults to 12 (standard pharma GST). OTC analgesics/vitamins are 5%.
// is_schedule_h defaults to false.

type CatalogRow = {
  name: string;
  generic_name: string;
  brand_name: string;
  form: MedicineForm;
  strength: string;
  manufacturer?: string;
  gst_rate?: number;
  is_schedule_h?: boolean;
};

const CATALOG: CatalogRow[] = [
  // ── Analgesics / Antipyretics ─────────────────────────────────────────────
  { name: 'Paracetamol 500mg Tab', generic_name: 'Paracetamol', brand_name: 'Crocin', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'GSK', gst_rate: 5 },
  { name: 'Paracetamol 650mg Tab', generic_name: 'Paracetamol', brand_name: 'Dolo 650', form: MedicineForm.tablet, strength: '650mg', manufacturer: 'Micro Labs', gst_rate: 5 },
  { name: 'Paracetamol 125mg Syrup', generic_name: 'Paracetamol', brand_name: 'Calpol', form: MedicineForm.syrup, strength: '125mg/5ml', manufacturer: 'GSK', gst_rate: 5 },
  { name: 'Ibuprofen 400mg Tab', generic_name: 'Ibuprofen', brand_name: 'Brufen', form: MedicineForm.tablet, strength: '400mg', manufacturer: 'Abbott', gst_rate: 5 },
  { name: 'Ibuprofen 200mg Syrup', generic_name: 'Ibuprofen', brand_name: 'Ibugesic Plus', form: MedicineForm.syrup, strength: '100mg/5ml', manufacturer: 'Cipla', gst_rate: 5 },
  { name: 'Diclofenac 50mg Tab', generic_name: 'Diclofenac Sodium', brand_name: 'Voveran', form: MedicineForm.tablet, strength: '50mg', manufacturer: 'Novartis', gst_rate: 12, is_schedule_h: true },
  { name: 'Diclofenac 100mg SR Tab', generic_name: 'Diclofenac Sodium', brand_name: 'Voveran SR', form: MedicineForm.tablet, strength: '100mg SR', manufacturer: 'Novartis', gst_rate: 12, is_schedule_h: true },
  { name: 'Aceclofenac 100mg Tab', generic_name: 'Aceclofenac', brand_name: 'Zerodol', form: MedicineForm.tablet, strength: '100mg', manufacturer: 'IPCA', gst_rate: 12, is_schedule_h: true },
  { name: 'Nimesulide 100mg Tab', generic_name: 'Nimesulide', brand_name: 'Nimulid', form: MedicineForm.tablet, strength: '100mg', manufacturer: 'Panacea Biotec', gst_rate: 12, is_schedule_h: true },
  { name: 'Tramadol 50mg Cap', generic_name: 'Tramadol HCl', brand_name: 'Ultracet', form: MedicineForm.capsule, strength: '50mg', manufacturer: 'Janssen', gst_rate: 12, is_schedule_h: true },
  { name: 'Mefenamic Acid 500mg Tab', generic_name: 'Mefenamic Acid', brand_name: 'Meftal', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'Aristo', gst_rate: 12, is_schedule_h: true },
  { name: 'Ketorolac 30mg/1ml Inj', generic_name: 'Ketorolac Tromethamine', brand_name: 'Ketanov', form: MedicineForm.injection, strength: '30mg/1ml', manufacturer: 'Sun Pharma', gst_rate: 12, is_schedule_h: true },

  // ── Antibiotics ───────────────────────────────────────────────────────────
  { name: 'Amoxicillin 500mg Cap', generic_name: 'Amoxicillin', brand_name: 'Mox', form: MedicineForm.capsule, strength: '500mg', manufacturer: 'Ranbaxy', gst_rate: 12, is_schedule_h: true },
  { name: 'Amoxicillin 250mg/5ml Syrup', generic_name: 'Amoxicillin', brand_name: 'Moxikind', form: MedicineForm.syrup, strength: '250mg/5ml', manufacturer: 'Mankind', gst_rate: 12, is_schedule_h: true },
  { name: 'Amoxicillin+Clavulanate 625mg Tab', generic_name: 'Amoxicillin+Clavulanic Acid', brand_name: 'Augmentin', form: MedicineForm.tablet, strength: '500mg+125mg', manufacturer: 'GSK', gst_rate: 12, is_schedule_h: true },
  { name: 'Azithromycin 500mg Tab', generic_name: 'Azithromycin', brand_name: 'Azithral', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'Alembic', gst_rate: 12, is_schedule_h: true },
  { name: 'Azithromycin 250mg Tab', generic_name: 'Azithromycin', brand_name: 'Zithromax', form: MedicineForm.tablet, strength: '250mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Ciprofloxacin 500mg Tab', generic_name: 'Ciprofloxacin HCl', brand_name: 'Ciplox', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Levofloxacin 500mg Tab', generic_name: 'Levofloxacin', brand_name: 'Levobact', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'Sun Pharma', gst_rate: 12, is_schedule_h: true },
  { name: 'Ofloxacin 200mg Tab', generic_name: 'Ofloxacin', brand_name: 'Zanocin', form: MedicineForm.tablet, strength: '200mg', manufacturer: 'Sun Pharma', gst_rate: 12, is_schedule_h: true },
  { name: 'Doxycycline 100mg Cap', generic_name: 'Doxycycline HCl', brand_name: 'Doxy 1', form: MedicineForm.capsule, strength: '100mg', manufacturer: 'Aristo', gst_rate: 12, is_schedule_h: true },
  { name: 'Metronidazole 400mg Tab', generic_name: 'Metronidazole', brand_name: 'Flagyl', form: MedicineForm.tablet, strength: '400mg', manufacturer: 'Abbott', gst_rate: 12, is_schedule_h: true },
  { name: 'Metronidazole 200mg Syrup', generic_name: 'Metronidazole', brand_name: 'Metrogyl', form: MedicineForm.syrup, strength: '200mg/5ml', manufacturer: 'Abbott', gst_rate: 12, is_schedule_h: true },
  { name: 'Cefixime 200mg Tab', generic_name: 'Cefixime', brand_name: 'Taxim-O', form: MedicineForm.tablet, strength: '200mg', manufacturer: 'Alkem', gst_rate: 12, is_schedule_h: true },
  { name: 'Cefixime 100mg Syrup', generic_name: 'Cefixime', brand_name: 'Cefi', form: MedicineForm.syrup, strength: '100mg/5ml', manufacturer: 'Lupin', gst_rate: 12, is_schedule_h: true },
  { name: 'Cephalexin 500mg Cap', generic_name: 'Cefalexin', brand_name: 'Sporidex', form: MedicineForm.capsule, strength: '500mg', manufacturer: 'Ranbaxy', gst_rate: 12, is_schedule_h: true },
  { name: 'Clarithromycin 500mg Tab', generic_name: 'Clarithromycin', brand_name: 'Claribid', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'Abbott', gst_rate: 12, is_schedule_h: true },
  { name: 'Clindamycin 300mg Cap', generic_name: 'Clindamycin HCl', brand_name: 'Dalacin C', form: MedicineForm.capsule, strength: '300mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Rifampicin 450mg Cap', generic_name: 'Rifampicin', brand_name: 'Rimactane', form: MedicineForm.capsule, strength: '450mg', manufacturer: 'Novartis', gst_rate: 12, is_schedule_h: true },
  { name: 'Isoniazid 300mg Tab', generic_name: 'Isoniazid', brand_name: 'Rcinex', form: MedicineForm.tablet, strength: '300mg', manufacturer: 'Lupin', gst_rate: 12, is_schedule_h: true },
  { name: 'Co-Trimoxazole 480mg Tab', generic_name: 'Trimethoprim+Sulfamethoxazole', brand_name: 'Bactrim', form: MedicineForm.tablet, strength: '80mg+400mg', manufacturer: 'Roche', gst_rate: 12, is_schedule_h: true },

  // ── Anti-diabetics ────────────────────────────────────────────────────────
  { name: 'Metformin 500mg Tab', generic_name: 'Metformin HCl', brand_name: 'Glycomet', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'USV', gst_rate: 12, is_schedule_h: true },
  { name: 'Metformin 850mg Tab', generic_name: 'Metformin HCl', brand_name: 'Glycomet 850', form: MedicineForm.tablet, strength: '850mg', manufacturer: 'USV', gst_rate: 12, is_schedule_h: true },
  { name: 'Metformin 1000mg SR Tab', generic_name: 'Metformin HCl', brand_name: 'Glycomet GP', form: MedicineForm.tablet, strength: '1000mg SR', manufacturer: 'USV', gst_rate: 12, is_schedule_h: true },
  { name: 'Glimepiride 1mg Tab', generic_name: 'Glimepiride', brand_name: 'Amaryl', form: MedicineForm.tablet, strength: '1mg', manufacturer: 'Sanofi', gst_rate: 12, is_schedule_h: true },
  { name: 'Glimepiride 2mg Tab', generic_name: 'Glimepiride', brand_name: 'Amaryl 2', form: MedicineForm.tablet, strength: '2mg', manufacturer: 'Sanofi', gst_rate: 12, is_schedule_h: true },
  { name: 'Sitagliptin 100mg Tab', generic_name: 'Sitagliptin Phosphate', brand_name: 'Januvia', form: MedicineForm.tablet, strength: '100mg', manufacturer: 'MSD', gst_rate: 12, is_schedule_h: true },
  { name: 'Dapagliflozin 10mg Tab', generic_name: 'Dapagliflozin', brand_name: 'Forxiga', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'AstraZeneca', gst_rate: 12, is_schedule_h: true },
  { name: 'Empagliflozin 10mg Tab', generic_name: 'Empagliflozin', brand_name: 'Jardiance', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Boehringer', gst_rate: 12, is_schedule_h: true },
  { name: 'Voglibose 0.3mg Tab', generic_name: 'Voglibose', brand_name: 'Volix', form: MedicineForm.tablet, strength: '0.3mg', manufacturer: 'Ranbaxy', gst_rate: 12, is_schedule_h: true },
  { name: 'Insulin Glargine 100U/ml Inj', generic_name: 'Insulin Glargine', brand_name: 'Lantus', form: MedicineForm.injection, strength: '100U/ml', manufacturer: 'Sanofi', gst_rate: 5, is_schedule_h: true },
  { name: 'Insulin Human Mixtard 30/70 Inj', generic_name: 'Insulin (Human)', brand_name: 'Mixtard 30', form: MedicineForm.injection, strength: '100U/ml', manufacturer: 'Novo Nordisk', gst_rate: 5, is_schedule_h: true },

  // ── Cardiovascular ────────────────────────────────────────────────────────
  { name: 'Amlodipine 5mg Tab', generic_name: 'Amlodipine Besylate', brand_name: 'Amlip', form: MedicineForm.tablet, strength: '5mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Amlodipine 10mg Tab', generic_name: 'Amlodipine Besylate', brand_name: 'Amlogard', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Atenolol 50mg Tab', generic_name: 'Atenolol', brand_name: 'Tenormin', form: MedicineForm.tablet, strength: '50mg', manufacturer: 'IPL', gst_rate: 12, is_schedule_h: true },
  { name: 'Metoprolol 25mg Tab', generic_name: 'Metoprolol Succinate', brand_name: 'Metolar XR', form: MedicineForm.tablet, strength: '25mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Metoprolol 50mg Tab', generic_name: 'Metoprolol Succinate', brand_name: 'Metolar XR 50', form: MedicineForm.tablet, strength: '50mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Losartan 50mg Tab', generic_name: 'Losartan Potassium', brand_name: 'Losar', form: MedicineForm.tablet, strength: '50mg', manufacturer: 'IPCA', gst_rate: 12, is_schedule_h: true },
  { name: 'Telmisartan 40mg Tab', generic_name: 'Telmisartan', brand_name: 'Telsartan', form: MedicineForm.tablet, strength: '40mg', manufacturer: 'Dr. Reddy\'s', gst_rate: 12, is_schedule_h: true },
  { name: 'Telmisartan 80mg Tab', generic_name: 'Telmisartan', brand_name: 'Telmikind', form: MedicineForm.tablet, strength: '80mg', manufacturer: 'Mankind', gst_rate: 12, is_schedule_h: true },
  { name: 'Ramipril 5mg Cap', generic_name: 'Ramipril', brand_name: 'Cardace', form: MedicineForm.capsule, strength: '5mg', manufacturer: 'Aventis', gst_rate: 12, is_schedule_h: true },
  { name: 'Atorvastatin 10mg Tab', generic_name: 'Atorvastatin Calcium', brand_name: 'Atorva', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Zydus', gst_rate: 12, is_schedule_h: true },
  { name: 'Atorvastatin 20mg Tab', generic_name: 'Atorvastatin Calcium', brand_name: 'Lipitor', form: MedicineForm.tablet, strength: '20mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Rosuvastatin 10mg Tab', generic_name: 'Rosuvastatin Calcium', brand_name: 'Rozavel', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Sun Pharma', gst_rate: 12, is_schedule_h: true },
  { name: 'Aspirin 75mg Tab', generic_name: 'Aspirin', brand_name: 'Ecosprin', form: MedicineForm.tablet, strength: '75mg', manufacturer: 'USV', gst_rate: 5 },
  { name: 'Aspirin 150mg Tab', generic_name: 'Aspirin', brand_name: 'Ecosprin 150', form: MedicineForm.tablet, strength: '150mg', manufacturer: 'USV', gst_rate: 5 },
  { name: 'Clopidogrel 75mg Tab', generic_name: 'Clopidogrel Bisulfate', brand_name: 'Plavix', form: MedicineForm.tablet, strength: '75mg', manufacturer: 'Sanofi', gst_rate: 12, is_schedule_h: true },
  { name: 'Nitroglycerin 0.5mg SL Tab', generic_name: 'Nitroglycerin', brand_name: 'Nitrostat', form: MedicineForm.tablet, strength: '0.5mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Furosemide 40mg Tab', generic_name: 'Furosemide', brand_name: 'Lasix', form: MedicineForm.tablet, strength: '40mg', manufacturer: 'Sanofi', gst_rate: 12, is_schedule_h: true },
  { name: 'Digoxin 0.25mg Tab', generic_name: 'Digoxin', brand_name: 'Lanoxin', form: MedicineForm.tablet, strength: '0.25mg', manufacturer: 'GSK', gst_rate: 12, is_schedule_h: true },

  // ── Proton Pump Inhibitors / GI ───────────────────────────────────────────
  { name: 'Omeprazole 20mg Cap', generic_name: 'Omeprazole', brand_name: 'Omez', form: MedicineForm.capsule, strength: '20mg', manufacturer: 'Dr. Reddy\'s', gst_rate: 12, is_schedule_h: true },
  { name: 'Pantoprazole 40mg Tab', generic_name: 'Pantoprazole Sodium', brand_name: 'Pan 40', form: MedicineForm.tablet, strength: '40mg', manufacturer: 'Alkem', gst_rate: 12, is_schedule_h: true },
  { name: 'Pantoprazole 20mg Tab', generic_name: 'Pantoprazole Sodium', brand_name: 'Pan 20', form: MedicineForm.tablet, strength: '20mg', manufacturer: 'Alkem', gst_rate: 12, is_schedule_h: true },
  { name: 'Rabeprazole 20mg Tab', generic_name: 'Rabeprazole Sodium', brand_name: 'Razo', form: MedicineForm.tablet, strength: '20mg', manufacturer: 'Dr. Reddy\'s', gst_rate: 12, is_schedule_h: true },
  { name: 'Ranitidine 150mg Tab', generic_name: 'Ranitidine HCl', brand_name: 'Zinetac', form: MedicineForm.tablet, strength: '150mg', manufacturer: 'GSK', gst_rate: 12, is_schedule_h: true },
  { name: 'Domperidone 10mg Tab', generic_name: 'Domperidone', brand_name: 'Domstal', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Torrent', gst_rate: 12, is_schedule_h: true },
  { name: 'Ondansetron 4mg Tab', generic_name: 'Ondansetron HCl', brand_name: 'Emeset', form: MedicineForm.tablet, strength: '4mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Metoclopramide 10mg Tab', generic_name: 'Metoclopramide', brand_name: 'Reglan', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Loperamide 2mg Cap', generic_name: 'Loperamide HCl', brand_name: 'Lopamide', form: MedicineForm.capsule, strength: '2mg', manufacturer: 'Janssen', gst_rate: 12 },
  { name: 'ORS Powder Sachet', generic_name: 'Oral Rehydration Salts', brand_name: 'Electral', form: MedicineForm.powder, strength: 'WHO Formula', manufacturer: 'FDC', gst_rate: 5 },
  { name: 'Lactulose 10g/15ml Syrup', generic_name: 'Lactulose', brand_name: 'Duphalac', form: MedicineForm.syrup, strength: '10g/15ml', manufacturer: 'Abbott', gst_rate: 12, is_schedule_h: true },

  // ── Respiratory ───────────────────────────────────────────────────────────
  { name: 'Salbutamol 100mcg Inhaler', generic_name: 'Salbutamol Sulfate', brand_name: 'Asthalin', form: MedicineForm.inhaler, strength: '100mcg/dose', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Budesonide 200mcg Inhaler', generic_name: 'Budesonide', brand_name: 'Budecort', form: MedicineForm.inhaler, strength: '200mcg/dose', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Fluticasone 125mcg Inhaler', generic_name: 'Fluticasone Propionate', brand_name: 'Flohale', form: MedicineForm.inhaler, strength: '125mcg/dose', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Montelukast 10mg Tab', generic_name: 'Montelukast Sodium', brand_name: 'Montair', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Montelukast+Levocetirizine Tab', generic_name: 'Montelukast+Levocetirizine', brand_name: 'Montair LC', form: MedicineForm.tablet, strength: '10mg+5mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Tiotropium 18mcg Inhaler', generic_name: 'Tiotropium Bromide', brand_name: 'Spiriva', form: MedicineForm.inhaler, strength: '18mcg/dose', manufacturer: 'Boehringer', gst_rate: 12, is_schedule_h: true },
  { name: 'Theophylline 300mg SR Tab', generic_name: 'Theophylline', brand_name: 'Theo-SR', form: MedicineForm.tablet, strength: '300mg SR', manufacturer: 'Wockhardt', gst_rate: 12, is_schedule_h: true },
  { name: 'Ambroxol 30mg Tab', generic_name: 'Ambroxol HCl', brand_name: 'Ambrolite', form: MedicineForm.tablet, strength: '30mg', manufacturer: 'Roche', gst_rate: 12 },
  { name: 'Bromhexine 8mg Tab', generic_name: 'Bromhexine HCl', brand_name: 'Bisolvon', form: MedicineForm.tablet, strength: '8mg', manufacturer: 'Boehringer', gst_rate: 12 },
  { name: 'Dextromethorphan 15mg Syrup', generic_name: 'Dextromethorphan HBr', brand_name: 'Alex', form: MedicineForm.syrup, strength: '15mg/5ml', manufacturer: 'Dabur', gst_rate: 12 },

  // ── Antihistamines ────────────────────────────────────────────────────────
  { name: 'Cetirizine 10mg Tab', generic_name: 'Cetirizine HCl', brand_name: 'Cetzine', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'UCB', gst_rate: 12 },
  { name: 'Levocetirizine 5mg Tab', generic_name: 'Levocetirizine HCl', brand_name: 'Xyzal', form: MedicineForm.tablet, strength: '5mg', manufacturer: 'UCB', gst_rate: 12 },
  { name: 'Fexofenadine 120mg Tab', generic_name: 'Fexofenadine HCl', brand_name: 'Allegra', form: MedicineForm.tablet, strength: '120mg', manufacturer: 'Sanofi', gst_rate: 12 },
  { name: 'Chlorpheniramine 4mg Tab', generic_name: 'Chlorpheniramine Maleate', brand_name: 'Piriton', form: MedicineForm.tablet, strength: '4mg', manufacturer: 'GSK', gst_rate: 12 },

  // ── Vitamins & Minerals ───────────────────────────────────────────────────
  { name: 'Vitamin D3 60000IU Cap', generic_name: 'Cholecalciferol', brand_name: 'D-Rise 60K', form: MedicineForm.capsule, strength: '60000 IU', manufacturer: 'USV', gst_rate: 5 },
  { name: 'Vitamin D3 1000IU Tab', generic_name: 'Cholecalciferol', brand_name: 'D-Rise', form: MedicineForm.tablet, strength: '1000 IU', manufacturer: 'USV', gst_rate: 5 },
  { name: 'Calcium+D3 500mg Tab', generic_name: 'Calcium Carbonate+Vit D3', brand_name: 'Shelcal', form: MedicineForm.tablet, strength: '500mg+250IU', manufacturer: 'Elder', gst_rate: 5 },
  { name: 'Vitamin B12 1500mcg Tab', generic_name: 'Methylcobalamin', brand_name: 'Methylcobal', form: MedicineForm.tablet, strength: '1500mcg', manufacturer: 'Macleods', gst_rate: 5 },
  { name: 'B-Complex Tab', generic_name: 'Vitamin B Complex', brand_name: 'Becosules', form: MedicineForm.tablet, strength: 'Standard', manufacturer: 'Pfizer', gst_rate: 5 },
  { name: 'Multivitamin Tab', generic_name: 'Multivitamins+Minerals', brand_name: 'Supradyn', form: MedicineForm.tablet, strength: 'Standard', manufacturer: 'Bayer', gst_rate: 5 },
  { name: 'Zinc 50mg Tab', generic_name: 'Zinc Sulfate', brand_name: 'Zincovit', form: MedicineForm.tablet, strength: '50mg', manufacturer: 'Apex', gst_rate: 5 },
  { name: 'Iron Folic Acid Tab', generic_name: 'Ferrous Sulfate+Folic Acid', brand_name: 'Autrin', form: MedicineForm.tablet, strength: '150mg+0.5mg', manufacturer: 'Pfizer', gst_rate: 5 },
  { name: 'Ferrous Ascorbate 100mg Tab', generic_name: 'Ferrous Ascorbate+Folic Acid', brand_name: 'Orofer XT', form: MedicineForm.tablet, strength: '100mg', manufacturer: 'Emcure', gst_rate: 5 },
  { name: 'Vitamin C 500mg Tab', generic_name: 'Ascorbic Acid', brand_name: 'Limcee', form: MedicineForm.tablet, strength: '500mg', manufacturer: 'Abbott', gst_rate: 5 },

  // ── Neurological / Psychiatric ───────────────────────────────────────────
  { name: 'Gabapentin 300mg Cap', generic_name: 'Gabapentin', brand_name: 'Gabapin', form: MedicineForm.capsule, strength: '300mg', manufacturer: 'Intas', gst_rate: 12, is_schedule_h: true },
  { name: 'Pregabalin 75mg Cap', generic_name: 'Pregabalin', brand_name: 'Lyrica', form: MedicineForm.capsule, strength: '75mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Amitriptyline 10mg Tab', generic_name: 'Amitriptyline HCl', brand_name: 'Tryptomer', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Merind', gst_rate: 12, is_schedule_h: true },
  { name: 'Escitalopram 10mg Tab', generic_name: 'Escitalopram Oxalate', brand_name: 'Nexito', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Sun Pharma', gst_rate: 12, is_schedule_h: true },
  { name: 'Sertraline 50mg Tab', generic_name: 'Sertraline HCl', brand_name: 'Daxid', form: MedicineForm.tablet, strength: '50mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Alprazolam 0.25mg Tab', generic_name: 'Alprazolam', brand_name: 'Alprax', form: MedicineForm.tablet, strength: '0.25mg', manufacturer: 'Torrent', gst_rate: 12, is_schedule_h: true },
  { name: 'Clonazepam 0.5mg Tab', generic_name: 'Clonazepam', brand_name: 'Epitril', form: MedicineForm.tablet, strength: '0.5mg', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Diazepam 5mg Tab', generic_name: 'Diazepam', brand_name: 'Valium', form: MedicineForm.tablet, strength: '5mg', manufacturer: 'Roche', gst_rate: 12, is_schedule_h: true },

  // ── Thyroid ───────────────────────────────────────────────────────────────
  { name: 'Levothyroxine 50mcg Tab', generic_name: 'Levothyroxine Sodium', brand_name: 'Thyronorm', form: MedicineForm.tablet, strength: '50mcg', manufacturer: 'Abbott', gst_rate: 12, is_schedule_h: true },
  { name: 'Levothyroxine 100mcg Tab', generic_name: 'Levothyroxine Sodium', brand_name: 'Eltroxin', form: MedicineForm.tablet, strength: '100mcg', manufacturer: 'GSK', gst_rate: 12, is_schedule_h: true },
  { name: 'Carbimazole 5mg Tab', generic_name: 'Carbimazole', brand_name: 'Neomercazole', form: MedicineForm.tablet, strength: '5mg', manufacturer: 'Nicholas', gst_rate: 12, is_schedule_h: true },

  // ── Dermatology ───────────────────────────────────────────────────────────
  { name: 'Betamethasone 0.1% Cream', generic_name: 'Betamethasone Valerate', brand_name: 'Beta', form: MedicineForm.ointment, strength: '0.1% w/w', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Clotrimazole 1% Cream', generic_name: 'Clotrimazole', brand_name: 'Candid', form: MedicineForm.ointment, strength: '1% w/w', manufacturer: 'Glenmark', gst_rate: 12 },
  { name: 'Mupirocin 2% Ointment', generic_name: 'Mupirocin', brand_name: 'Bactroban', form: MedicineForm.ointment, strength: '2% w/w', manufacturer: 'GSK', gst_rate: 12, is_schedule_h: true },
  { name: 'Ketoconazole 2% Cream', generic_name: 'Ketoconazole', brand_name: 'Nizoral', form: MedicineForm.ointment, strength: '2% w/w', manufacturer: 'Janssen', gst_rate: 12, is_schedule_h: true },
  { name: 'Calamine Lotion', generic_name: 'Calamine', brand_name: 'Lacto Calamine', form: MedicineForm.ointment, strength: 'Standard', manufacturer: 'Piramal', gst_rate: 5 },

  // ── Ophthalmics / ENT ─────────────────────────────────────────────────────
  { name: 'Ciprofloxacin 0.3% Eye Drops', generic_name: 'Ciprofloxacin HCl', brand_name: 'Ciplox Eye', form: MedicineForm.drops, strength: '0.3% w/v', manufacturer: 'Cipla', gst_rate: 12, is_schedule_h: true },
  { name: 'Ofloxacin 0.3% Eye Drops', generic_name: 'Ofloxacin', brand_name: 'Ocuflox', form: MedicineForm.drops, strength: '0.3% w/v', manufacturer: 'Sun Pharma', gst_rate: 12, is_schedule_h: true },
  { name: 'Sodium Chloride 0.9% Eye Drops', generic_name: 'Sodium Chloride', brand_name: 'TiViS', form: MedicineForm.drops, strength: '0.9% w/v', manufacturer: 'Sun Pharma', gst_rate: 5 },
  { name: 'Xylometazoline 0.1% Nasal Drops', generic_name: 'Xylometazoline HCl', brand_name: 'Otrivin', form: MedicineForm.drops, strength: '0.1% w/v', manufacturer: 'Novartis', gst_rate: 12 },

  // ── Antimalarials ─────────────────────────────────────────────────────────
  { name: 'Chloroquine 250mg Tab', generic_name: 'Chloroquine Phosphate', brand_name: 'Lariago', form: MedicineForm.tablet, strength: '250mg', manufacturer: 'IPCA', gst_rate: 12, is_schedule_h: true },
  { name: 'Hydroxychloroquine 200mg Tab', generic_name: 'Hydroxychloroquine Sulfate', brand_name: 'HCQS', form: MedicineForm.tablet, strength: '200mg', manufacturer: 'IPCA', gst_rate: 12, is_schedule_h: true },
  { name: 'Artemether+Lumefantrine Tab', generic_name: 'Artemether+Lumefantrine', brand_name: 'Coartem', form: MedicineForm.tablet, strength: '20mg+120mg', manufacturer: 'Novartis', gst_rate: 12, is_schedule_h: true },

  // ── Antivirals ────────────────────────────────────────────────────────────
  { name: 'Acyclovir 400mg Tab', generic_name: 'Acyclovir', brand_name: 'Zovirax', form: MedicineForm.tablet, strength: '400mg', manufacturer: 'GSK', gst_rate: 12, is_schedule_h: true },
  { name: 'Oseltamivir 75mg Cap', generic_name: 'Oseltamivir Phosphate', brand_name: 'Tamiflu', form: MedicineForm.capsule, strength: '75mg', manufacturer: 'Roche', gst_rate: 12, is_schedule_h: true },

  // ── Other commonly dispensed ──────────────────────────────────────────────
  { name: 'Prednisolone 5mg Tab', generic_name: 'Prednisolone', brand_name: 'Wysolone', form: MedicineForm.tablet, strength: '5mg', manufacturer: 'Wyeth', gst_rate: 12, is_schedule_h: true },
  { name: 'Prednisolone 10mg Tab', generic_name: 'Prednisolone', brand_name: 'Omnacortil 10', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Macleods', gst_rate: 12, is_schedule_h: true },
  { name: 'Dexamethasone 0.5mg Tab', generic_name: 'Dexamethasone', brand_name: 'Decadron', form: MedicineForm.tablet, strength: '0.5mg', manufacturer: 'MSD', gst_rate: 12, is_schedule_h: true },
  { name: 'Spironolactone 25mg Tab', generic_name: 'Spironolactone', brand_name: 'Aldactone', form: MedicineForm.tablet, strength: '25mg', manufacturer: 'Pfizer', gst_rate: 12, is_schedule_h: true },
  { name: 'Allopurinol 100mg Tab', generic_name: 'Allopurinol', brand_name: 'Zyloric', form: MedicineForm.tablet, strength: '100mg', manufacturer: 'GSK', gst_rate: 12, is_schedule_h: true },
  { name: 'Colchicine 0.5mg Tab', generic_name: 'Colchicine', brand_name: 'Colchicineos', form: MedicineForm.tablet, strength: '0.5mg', manufacturer: 'Nicolas Piramal', gst_rate: 12, is_schedule_h: true },
  { name: 'Hydroxyzine 25mg Tab', generic_name: 'Hydroxyzine HCl', brand_name: 'Atarax', form: MedicineForm.tablet, strength: '25mg', manufacturer: 'UCB', gst_rate: 12, is_schedule_h: true },
  { name: 'Dicyclomine 10mg Tab', generic_name: 'Dicyclomine HCl', brand_name: 'Cyclopam', form: MedicineForm.tablet, strength: '10mg', manufacturer: 'Indoco', gst_rate: 12 },
  { name: 'Normal Saline 100ml Inj', generic_name: 'Sodium Chloride 0.9%', brand_name: 'Baxter NS', form: MedicineForm.injection, strength: '0.9% 100ml', manufacturer: 'Baxter', gst_rate: 5 },
  { name: 'Dextrose 5% 500ml Inj', generic_name: 'Dextrose 5%', brand_name: 'D5W', form: MedicineForm.injection, strength: '5% 500ml', manufacturer: 'Fresenius', gst_rate: 5 },
  { name: 'Povidone Iodine 5% Ointment', generic_name: 'Povidone Iodine', brand_name: 'Betadine', form: MedicineForm.ointment, strength: '5% w/w', manufacturer: 'Win Medicare', gst_rate: 12 },
  { name: 'Chlorhexidine 0.2% Mouth Wash', generic_name: 'Chlorhexidine Gluconate', brand_name: 'Hexidine', form: MedicineForm.syrup, strength: '0.2% w/v', manufacturer: 'ICPA', gst_rate: 12 },
];

// ─── Upsert function ──────────────────────────────────────────────────────────
export async function seedMedicineCatalog(): Promise<void> {
  console.log(`\n💊 Seeding medicine catalog (${CATALOG.length} medicines)…`);

  let created = 0;
  let updated = 0;

  for (const med of CATALOG) {
    const data = {
      generic_name: med.generic_name,
      brand_name: med.brand_name,
      form: med.form,
      strength: med.strength,
      manufacturer: med.manufacturer ?? null,
      gst_rate: med.gst_rate ?? 12,
      is_schedule_h: med.is_schedule_h ?? false,
      is_active: true,
    };

    const result = await prisma.medicine.upsert({
      where: { name: med.name },
      update: data,
      create: { name: med.name, ...data },
    });

    // Prisma upsert doesn't tell us if it created or updated, so we track via created_at
    const wasCreated = result.created_at.getTime() > Date.now() - 5000;
    if (wasCreated) created++; else updated++;
  }

  console.log(`   ✅ ${created} created, ${updated} already existed (refreshed)`);
}

// ─── Standalone entrypoint ────────────────────────────────────────────────────
if (require.main === module) {
  seedMedicineCatalog()
    .catch((err) => {
      console.error('❌ Medicine catalog seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
