import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("prd path perfect wave 5 partial PO + return", () => {
  it("receives purchase in waves then returns stock", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `PO ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Bahan" });
    expect(category.status).toBe(201);

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Tepung",
      productType: "INGREDIENT",
      unit: "kg",
      categoryId: category.body.id,
      buyPrice: 8000,
      sellPrice: 10000,
    });
    expect(product.status).toBe(201);

    const supplier = await server.post("/api/v1/suppliers").set(auth).send({ name: `Supplier ${Date.now()}` });
    expect(supplier.status).toBe(201);

    const purchase = await server.post("/api/v1/purchases").set(auth).send({
      supplierId: supplier.body.id,
      invoiceNo: `INV-${Date.now()}`,
      purchasedAt: new Date().toISOString().slice(0, 10),
      items: [{ productId: product.body.id, quantity: 10, unitCost: 8000 }],
    });
    expect(purchase.status).toBe(201);
    expect(purchase.body.documentStatus).toBe("DRAFT");
    const itemId = purchase.body.items[0].id as string;

    const partial = await server.post(`/api/v1/purchases/${purchase.body.id}/receive`).set(auth).send({
      items: [{ purchaseItemId: itemId, quantity: 4 }],
    });
    expect(partial.status).toBe(201);
    expect(partial.body.documentStatus).toBe("PARTIAL");
    expect(partial.body.items[0].receivedQty).toBe(4);
    expect(partial.body.items[0].remainingReceive).toBe(6);

    const stockAfterPartial = await server.get(`/api/v1/products/${product.body.id}`).set(auth);
    expect(stockAfterPartial.status).toBe(200);
    expect(stockAfterPartial.body.stock).toBe(4);

    const rest = await server.post(`/api/v1/purchases/${purchase.body.id}/receive`).set(auth).send({});
    expect(rest.status).toBe(201);
    expect(rest.body.documentStatus).toBe("RECEIVED");
    expect(rest.body.items[0].receivedQty).toBe(10);

    const returned = await server.post(`/api/v1/purchases/${purchase.body.id}/returns`).set(auth).send({
      items: [{ purchaseItemId: itemId, quantity: 3 }],
      notes: "barang rusak",
    });
    expect(returned.status).toBe(201);
    expect(returned.body.purchase.items[0].returnedQty).toBe(3);
    expect(returned.body.purchase.items[0].remainingReturn).toBe(7);

    const stockAfterReturn = await server.get(`/api/v1/products/${product.body.id}`).set(auth);
    expect(stockAfterReturn.status).toBe(200);
    expect(stockAfterReturn.body.stock).toBe(7);

    const overReturn = await server.post(`/api/v1/purchases/${purchase.body.id}/returns`).set(auth).send({
      items: [{ purchaseItemId: itemId, quantity: 8 }],
    });
    expect(overReturn.status).toBe(400);

    await app.close();
  }, 90000);
});
