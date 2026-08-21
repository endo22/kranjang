import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("prd next wave 1", () => {
  it("stores targetMargin and returns profitability vs target", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Minuman" });
    expect(category.status).toBe(201);

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Es Teh",
      productType: "SIMPLE",
      unit: "cup",
      categoryId: category.body.id,
      buyPrice: 2000,
      sellPrice: 10000,
      targetMargin: 50,
    });
    expect(product.status).toBe(201);
    expect(product.body.targetMargin).toBe(50);

    const patched = await server.patch(`/api/v1/products/${product.body.id}`).set(auth).send({ targetMargin: 60 });
    expect(patched.status).toBe(200);
    expect(patched.body.targetMargin).toBe(60);

    const adjusted = await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: product.body.id,
      quantity: 10,
      movementType: "INITIAL_STOCK",
      notes: "stok awal",
    });
    expect(adjusted.status).toBe(201);

    const opened = await server.post("/api/v1/cashier-sessions/open").set(auth).send({ openingCash: 10000 });
    expect(opened.status).toBe(201);

    const sale = await server.post("/api/v1/sales").set(auth).send({
      paymentMethod: "CASH",
      items: [{ productId: product.body.id, quantity: 1 }],
    });
    expect(sale.status).toBe(201);

    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const report = await server.get(`/api/v1/reports/product-profitability?from=${today}&to=${today}`).set(auth);
    expect(report.status).toBe(200);
    const row = report.body.productProfitability.find((item: { name: string }) => item.name === "Es Teh");
    expect(row).toMatchObject({
      targetMargin: 60,
      margin: expect.any(Number),
      vsTarget: expect.any(Number),
    });

    await app.close();
  }, 60000);
});
