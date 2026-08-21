import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { AlertsService } from "../src/alerts/alerts.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("prd path perfect wave 4", () => {
  it("scheduled low-stock run skips empty tenants without throwing", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Cron Empty ${Date.now()}` });
    expect(created.status).toBe(201);

    const alerts = app.get(AlertsService);
    const result = await alerts.runScheduledLowStockAlerts();
    expect(result.tenants).toBeGreaterThan(0);
    expect(result.sent + result.skipped).toBe(result.tenants);

    await app.close();
  }, 60000);

  it("scheduled low-stock sends for a tenant with low stock then respects debounce", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Cron Send ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Sembako" });
    expect(category.status).toBe(201);

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Gula 1kg",
      productType: "SIMPLE",
      unit: "pcs",
      categoryId: category.body.id,
      buyPrice: 10000,
      sellPrice: 12000,
      minStock: 5,
    });
    expect(product.status).toBe(201);

    const adjusted = await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: product.body.id,
      quantity: 1,
      movementType: "INITIAL_STOCK",
      notes: "stok rendah",
    });
    expect(adjusted.status).toBe(201);

    const alerts = app.get(AlertsService);
    const prisma = app.get(PrismaService);

    await prisma.tenantSettings.update({
      where: { tenantId: created.body.tenant.id },
      data: { lastLowStockAlertAt: null },
    });

    const first = await alerts.runScheduledLowStockAlerts();
    expect(first.sent).toBeGreaterThanOrEqual(1);

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: created.body.tenant.id },
    });
    expect(settings?.lastLowStockAlertAt).toBeTruthy();

    const second = await alerts.runScheduledLowStockAlerts();
    expect(second.skipped).toBeGreaterThanOrEqual(1);

    await app.close();
  }, 60000);
});
