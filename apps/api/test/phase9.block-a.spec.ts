import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("phase 9 block A", () => {
  it("filters products by q, categoryId, productType and returns catalog fields", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const drinks = await server.post("/api/v1/categories").set(auth).send({ name: "Minuman" });
    expect(drinks.status).toBe(201);

    const foods = await server.post("/api/v1/categories").set(auth).send({ name: "Makanan" });
    expect(foods.status).toBe(201);

    const air = await server.post("/api/v1/products").set(auth).send({
      name: "Air Mineral",
      productType: "SIMPLE",
      unit: "botol",
      categoryId: drinks.body.id,
      barcode: "AIR-001",
      buyPrice: 2000,
      sellPrice: 5000,
      minStock: 3,
      isActive: true,
      imageUrl: "https://example.com/air.jpg",
    });
    expect(air.status).toBe(201);

    const mie = await server.post("/api/v1/products").set(auth).send({
      name: "Mie Instan",
      productType: "INGREDIENT",
      unit: "pcs",
      categoryId: foods.body.id,
      barcode: "MIE-001",
      buyPrice: 1500,
      sellPrice: 2500,
      minStock: 8,
      isActive: false,
    });
    expect(mie.status).toBe(201);

    const filtered = await server
      .get(`/api/v1/products?q=Air&categoryId=${drinks.body.id}&productType=SIMPLE`)
      .set(auth);

    expect(filtered.status).toBe(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0]).toMatchObject({
      id: air.body.id,
      name: "Air Mineral",
      productType: "SIMPLE",
      categoryId: drinks.body.id,
      barcode: "AIR-001",
      minStock: 3,
      isActive: true,
      imageUrl: "https://example.com/air.jpg",
    });

    await app.close();
  }, 60000);

  it("updates product minStock and barcode via patch", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Susu UHT",
      productType: "SIMPLE",
      unit: "kotak",
      buyPrice: 4000,
      sellPrice: 7000,
      minStock: 1,
    });
    expect(product.status).toBe(201);

    const updated = await server.patch(`/api/v1/products/${product.body.id}`).set(auth).send({
      minStock: 6,
      barcode: "SUSU-999",
    });

    expect(updated.status).toBe(200);
    expect(updated.body.minStock).toBe(6);
    expect(updated.body.barcode).toBe("SUSU-999");

    const fetched = await server.get(`/api/v1/products/${product.body.id}`).set(auth);
    expect(fetched.status).toBe(200);
    expect(fetched.body.minStock).toBe(6);
    expect(fetched.body.barcode).toBe("SUSU-999");

    await app.close();
  }, 60000);

  it("rejects WASTE without notes and filters movements", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const kopi = await server.post("/api/v1/products").set(auth).send({
      name: "Kopi Bubuk",
      productType: "INGREDIENT",
      unit: "gram",
      buyPrice: 1000,
      sellPrice: 2000,
      minStock: 5,
    });
    expect(kopi.status).toBe(201);

    const teh = await server.post("/api/v1/products").set(auth).send({
      name: "Teh Celup",
      productType: "INGREDIENT",
      unit: "pcs",
      buyPrice: 500,
      sellPrice: 1500,
      minStock: 5,
    });
    expect(teh.status).toBe(201);

    const seeded = await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: kopi.body.id,
      quantity: 10,
      movementType: "INITIAL_STOCK",
      notes: "stok awal",
    });
    expect(seeded.status).toBe(201);

    const rejectedWaste = await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: kopi.body.id,
      quantity: -2,
      movementType: "WASTE",
    });
    expect(rejectedWaste.status).toBe(400);
    expect(rejectedWaste.body.code).toBe("VALIDATION_ERROR");
    expect(rejectedWaste.body.details.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Catatan wajib untuk waste.",
          path: ["notes"],
        }),
      ]),
    );

    const wasted = await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: kopi.body.id,
      quantity: -2,
      movementType: "WASTE",
      notes: "produk rusak",
    });
    expect(wasted.status).toBe(201);

    const otherSeeded = await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: teh.body.id,
      quantity: 7,
      movementType: "INITIAL_STOCK",
      notes: "stok teh",
    });
    expect(otherSeeded.status).toBe(201);

    const past = encodeURIComponent(new Date(Date.now() - 60_000).toISOString());
    const future = encodeURIComponent(new Date(Date.now() + 60_000).toISOString());
    const filtered = await server
      .get(`/api/v1/inventory/movements?productId=${kopi.body.id}&from=${past}&to=${future}`)
      .set(auth);

    expect(filtered.status).toBe(200);
    expect(filtered.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: kopi.body.id,
          movementType: "WASTE",
          notes: "produk rusak",
        }),
      ]),
    );
    expect(filtered.body.every((row: { productId: string }) => row.productId === kopi.body.id)).toBe(true);

    const futureOnly = await server.get(`/api/v1/inventory/movements?from=${future}`).set(auth);
    expect(futureOnly.status).toBe(200);
    expect(futureOnly.body).toEqual([]);

    const pastOnly = await server.get(`/api/v1/inventory/movements?to=${past}`).set(auth);
    expect(pastOnly.status).toBe(200);
    expect(pastOnly.body).toEqual([]);

    await app.close();
  }, 60000);

  it("rejects invalid movement query params with validation error", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const badProductId = await server.get("/api/v1/inventory/movements?productId=not-a-uuid").set(auth);
    expect(badProductId.status).toBe(400);
    expect(badProductId.body.code).toBe("VALIDATION_ERROR");

    const badFrom = await server.get("/api/v1/inventory/movements?from=not-a-date").set(auth);
    expect(badFrom.status).toBe(400);
    expect(badFrom.body.code).toBe("VALIDATION_ERROR");

    await app.close();
  }, 60000);

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
