-- Dining tables
CREATE TABLE "dining_tables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dining_tables_tenant_id_outlet_id_name_key" ON "dining_tables"("tenant_id", "outlet_id", "name");
CREATE INDEX "dining_tables_tenant_id_outlet_id_is_active_idx" ON "dining_tables"("tenant_id", "outlet_id", "is_active");

ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sale holds
CREATE TABLE "sale_holds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "dining_table_id" UUID,
    "cashier_session_id" UUID,
    "cashier_id" UUID NOT NULL,
    "customer_id" UUID,
    "status" VARCHAR(20) NOT NULL,
    "discount_amount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_holds_tenant_id_outlet_id_status_idx" ON "sale_holds"("tenant_id", "outlet_id", "status");
CREATE INDEX "sale_holds_tenant_id_dining_table_id_status_idx" ON "sale_holds"("tenant_id", "dining_table_id", "status");

ALTER TABLE "sale_holds" ADD CONSTRAINT "sale_holds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_holds" ADD CONSTRAINT "sale_holds_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_holds" ADD CONSTRAINT "sale_holds_dining_table_id_fkey" FOREIGN KEY ("dining_table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_holds" ADD CONSTRAINT "sale_holds_cashier_session_id_fkey" FOREIGN KEY ("cashier_session_id") REFERENCES "cashier_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_holds" ADD CONSTRAINT "sale_holds_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_holds" ADD CONSTRAINT "sale_holds_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sale_hold_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "hold_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(19,2) NOT NULL,
    "discount_amount" DECIMAL(19,2) NOT NULL DEFAULT 0,

    CONSTRAINT "sale_hold_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sale_hold_items" ADD CONSTRAINT "sale_hold_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_hold_items" ADD CONSTRAINT "sale_hold_items_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "sale_holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_hold_items" ADD CONSTRAINT "sale_hold_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sale links
ALTER TABLE "sales" ADD COLUMN "dining_table_id" UUID;
ALTER TABLE "sales" ADD COLUMN "sale_hold_id" UUID;

CREATE UNIQUE INDEX "sales_sale_hold_id_key" ON "sales"("sale_hold_id");

ALTER TABLE "sales" ADD CONSTRAINT "sales_dining_table_id_fkey" FOREIGN KEY ("dining_table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_sale_hold_id_fkey" FOREIGN KEY ("sale_hold_id") REFERENCES "sale_holds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
