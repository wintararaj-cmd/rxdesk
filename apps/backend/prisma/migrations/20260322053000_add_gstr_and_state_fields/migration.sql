-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "state" TEXT;

-- AlterTable
ALTER TABLE "bills" ADD COLUMN "customer_gstin" TEXT;
ALTER TABLE "bills" ADD COLUMN "billing_address" TEXT;
ALTER TABLE "bills" ADD COLUMN "billing_state" TEXT;
