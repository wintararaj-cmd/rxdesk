/*
  Warnings:

  - You are about to drop the column `discount_pct` on the `bill_items` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'amount');

-- DropIndex
DROP INDEX "medicines_name_idx";

-- AlterTable
ALTER TABLE "bill_items" DROP COLUMN "discount_pct",
ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'percentage',
ADD COLUMN     "discount_value" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shop_inventory" ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'percentage',
ADD COLUMN     "discount_value" DECIMAL(10,2) NOT NULL DEFAULT 0;
