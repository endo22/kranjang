import { Algorithm, hash as hashPassword } from "@node-rs/argon2";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@kranjang/db";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("auth session", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("logs in owner and sets refresh cookie", async () => {
    const email = uniqueEmail();
    await register(app, { email });

    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "password12" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("Owner");
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect((res.headers["set-cookie"] ?? []).join(";")).toMatch(/kranjang_refresh=/);
  });

  it("returns generic UNAUTHORIZED for bad password", async () => {
    const email = uniqueEmail();
    await register(app, { email });

    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "wrong-pass" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(res.body.message).toBe("Email atau password salah.");
  });

  it("rejects super admin login", async () => {
    const email = uniqueEmail();
    const passwordHash = await hashPassword("password12", { algorithm: Algorithm.Argon2id });
    await prisma.user.create({
      data: {
        email,
        name: "Super Admin",
        passwordHash,
        isSuperAdmin: true,
        tenantId: null,
      },
    });

    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "password12" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(res.body.message).toBe("Akun platform tidak dapat masuk ke aplikasi tenant pada fase ini.");
  });

  it("rotates refresh token and rejects reused cookie", async () => {
    const email = uniqueEmail();
    const created = await register(app, { email });
    const cookie = created.headers["set-cookie"];

    const first = await request(app.getHttpServer()).post("/api/v1/auth/refresh").set("Cookie", cookie);

    expect(first.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    expect((first.headers["set-cookie"] ?? []).join(";")).toMatch(/kranjang_refresh=/);

    const reused = await request(app.getHttpServer()).post("/api/v1/auth/refresh").set("Cookie", cookie);

    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe("UNAUTHORIZED");
  });

  it("refresh without cookie is UNAUTHORIZED", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rate-limits the 6th failed login within 15 minutes", async () => {
    const email = uniqueEmail();
    await register(app, { email });

    for (let i = 0; i < 5; i += 1) {
      const failed = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "wrong-pass" });
      expect(failed.status).toBe(401);
    }

    const limited = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "wrong-pass" });

    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
  });

  it("logout revokes refresh token, clears cookie, and blocks reuse", async () => {
    const created = await register(app);
    const cookie = created.headers["set-cookie"];

    const out = await request(app.getHttpServer()).post("/api/v1/auth/logout").set("Cookie", cookie);

    expect(out.status).toBe(200);
    expect((out.headers["set-cookie"] ?? []).join(";")).toMatch(/kranjang_refresh=;/);

    const again = await request(app.getHttpServer()).post("/api/v1/auth/refresh").set("Cookie", cookie);

    expect(again.status).toBe(401);
  });
});
