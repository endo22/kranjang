import { PrismaClient } from "@kranjang/db";
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("prd next wave 2", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects low-stock alert when no products are low", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Alert Empty ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };

    const res = await request(app.getHttpServer()).post("/api/v1/alerts/low-stock").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(String(res.body.message)).toMatch(/stok menipis/i);

    await app.close();
  }, 60000);

  it("sends low-stock alert once then debounce within 6 hours", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Alert Debounce ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Sembako" });
    expect(category.status).toBe(201);

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Beras 1kg",
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
      quantity: 2,
      movementType: "INITIAL_STOCK",
      notes: "stok rendah",
    });
    expect(adjusted.status).toBe(201);

    const first = await server.post("/api/v1/alerts/low-stock").set(auth);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      sent: true,
      count: 1,
    });
    expect(Array.isArray(first.body.to)).toBe(true);
    expect(first.body.to.length).toBeGreaterThan(0);

    const second = await server.post("/api/v1/alerts/low-stock").set(auth);
    expect(second.status).toBe(400);
    expect(second.body.code).toBe("VALIDATION_ERROR");
    expect(String(second.body.message)).toMatch(/baru saja dikirim|coba lagi/i);

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: created.body.tenant.id },
    });
    expect(settings?.lastLowStockAlertAt).toBeTruthy();

    await app.close();
  }, 60000);

  it("persists receipt logo url and qr payload on settings", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Receipt ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };

    const patched = await request(app.getHttpServer()).patch("/api/v1/settings").set(auth).send({
      receiptLogoUrl: "https://cdn.example.com/warung.png",
      receiptQrPayload: "https://wa.me/6281234567890",
    });
    expect(patched.status).toBe(200);
    expect(patched.body.receiptLogoUrl).toBe("https://cdn.example.com/warung.png");
    expect(patched.body.receiptQrPayload).toBe("https://wa.me/6281234567890");

    const fetched = await request(app.getHttpServer()).get("/api/v1/settings").set(auth);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({
      receiptLogoUrl: "https://cdn.example.com/warung.png",
      receiptQrPayload: "https://wa.me/6281234567890",
    });

    await app.close();
  }, 60000);
});
