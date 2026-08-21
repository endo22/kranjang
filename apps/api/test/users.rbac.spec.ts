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

describe("users RBAC and tenant isolation", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("lists tenant roles for owners", async () => {
    const owner = await register(app, { email: uniqueEmail() });

    const res = await request(app.getHttpServer()).get("/api/v1/roles").set(bearer(owner.body.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.map((item: { name: string }) => item.name).sort()).toEqual(
      ["Administrator", "Cashier", "Inventory Staff", "Manager", "Owner"].sort(),
    );
  });

  it("hides tenant A user from tenant B", async () => {
    const ownerA = await register(app, { email: uniqueEmail(), businessName: "Usaha A" });
    const ownerB = await register(app, { email: uniqueEmail(), businessName: "Usaha B" });

    const list = await request(app.getHttpServer()).get("/api/v1/users").set(bearer(ownerB.body.accessToken));

    expect(list.status).toBe(200);
    expect(list.body.find((user: { id: string }) => user.id === ownerA.body.user.id)).toBeUndefined();

    const get = await request(app.getHttpServer())
      .get(`/api/v1/users/${ownerA.body.user.id}`)
      .set(bearer(ownerB.body.accessToken));

    expect(get.status).toBe(404);
    expect(get.body.code).toBe("NOT_FOUND");
    expect(get.body.message).toBe("Data tidak ditemukan.");
  });

  it("creates, gets, updates, and soft-deletes tenant users without exposing passwordHash", async () => {
    const owner = await register(app, { email: uniqueEmail() });
    const cashierRoleId = await getRoleId(app, owner.body.accessToken, "Cashier");
    const email = uniqueEmail();

    const created = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set(bearer(owner.body.accessToken))
      .send({
        name: "Kasir Satu",
        email,
        password: "password12",
        phone: "081234567891",
        roleId: cashierRoleId,
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: "Kasir Satu",
      email,
      phone: "081234567891",
      role: { id: cashierRoleId, name: "Cashier" },
    });
    expect(created.body.passwordHash).toBeUndefined();

    const list = await request(app.getHttpServer()).get("/api/v1/users").set(bearer(owner.body.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.find((user: { id: string }) => user.id === created.body.id)).toMatchObject({
      id: created.body.id,
      name: "Kasir Satu",
      email,
      role: { id: cashierRoleId, name: "Cashier" },
    });

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/users/${created.body.id}`)
      .set(bearer(owner.body.accessToken));
    expect(fetched.status).toBe(200);
    expect(fetched.body.passwordHash).toBeUndefined();

    const managerRoleId = await getRoleId(app, owner.body.accessToken, "Manager");
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/users/${created.body.id}`)
      .set(bearer(owner.body.accessToken))
      .send({
        name: "Kasir Dua",
        phone: null,
        roleId: managerRoleId,
      });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      name: "Kasir Dua",
      email,
      phone: null,
      role: { id: managerRoleId, name: "Manager" },
    });

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/users/${created.body.id}`)
      .set(bearer(owner.body.accessToken));

    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ success: true });

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/users/${created.body.id}`)
      .set(bearer(owner.body.accessToken));
    expect(hidden.status).toBe(404);

    const softDeleted = await prisma.user.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(softDeleted.deletedAt).toBeTruthy();

    const audits = await prisma.auditLog.findMany({
      where: {
        tenantId: owner.body.tenant.id,
        module: "user",
        entity: "user",
        entityId: created.body.id,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(audits.map((item) => item.action)).toEqual(["CREATE", "UPDATE", "DELETE"]);
    expect(audits.every((item) => item.userId === owner.body.user.id)).toBe(true);
  });

  it("forbids cashier from accessing users and roles endpoints", async () => {
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

    const listUsers = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set(bearer(cashierLogin.body.accessToken));
    expect(listUsers.status).toBe(403);
    expect(listUsers.body.code).toBe("FORBIDDEN");

    const roles = await request(app.getHttpServer())
      .get("/api/v1/roles")
      .set(bearer(cashierLogin.body.accessToken));
    expect(roles.status).toBe(403);
    expect(roles.body.code).toBe("FORBIDDEN");

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/users/${created.body.id}`)
      .set(bearer(cashierLogin.body.accessToken));
    expect(del.status).toBe(403);
    expect(del.body.code).toBe("FORBIDDEN");
  });

  it("rejects deleting self", async () => {
    const owner = await register(app, { email: uniqueEmail() });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/users/${owner.body.user.id}`)
      .set(bearer(owner.body.accessToken));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects deleting or demoting the last owner", async () => {
    const owner = await register(app, { email: uniqueEmail() });
    const managerRoleId = await getRoleId(app, owner.body.accessToken, "Manager");

    const demote = await request(app.getHttpServer())
      .patch(`/api/v1/users/${owner.body.user.id}`)
      .set(bearer(owner.body.accessToken))
      .send({ roleId: managerRoleId });

    expect(demote.status).toBe(400);
    expect(demote.body.code).toBe("VALIDATION_ERROR");

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/users/${owner.body.user.id}`)
      .set(bearer(owner.body.accessToken));

    expect(del.status).toBe(400);
    expect(del.body.code).toBe("VALIDATION_ERROR");
  });
});
