import { describe, expect, it } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

async function login(app: INestApplication, email: string, password = "password12") {
  return request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password });
}

async function getRoleId(app: INestApplication, token: string, roleName: string) {
  const roles = await request(app.getHttpServer()).get("/api/v1/roles").set({ Authorization: `Bearer ${token}` });
  const role = roles.body.find((row: { name: string }) => row.name === roleName);
  return role.id as string;
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("phase 9 block c", () => {
  it("returns dashboard comparison fields and paginated products", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    expect(created.status).toBe(201);
    const auth = bearer(created.body.accessToken);
    const server = request(app.getHttpServer());
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

    const dashboard = await server.get(`/api/v1/dashboard?from=${today}&to=${today}`).set(auth);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body).toEqual(
      expect.objectContaining({
        revenue: expect.any(Number),
        netProfit: expect.any(Number),
        previous: expect.objectContaining({
          from: expect.any(String),
          to: expect.any(String),
          revenue: expect.any(Number),
          netProfit: expect.any(Number),
        }),
      }),
    );
    expect(dashboard.body).toHaveProperty("salesChangePct");
    expect(dashboard.body).toHaveProperty("profitChangePct");

    const category = await server.post("/api/v1/categories").set(auth).send({ name: "Umum" });
    expect(category.status).toBe(201);
    await server.post("/api/v1/products").set(auth).send({
      name: "Produk A",
      productType: "SIMPLE",
      unit: "pcs",
      categoryId: category.body.id,
      buyPrice: 1000,
      sellPrice: 2000,
    });
    await server.post("/api/v1/products").set(auth).send({
      name: "Produk B",
      productType: "SIMPLE",
      unit: "pcs",
      categoryId: category.body.id,
      buyPrice: 1000,
      sellPrice: 2000,
    });

    const page = await server.get("/api/v1/products?limit=1&offset=0").set(auth);
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBeGreaterThanOrEqual(2);

    await app.close();
  }, 60000);

  it("soft-disables user login and restores access; cashier can read settings", async () => {
    const app = await createApp();
    const ownerEmail = uniqueEmail();
    const owner = await register(app, { email: ownerEmail, businessName: `Warung ${ownerEmail.slice(0, 8)}` });
    expect(owner.status).toBe(201);
    const auth = bearer(owner.body.accessToken);
    const server = request(app.getHttpServer());

    const cashierRoleId = await getRoleId(app, owner.body.accessToken, "Cashier");
    const cashierEmail = uniqueEmail();
    const created = await server.post("/api/v1/users").set(auth).send({
      name: "Kasir Blok C",
      email: cashierEmail,
      password: "password12",
      roleId: cashierRoleId,
    });
    expect(created.status).toBe(201);

    const cashierLogin = await login(app, cashierEmail);
    expect(cashierLogin.status).toBe(200);

    const settings = await server.get("/api/v1/settings").set(bearer(cashierLogin.body.accessToken));
    expect(settings.status).toBe(200);

    const disabled = await server.delete(`/api/v1/users/${created.body.id}`).set(auth);
    expect(disabled.status).toBe(200);

    const blocked = await login(app, cashierEmail);
    expect(blocked.status).toBeGreaterThanOrEqual(400);

    const restored = await server.post(`/api/v1/users/${created.body.id}/restore`).set(auth);
    expect([200, 201]).toContain(restored.status);

    const again = await login(app, cashierEmail);
    expect(again.status).toBe(200);

    await app.close();
  }, 60000);
});
