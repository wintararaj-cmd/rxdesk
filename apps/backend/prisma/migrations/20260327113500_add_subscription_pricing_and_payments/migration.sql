-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'successful', 'failed', 'refunded');

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN "price_quarterly" DECIMAL(10,2),
ADD COLUMN "price_halfyearly" DECIMAL(10,2),
ADD COLUMN "price_yearly" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "period_months" INTEGER NOT NULL,
    "payment_method" TEXT NOT NULL,
    "transaction_id" TEXT,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'successful',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "medical_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
