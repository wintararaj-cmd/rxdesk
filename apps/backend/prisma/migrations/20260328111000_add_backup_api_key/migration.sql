-- AlterTable
ALTER TABLE "medical_shops" ADD COLUMN "backup_api_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "medical_shops_backup_api_key_key" ON "medical_shops"("backup_api_key");
