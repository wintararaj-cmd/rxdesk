-- CreateEnum
CREATE TYPE "GstType" AS ENUM ('unregistered', 'composite', 'regular');

-- AlterTable
ALTER TABLE "medical_shops" ADD COLUMN     "gst_type" "GstType" NOT NULL DEFAULT 'unregistered';
