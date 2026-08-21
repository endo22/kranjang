import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("prd path perfect wave 6 multi-outlet + transfer", () => {
  it("enforces maxOutlets, transfers stock, and scopes sale stock by outlet", async () => {
    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Outlet ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());
    const prisma = app.get(PrismaService);
    const tenantId = created.body.tenant.id as string;

    const listed = await server.get("/api/v1/outlets").set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    const outletA = listed.body[0].id as string;

    const blocked = await server.post("/api/v1/outlets").set(auth).send({ name: `Cabang ${Date.now()}` });
    expect(blocked.status).toBe(400);

    const business = await prisma.subscriptionPlan.findUnique({ where: { code: "business" } });
    expect(business).toBeTruthy();
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionPlanId: business!.id },
    });

    const outletBRes = await server.post("/api/v1/outlets").set(auth).send({
      name: `Cabang ${Date.now()}`,
      address: "Jl. Kedua",
    });
    expect(outletBRes.status).toBe(201);
    const outletB = outletBRes.body.id as string;

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Snack" });
    expect(category.status).toBe(201);

    const product = await server
      .post("/api/v1/products")
      .set({ ...auth, "X-Outlet-Id": outletA })
      .send({
        name: "Keripik",
        productType: "SIMPLE",
        unit: "pcs",
        categoryId: category.body.id,
        buyPrice: 1000,
        sellPrice: 2000,
      });
    expect(product.status).toBe(201);

    const stocked = await server
      .post("/api/v1/inventory/adjust")
      .set({ ...auth, "X-Outlet-Id": outletA })
      .send({
        productId: product.body.id,
        quantity: 10,
        movementType: "INITIAL_STOCK",
      });
    expect(stocked.status).toBe(201);

    const transfer = await server.post("/api/v1/inventory/transfer").set(auth).send({
      productId: product.body.id,
      fromOutletId: outletA,
      toOutletId: outletB,
      quantity: 4,
    });
    expect(transfer.status).toBe(201);

    const stockA = await server.get(`/api/v1/products/${product.body.id}`).set({ ...auth, "X-Outlet-Id": outletA });
    const stockB = await server.get(`/api/v1/products/${product.body.id}`).set({ ...auth, "X-Outlet-Id": outletB });
    expect(stockA.body.stock).toBe(6);
    expect(stockB.body.stock).toBe(4);

    const open = await server
      .post("/api/v1/cashier-sessions/open")
      .set({ ...auth, "X-Outlet-Id": outletB })
      .send({ openingFloat: 0 });
    expect(open.status).toBe(201);

    const sale = await server
      .post("/api/v1/sales")
      .set({ ...auth, "X-Outlet-Id": outletB })
      .send({
        items: [{ productId: product.body.id, quantity: 2 }],
        paymentMethod: "CASH",
      });
    expect(sale.status).toBe(201);

    const stockAAfter = await server.get(`/api/v1/products/${product.body.id}`).set({ ...auth, "X-Outlet-Id": outletA });
    const stockBAfter = await server.get(`/api/v1/products/${product.body.id}`).set({ ...auth, "X-Outlet-Id": outletB });
    expect(stockAAfter.body.stock).toBe(6);
    expect(stockBAfter.body.stock).toBe(2);

    await app.close();
  }, 90000);
});
