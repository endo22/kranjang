import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@kranjang/db";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

async function login(app: INestApplication, email: string, password = "password12") {
  return request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password });
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function getRoleId(app: INestApplication, accessToken: string, name: string) {
  const res = await request(app.getHttpServer()).get("/api/v1/roles").set(bearer(accessToken));
  expect(res.status).toBe(200);
  const role = res.body.find((item: { id: string; name: string }) => item.name === name);
  expect(role).toBeTruthy();
  return role.id as string;
}

describe("me and settings", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("gets and patches the current profile without exposing tenant fields", async () => {
    const email = uniqueEmail();
    const created = await register(app, { email, ownerName: "Budi", phone: "081234567890" });
    const auth = bearer(created.body.accessToken);

    const me = await request(app.getHttpServer()).get("/api/v1/me").set(auth);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      id: created.body.user.id,
      name: "Budi",
      email,
      phone: "081234567890",
    });
    expect(me.body.tenant).toBeUndefined();
    expect(me.body.trialEndDate).toBeUndefined();
    expect(me.body.subscriptionStatus).toBeUndefined();

    const patched = await request(app.getHttpServer()).patch("/api/v1/me").set(auth).send({
      name: "Budi Edited",
      phone: null,
    });

    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      id: created.body.user.id,
      name: "Budi Edited",
      email,
      phone: null,
    });
    expect(patched.body.tenant).toBeUndefined();
  });

  it("changes password using currentPassword and newPassword", async () => {
    const email = uniqueEmail();
    const created = await register(app, { email });

    const changed = await request(app.getHttpServer())
      .post("/api/v1/me/change-password")
      .set(bearer(created.body.accessToken))
      .send({
        currentPassword: "password12",
        newPassword: "password99",
      });

    expect(changed.status).toBe(200);

    const oldLogin = await login(app, email, "password12");
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.code).toBe("UNAUTHORIZED");

    const newLogin = await login(app, email, "password99");
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.accessToken).toEqual(expect.any(String));
  });

  it("gets and patches tenant settings for users with settings.manage", async () => {
    const created = await register(app, {
      email: uniqueEmail(),
      businessName: "Toko Satu",
      phone: "081234567890",
    });
    const auth = bearer(created.body.accessToken);

    const settings = await request(app.getHttpServer()).get("/api/v1/settings").set(auth);

    expect(settings.status).toBe(200);
    expect(settings.body).toMatchObject({
      name: "Toko Satu",
      phone: "081234567890",
      timezone: "Asia/Jakarta",
      allowNegativeStock: false,
      taxPercent: "0",
      taxInclusive: true,
      receiptFooter: null,
      receiptLogoUrl: null,
      receiptQrPayload: null,
      subscriptionStatus: "TRIAL",
    });
    expect(settings.body.trialEndDate).toEqual(expect.any(String));

    const patched = await request(app.getHttpServer()).patch("/api/v1/settings").set(auth).send({
      name: "Toko Dua",
      phone: null,
      timezone: "Asia/Jakarta",
      allowNegativeStock: true,
      taxPercent: 11,
      taxInclusive: false,
      receiptFooter: "Terima kasih",
      receiptLogoUrl: "https://cdn.example.com/logo.png",
      receiptQrPayload: "Toko Dua · 081234567890",
    });

    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      name: "Toko Dua",
      phone: null,
      timezone: "Asia/Jakarta",
      allowNegativeStock: true,
      taxPercent: "11",
      taxInclusive: false,
      receiptFooter: "Terima kasih",
      receiptLogoUrl: "https://cdn.example.com/logo.png",
      receiptQrPayload: "Toko Dua · 081234567890",
      subscriptionStatus: "TRIAL",
    });
    expect(patched.body.trialEndDate).toEqual(expect.any(String));

    const audit = await prisma.auditLog.findFirst({
      where: {
        tenantId: created.body.tenant.id,
        action: "UPDATE",
        module: "settings",
        entity: "tenant",
        entityId: created.body.tenant.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(audit).toBeTruthy();
    expect(audit?.userId).toBe(created.body.user.id);
    expect(audit?.oldValue).toMatchObject({
      name: "Toko Satu",
      phone: "081234567890",
      allowNegativeStock: false,
      taxPercent: 0,
      taxInclusive: true,
      receiptFooter: null,
    });
    expect(audit?.newValue).toMatchObject({
      name: "Toko Dua",
      phone: null,
      allowNegativeStock: true,
      taxPercent: 11,
      taxInclusive: false,
      receiptFooter: "Terima kasih",
    });
  });

  it("forbids cashier from settings endpoints but still allows me endpoints", async () => {
    const owner = await register(app, { email: uniqueEmail() });
    const cashierRoleId = await getRoleId(app, owner.body.accessToken, "Cashier");
    const cashierEmail = uniqueEmail();

    const created = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set(bearer(owner.body.accessToken))
      .send({
        name: "Kasir Tenant",
        email: cashierEmail,
        password: "password12",
        roleId: cashierRoleId,
      });
    expect(created.status).toBe(201);

    const cashierLogin = await login(app, cashierEmail);
    expect(cashierLogin.status).toBe(200);

    const me = await request(app.getHttpServer()).get("/api/v1/me").set(bearer(cashierLogin.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(cashierEmail);

    const settings = await request(app.getHttpServer())
      .get("/api/v1/settings")
      .set(bearer(cashierLogin.body.accessToken));
    expect(settings.status).toBe(200);
    expect(settings.body.taxPercent).toBeDefined();

    const patched = await request(app.getHttpServer())
      .patch("/api/v1/settings")
      .set(bearer(cashierLogin.body.accessToken))
      .send({ allowNegativeStock: true });
    expect(patched.status).toBe(403);
    expect(patched.body.code).toBe("FORBIDDEN");
  });
});
