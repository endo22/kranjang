import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("phase 9 block b", () => {
  it("cancels draft purchase, rejects cancel after receive, cancels sale with reason", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Dapur" });
    expect(category.status).toBe(201);

    const rice = await server.post("/api/v1/products").set(auth).send({
      name: "Beras",
      productType: "INGREDIENT",
      unit: "kg",
      categoryId: category.body.id,
      buyPrice: 12000,
      sellPrice: 15000,
    });
    expect(rice.status).toBe(201);

    const supplier = await server.post("/api/v1/suppliers").set(auth).send({ name: "Toko Beras" });
    expect(supplier.status).toBe(201);

    const draft = await server.post("/api/v1/purchases").set(auth).send({
      supplierId: supplier.body.id,
      invoiceNo: `DRAFT-${Date.now()}`,
      purchasedAt: "2026-08-19",
      items: [{ productId: rice.body.id, quantity: 5, unitCost: 11000 }],
    });
    expect(draft.status).toBe(201);
    expect(draft.body.documentStatus).toBe("DRAFT");

    const cancelled = await server.post(`/api/v1/purchases/${draft.body.id}/cancel`).set(auth);
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.documentStatus).toBe("CANCELLED");

    const receivedPurchase = await server.post("/api/v1/purchases").set(auth).send({
      supplierId: supplier.body.id,
      invoiceNo: `RCV-${Date.now()}`,
      purchasedAt: "2026-08-19",
      items: [{ productId: rice.body.id, quantity: 5, unitCost: 11000 }],
    });
    expect(receivedPurchase.status).toBe(201);

    const received = await server.post(`/api/v1/purchases/${receivedPurchase.body.id}/receive`).set(auth);
    expect(received.status).toBe(201);
    expect(received.body.documentStatus).toBe("RECEIVED");

    const rejectCancel = await server.post(`/api/v1/purchases/${receivedPurchase.body.id}/cancel`).set(auth);
    expect(rejectCancel.status).toBeGreaterThanOrEqual(400);

    const opened = await server.post("/api/v1/cashier-sessions/open").set(auth).send({ openingCash: 50000 });
    expect(opened.status).toBe(201);

    const sale = await server.post("/api/v1/sales").set(auth).send({
      paymentMethod: "CASH",
      items: [{ productId: rice.body.id, quantity: 1 }],
    });
    expect(sale.status).toBe(201);

    const badCancel = await server.post(`/api/v1/sales/${sale.body.id}/cancel`).set(auth).send({ reason: "" });
    expect(badCancel.status).toBeGreaterThanOrEqual(400);

    const cancelledSale = await server
      .post(`/api/v1/sales/${sale.body.id}/cancel`)
      .set(auth)
      .send({ reason: "Salah input kasir" });
    expect(cancelledSale.status).toBe(201);
    expect(cancelledSale.body.status).toBe("CANCELLED");
    expect(cancelledSale.body.notes).toContain("Salah input");

    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const listed = await server.get(`/api/v1/sales?from=${today}&to=${today}`).set(auth);
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.items)).toBe(true);
    expect(listed.body.items.some((row: { id: string }) => row.id === sale.body.id)).toBe(true);
  });
});
