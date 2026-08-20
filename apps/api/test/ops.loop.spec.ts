import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("operational loop", () => {
  it("buys ingredients, sells a recipe, and matches dashboard to P&L", async () => {
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
      sellPrice: 0,
    });
    expect(rice.status).toBe(201);

    const menu = await server.post("/api/v1/products").set(auth).send({
      name: "Nasi Goreng",
      productType: "RECIPE",
      unit: "porsi",
      categoryId: category.body.id,
      buyPrice: 0,
      sellPrice: 20000,
    });
    expect(menu.status).toBe(201);

    const recipe = await server.put(`/api/v1/products/${menu.body.id}/recipe`).set(auth).send({
      items: [{ ingredientId: rice.body.id, quantity: 0.2 }],
    });
    expect(recipe.status).toBe(200);

    const supplier = await server.post("/api/v1/suppliers").set(auth).send({ name: "Toko Beras" });
    expect(supplier.status).toBe(201);

    const purchase = await server.post("/api/v1/purchases").set(auth).send({
      supplierId: supplier.body.id,
      invoiceNo: `INV-${Date.now()}`,
      purchasedAt: "2026-08-19",
      items: [{ productId: rice.body.id, quantity: 10, unitCost: 11000 }],
    });
    expect(purchase.status).toBe(201);

    const received = await server.post(`/api/v1/purchases/${purchase.body.id}/receive`).set(auth);
    expect(received.status).toBe(201);

    const afterBuy = await server.get(`/api/v1/products/${rice.body.id}`).set(auth);
    expect(afterBuy.body.stock).toBe(10);
    expect(afterBuy.body.avgCost).toBe(11000);

    const opened = await server.post("/api/v1/cashier-sessions/open").set(auth).send({ openingCash: 100000 });
    expect(opened.status).toBe(201);

    const sale = await server.post("/api/v1/sales").set(auth).send({
      paymentMethod: "CASH",
      items: [{ productId: menu.body.id, quantity: 2 }],
    });
    expect(sale.status).toBe(201);
    expect(sale.body.items[0].cogsAmount).toBe(4400);

    const riceAfter = await server.get(`/api/v1/products/${rice.body.id}`).set(auth);
    expect(riceAfter.body.stock).toBe(9.6);

    const categories = await server.get("/api/v1/expense-categories").set(auth);
    const listrik = categories.body.find((row: { name: string }) => row.name === "listrik");
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const expense = await server.post("/api/v1/expenses").set(auth).send({
      categoryId: listrik.id,
      description: "Token listrik",
      amount: 50000,
      expenseDate: today,
      paymentMethod: "CASH",
    });
    expect(expense.status).toBe(201);

    const dashboard = await server.get(`/api/v1/dashboard?from=${today}&to=${today}`).set(auth);
    const report = await server.get(`/api/v1/reports/profit-loss?from=${today}&to=${today}`).set(auth);
    expect(dashboard.status).toBe(200);
    expect(report.status).toBe(200);
    expect(dashboard.body.revenue).toBe(report.body.profitLoss.revenue);
    expect(dashboard.body.netProfit).toBe(report.body.profitLoss.netProfit);

    const other = await register(app, { email: uniqueEmail(), businessName: "Usaha Lain" });
    const peek = await server.get(`/api/v1/products/${rice.body.id}`).set({ Authorization: `Bearer ${other.body.accessToken}` });
    expect(peek.status).toBe(404);

    const cashier = await server.post("/api/v1/users").set(auth).send({
      name: "Kasir Satu",
      email: uniqueEmail(),
      password: "password12",
      roleId: (await server.get("/api/v1/roles").set(auth)).body.find((row: { name: string }) => row.name === "Cashier").id,
    });
    expect(cashier.status).toBe(201);

    await app.close();
  }, 60000);
});
