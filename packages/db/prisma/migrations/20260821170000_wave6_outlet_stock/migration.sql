-- CreateTable
CREATE TABLE "outlet_stocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "stock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_stocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outlet_stocks_tenant_id_outlet_id_product_id_key" ON "outlet_stocks"("tenant_id", "outlet_id", "product_id");
CREATE INDEX "outlet_stocks_tenant_id_product_id_idx" ON "outlet_stocks"("tenant_id", "product_id");

ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill from product.stock at product.outlet_id
INSERT INTO "outlet_stocks" ("tenant_id", "outlet_id", "product_id", "stock", "updated_at")
SELECT "tenant_id", "outlet_id", "id", "stock", CURRENT_TIMESTAMP
FROM "products"
WHERE "deleted_at" IS NULL
ON CONFLICT ("tenant_id", "outlet_id", "product_id") DO UPDATE SET "stock" = EXCLUDED."stock";

-- Multi-outlet plan limits
UPDATE "subscription_plans" SET "max_outlets" = 3, "feature_multi_outlet" = true WHERE "code" = 'business';
UPDATE "subscription_plans" SET "max_outlets" = 5, "feature_multi_outlet" = true WHERE "code" = 'pro';
