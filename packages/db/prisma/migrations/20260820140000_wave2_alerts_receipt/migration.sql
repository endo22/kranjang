-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN "receipt_logo_url" VARCHAR(255);
ALTER TABLE "tenant_settings" ADD COLUMN "receipt_qr_payload" VARCHAR(255);
ALTER TABLE "tenant_settings" ADD COLUMN "last_low_stock_alert_at" TIMESTAMPTZ;
