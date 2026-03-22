-- AlterTable
ALTER TABLE "purchase_returns" ADD COLUMN "purchase_entry_id" TEXT;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_entry_id_fkey" FOREIGN KEY ("purchase_entry_id") REFERENCES "purchase_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
