import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@kranjang/db";
import { ROLE_TEMPLATE_NAMES } from "@kranjang/shared";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("POST /api/v1/auth/register", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("returns VALIDATION_ERROR for empty body", async () => {
    const res = await register(app, { businessName: "", ownerName: "", email: "x", password: "1", phone: "1" } as never);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("creates tenant, owner, outlet, trial, roles, settings, expenses, subscription", async () => {
    const email = uniqueEmail();
    const res = await register(app, { email });
    const cookies = res.headers["set-cookie"];
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("Owner");
    expect(res.body.user.permissions).toEqual(expect.arrayContaining(["user.manage", "subscription.manage"]));
    expect(res.body.tenant.subscriptionStatus).toBe("TRIAL");
    expect((Array.isArray(cookies) ? cookies.join(";") : cookies) ?? "").toMatch(/kranjang_refresh=/);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: res.body.tenant.id } });
    const days = (tenant.trialEndDate.getTime() - tenant.trialStartDate.getTime()) / 86400000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);

    const roles = await prisma.role.findMany({ where: { tenantId: tenant.id } });
    expect(roles.map((r) => r.name).sort()).toEqual([...ROLE_TEMPLATE_NAMES].sort());

    expect(await prisma.outlet.count({ where: { tenantId: tenant.id, name: "Outlet Utama" } })).toBe(1);
    expect(await prisma.tenantSettings.count({ where: { tenantId: tenant.id } })).toBe(1);
    expect(await prisma.expenseCategory.count({ where: { tenantId: tenant.id } })).toBe(9);
    expect(await prisma.subscription.count({ where: { tenantId: tenant.id, status: "TRIAL" } })).toBe(1);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(owner.passwordHash).not.toBe("password12");
    expect(owner.passwordHash.length).toBeGreaterThan(20);
  });

  it("returns CONFLICT for duplicate email", async () => {
    const email = uniqueEmail();
    expect((await register(app, { email })).status).toBe(201);
    const again = await register(app, { email });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("CONFLICT");
  });

  it("makes unique slugs for the same business name", async () => {
    const a = await register(app, { businessName: "Warung Sama" });
    const b = await register(app, { businessName: "Warung Sama" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.tenant.slug).not.toBe(b.body.tenant.slug);
  });
});
