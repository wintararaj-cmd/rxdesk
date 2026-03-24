-- CreateTable
CREATE TABLE "shop_medicines" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "medicine_id" TEXT,
    "medicine_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'strip',
    "rack_location" TEXT,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_medicines_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "shop_inventory" ADD COLUMN "shop_medicine_id" TEXT;

-- CreateIndex
CREATE INDEX "shop_medicines_shop_id_idx" ON "shop_medicines"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_medicines_shop_id_medicine_name_unit_key" ON "shop_medicines"("shop_id", "medicine_name", "unit");

-- AddForeignKey
ALTER TABLE "shop_medicines" ADD CONSTRAINT "shop_medicines_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "medical_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_medicines" ADD CONSTRAINT "shop_medicines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_inventory" ADD CONSTRAINT "shop_inventory_shop_medicine_id_fkey" FOREIGN KEY ("shop_medicine_id") REFERENCES "shop_medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
