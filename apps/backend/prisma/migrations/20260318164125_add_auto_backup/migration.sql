-- AlterTable
ALTER TABLE "medical_shops" ADD COLUMN     "auto_backup_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "backup_time" TEXT;
