import type { INestApplication } from "@nestjs/common";
import { jest } from "@jest/globals";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { hashToken } from "../src/auth/tokens.js";
import { sendDevLink } from "../src/auth/mailer.js";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("email verification and reset", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("verifies email with stored token hash", async () => {
    const email = uniqueEmail();
    const created = await register(app, { email });
    const userId = created.body.user.id;
    const plain = "test-verify-token-plain";

    await prisma.emailVerificationToken.deleteMany({
      where: { tokenHash: hashToken(plain) },
    });

    await prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(plain),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const res = await request(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token: plain });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerifiedAt).not.toBeNull();

    const token = await prisma.emailVerificationToken.findFirstOrThrow({
      where: { userId, tokenHash: hashToken(plain) },
    });
    expect(token.usedAt).not.toBeNull();
  });

  it("returns VALIDATION_ERROR for invalid verify token", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token: "missing-verify-token" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toBe("Tautan tidak valid atau kedaluwarsa.");
  });

  it("forgot-password always 200 for unknown email", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/forgot-password").send({ email: uniqueEmail() });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("creates hashed reset token and logs plaintext link for known email", async () => {
    const email = uniqueEmail();
    await register(app, { email });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

    const res = await request(app.getHttpServer()).post("/api/v1/auth/forgot-password").send({ email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const resetLog = consoleSpy.mock.calls
      .map(([value]) => String(value))
      .find((value) => value.startsWith("[kranjang-mail] reset: "));

    expect(resetLog).toBeTruthy();

    const url = new URL(resetLog!.replace("[kranjang-mail] reset: ", ""));
    const plain = url.searchParams.get("token");

    expect(url.pathname).toBe("/reset-password");
    expect(plain).toBeTruthy();

    const stored = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.id, tokenHash: hashToken(plain!) },
    });

    expect(stored.usedAt).toBeNull();
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored.tokenHash).not.toBe(plain);
  });

  it("does not log dev links in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    process.env.NODE_ENV = "production";

    try {
      sendDevLink("verify", "http://localhost:3000/verify-email?token=secret");
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it("resets password, revokes refresh tokens, and allows new login", async () => {
    const email = uniqueEmail();
    const created = await register(app, { email });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const plain = "test-reset-token-plain";

    expect(created.status).toBe(201);

    const secondLogin = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "password12" });
    expect(secondLogin.status).toBe(200);

    await prisma.passwordResetToken.deleteMany({
      where: { tokenHash: hashToken(plain) },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(plain),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const beforeReset = await prisma.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(beforeReset.length).toBeGreaterThanOrEqual(2);

    const reset = await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: plain, password: "newpass123" });

    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ ok: true });

    const usedToken = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.id, tokenHash: hashToken(plain) },
    });
    expect(usedToken.usedAt).not.toBeNull();

    const activeRefreshTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeRefreshTokens).toHaveLength(0);

    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "newpass123" });
    expect(login.status).toBe(200);
  });

  it("returns VALIDATION_ERROR for invalid reset token", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: "missing-reset-token", password: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toBe("Tautan tidak valid atau kedaluwarsa.");
  });
});
