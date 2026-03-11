-- CreateTable
CREATE TABLE "sale_returns" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "bill_id" TEXT,
    "customer_name" TEXT,
    "return_date" DATE NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "refund_method" "AccountingPaymentMethod" NOT NULL DEFAULT 'cash',
    "reason" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "batch_number" TEXT,
    "quantity" INTEGER NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sale_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "supplier_id" TEXT,
    "invoice_ref" TEXT,
    "return_date" DATE NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "batch_number" TEXT,
    "quantity" INTEGER NOT NULL,
    "purchase_price" DECIMAL(10,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contra_entries" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "from_account" "AccountingPaymentMethod" NOT NULL,
    "to_account" "AccountingPaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "reference_no" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contra_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_returns_return_number_key" ON "sale_returns"("return_number");

-- CreateIndex
CREATE INDEX "sale_returns_shop_id_return_date_idx" ON "sale_returns"("shop_id", "return_date");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_return_number_key" ON "purchase_returns"("return_number");

-- CreateIndex
CREATE INDEX "purchase_returns_shop_id_return_date_idx" ON "purchase_returns"("shop_id", "return_date");

-- CreateIndex
CREATE INDEX "contra_entries_shop_id_entry_date_idx" ON "contra_entries"("shop_id", "entry_date");

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "medical_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sale_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "medical_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contra_entries" ADD CONSTRAINT "contra_entries_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "medical_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
