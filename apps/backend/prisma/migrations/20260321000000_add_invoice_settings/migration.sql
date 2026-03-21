-- AddInvoiceSettings
-- Add invoice settings fields to medical_shops table

BEGIN;

-- Create enum type for printer type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "PrinterType" AS ENUM ('thermal', 'a4');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add invoice settings columns to medical_shops table
ALTER TABLE "medical_shops" ADD COLUMN "show_hsn_code" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "medical_shops" ADD COLUMN "show_batch_no" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "medical_shops" ADD COLUMN "printer_type" "PrinterType" NOT NULL DEFAULT 'thermal';

COMMIT;
