import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("prd path perfect wave 7 table hold split", () => {
  it("holds bill on table, split-pays sale, and scopes open holds", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Meja ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Makanan" });
    expect(category.status).toBe(201);

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Nasi Goreng",
      productType: "SIMPLE",
      unit: "pcs",
      categoryId: category.body.id,
      buyPrice: 8000,
      sellPrice: 15000,
    });
    expect(product.status).toBe(201);

    await server
      .post("/api/v1/inventory/adjust")
      .set(auth)
      .send({ productId: product.body.id, quantity: 20, movementType: "INITIAL_STOCK" });

    const table = await server.post("/api/v1/dining-tables").set(auth).send({ name: `Meja ${Date.now()}` });
    expect(table.status).toBe(201);

    const open = await server.post("/api/v1/cashier-sessions/open").set(auth).send({ openingCash: 0 });
    expect(open.status).toBe(201);

    const hold = await server.post("/api/v1/sale-holds").set(auth).send({
      diningTableId: table.body.id,
      items: [{ productId: product.body.id, quantity: 2 }],
    });
    expect(hold.status).toBe(201);
    expect(hold.body.status).toBe("OPEN");

    const duplicate = await server.post("/api/v1/sale-holds").set(auth).send({
      diningTableId: table.body.id,
      items: [{ productId: product.body.id, quantity: 1 }],
    });
    expect(duplicate.status).toBe(400);

    const listed = await server.get("/api/v1/sale-holds?status=OPEN").set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const paidHold = await server.post(`/api/v1/sale-holds/${hold.body.id}/checkout`).set(auth).send({
      paymentMethod: "CASH",
    });
    expect(paidHold.status).toBe(201);
    expect(paidHold.body.status).toBe("COMPLETED");
    expect(paidHold.body.payments).toHaveLength(1);
    expect(paidHold.body.totalNet).toBe(30000);

    const splitSale = await server.post("/api/v1/sales").set(auth).send({
      diningTableId: table.body.id,
      items: [{ productId: product.body.id, quantity: 1 }],
      payments: [
        { method: "CASH", amount: 10000 },
        { method: "QRIS", amount: 5000 },
      ],
    });
    expect(splitSale.status).toBe(201);
    expect(splitSale.body.payments).toHaveLength(2);
    expect(splitSale.body.totalNet).toBe(15000);

    const badSplit = await server.post("/api/v1/sales").set(auth).send({
      items: [{ productId: product.body.id, quantity: 1 }],
      payments: [
        { method: "CASH", amount: 10000 },
        { method: "QRIS", amount: 1000 },
      ],
    });
    expect(badSplit.status).toBe(400);

    await app.close();
  }, 90000);
});
