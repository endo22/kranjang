import { createHash } from "node:crypto";
import { describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import { AdminService } from "../src/admin/admin.service.js";
import { createMidtransSnapToken } from "../src/billing/billing.service.js";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("prd next wave 3 production gate", () => {
  it("rejects mock-pay when NODE_ENV is production", async () => {
    const previous = process.env.NODE_ENV;
    const previousKey = process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MIDTRANS_SERVER_KEY;

    const app = await createApp();
    const created = await register(app, { email: uniqueEmail(), businessName: `Wave3 ${Date.now()}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const checkout = await server.post("/api/v1/billing/checkout").set(auth).send({
      planCode: "basic",
      billingCycle: "monthly",
    });
    expect(checkout.status).toBe(201);
    expect(checkout.body.snapToken).toBeNull();

    process.env.NODE_ENV = "production";
    try {
      const mocked = await server.post("/api/v1/billing/mock-pay").set(auth).send({ orderId: checkout.body.orderId });
      expect(mocked.status).toBe(403);
      expect(mocked.body.code).toBe("FORBIDDEN");
    } finally {
      process.env.NODE_ENV = previous;
      if (previousKey === undefined) {
        delete process.env.MIDTRANS_SERVER_KEY;
      } else {
        process.env.MIDTRANS_SERVER_KEY = previousKey;
      }
    }

    const allowed = await server.post("/api/v1/billing/mock-pay").set(auth).send({ orderId: checkout.body.orderId });
    expect(allowed.status).toBe(201);

    await app.close();
  }, 60000);

  it("creates snap token when Midtrans server key is set", async () => {
    const previousKey = process.env.MIDTRANS_SERVER_KEY;
    const previousClient = process.env.MIDTRANS_CLIENT_KEY;
    const previousFetch = globalThis.fetch;

    process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-test";
    process.env.MIDTRANS_CLIENT_KEY = "SB-Mid-client-test";
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ token: "snap-token-test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const app = await createApp();
    try {
      const created = await register(app, { email: uniqueEmail(), businessName: `Snap ${Date.now()}` });
      const auth = { Authorization: `Bearer ${created.body.accessToken}` };
      const checkout = await request(app.getHttpServer()).post("/api/v1/billing/checkout").set(auth).send({
        planCode: "basic",
        billingCycle: "monthly",
      });
      expect(checkout.status).toBe(201);
      expect(checkout.body.snapToken).toBe("snap-token-test");
      expect(checkout.body.clientKey).toBe("SB-Mid-client-test");
    } finally {
      process.env.MIDTRANS_SERVER_KEY = previousKey;
      process.env.MIDTRANS_CLIENT_KEY = previousClient;
      globalThis.fetch = previousFetch;
      await app.close();
    }
  }, 60000);

  it("verifies Midtrans webhook signature", async () => {
    const previousKey = process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MIDTRANS_SERVER_KEY;

    const app = await createApp();
    try {
      const created = await register(app, { email: uniqueEmail(), businessName: `Hook ${Date.now()}` });
      const auth = { Authorization: `Bearer ${created.body.accessToken}` };
      const server = request(app.getHttpServer());

      const checkout = await server.post("/api/v1/billing/checkout").set(auth).send({
        planCode: "basic",
        billingCycle: "monthly",
      });
      expect(checkout.status).toBe(201);

      process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-webhook";

      const orderId = checkout.body.orderId as string;
      const statusCode = "200";
      const grossAmount = String(checkout.body.amount);
      const bad = await server.post("/api/v1/billing/webhook").send({
        order_id: orderId,
        transaction_status: "settlement",
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: "invalid",
      });
      expect(bad.status).toBe(401);

      const signature = createHash("sha512")
        .update(`${orderId}${statusCode}${grossAmount}${process.env.MIDTRANS_SERVER_KEY}`)
        .digest("hex");
      const ok = await server.post("/api/v1/billing/webhook").send({
        order_id: orderId,
        transaction_status: "settlement",
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature,
      });
      expect(ok.status).toBe(201);
      expect(ok.body.success).toBe(true);
    } finally {
      if (previousKey === undefined) {
        delete process.env.MIDTRANS_SERVER_KEY;
      } else {
        process.env.MIDTRANS_SERVER_KEY = previousKey;
      }
      await app.close();
    }
  }, 60000);

  it("createMidtransSnapToken posts to sandbox snap API", async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(JSON.stringify({ token: "abc" }), { status: 200, headers: { "content-type": "application/json" } }),
    ) as unknown as typeof fetch;

    const token = await createMidtransSnapToken({
      orderId: "KRJ-1",
      amount: 99000,
      serverKey: "SB-Mid-server-x",
      fetchImpl,
    });
    expect(token).toBe("abc");
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("ensureSeedAdmin rejects default password in production", async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousPassword = process.env.SUPER_ADMIN_PASSWORD;
    process.env.NODE_ENV = "production";
    delete process.env.SUPER_ADMIN_PASSWORD;

    const service = new AdminService({} as never, {} as never);
    await expect(service.ensureSeedAdmin()).rejects.toThrow(/SUPER_ADMIN_PASSWORD/);

    process.env.NODE_ENV = previousEnv;
    if (previousPassword === undefined) {
      delete process.env.SUPER_ADMIN_PASSWORD;
    } else {
      process.env.SUPER_ADMIN_PASSWORD = previousPassword;
    }
  });
});
