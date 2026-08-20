import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("phase 9 block A", () => {
  it("closes cashier session with cash difference summary", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Air Mineral",
      productType: "SIMPLE",
      unit: "botol",
      buyPrice: 2000,
      sellPrice: 5000,
      minStock: 2,
    });
    expect(product.status).toBe(201);

    const adjusted = await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: product.body.id,
      quantity: 10,
      movementType: "INITIAL_STOCK",
      notes: "awal",
    });
    expect(adjusted.status).toBe(201);

    const opened = await server.post("/api/v1/cashier-sessions/open").set(auth).send({ openingCash: 100000 });
    expect(opened.status).toBe(201);

    const sale = await server.post("/api/v1/sales").set(auth).send({
      paymentMethod: "CASH",
      items: [{ productId: product.body.id, quantity: 2 }],
    });
    expect(sale.status).toBe(201);

    const closed = await server.post(`/api/v1/cashier-sessions/${opened.body.id}/close`).set(auth).send({ closingCash: 110000 });
    expect(closed.status).toBe(201);
    expect(closed.body.summary.salesCount).toBe(1);
    expect(closed.body.summary.cashSalesTotal).toBe(10000);
    expect(closed.body.summary.expectedCash).toBe(110000);
    expect(closed.body.summary.cashDifference).toBe(0);

    await app.close();
  }, 60000);
});
