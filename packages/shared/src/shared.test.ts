import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ERROR_CODES,
  PERMISSION_CODES,
  PLAN_CARDS,
  ROLE_TEMPLATE_PERMISSIONS,
  SUBSCRIPTION_PLANS_SEED,
  loginSchema,
  registerSchema,
} from "./index.ts";

describe("shared contracts", () => {
  it("exposes Phase 2 error codes", () => {
    assert.deepEqual(ERROR_CODES, [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_ERROR",
      "CONFLICT",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
      "STOCK_INSUFFICIENT",
      "SUBSCRIPTION_INACTIVE",
    ]);
  });

  it("Owner has user.manage and subscription.manage; Cashier does not", () => {
    assert.ok(ROLE_TEMPLATE_PERMISSIONS.Owner.includes("user.manage"));
    assert.ok(ROLE_TEMPLATE_PERMISSIONS.Owner.includes("subscription.manage"));
    assert.ok(!ROLE_TEMPLATE_PERMISSIONS.Cashier.includes("user.manage"));
    assert.equal(ROLE_TEMPLATE_PERMISSIONS.Administrator.includes("subscription.manage"), false);
    assert.equal(PERMISSION_CODES.length, 21);
  });

  it("landing cards are paid plans only and match seed prices", () => {
    assert.deepEqual(PLAN_CARDS.map((p) => p.code), ["basic", "business", "pro"]);
    for (const card of PLAN_CARDS) {
      const seed = SUBSCRIPTION_PLANS_SEED.find((s) => s.code === card.code);
      assert.ok(seed);
      assert.equal(seed.priceMonthly, card.priceMonthly);
    }
  });

  it("rejects short password and short phone", () => {
    const parsed = registerSchema.safeParse({
      businessName: "Toko",
      ownerName: "Budi",
      email: "budi@example.com",
      password: "short",
      phone: "08123",
    });
    assert.equal(parsed.success, false);
  });

  it("accepts valid register and login bodies", () => {
    const reg = registerSchema.parse({
      businessName: "Toko Budi",
      ownerName: "Budi",
      email: "budi@example.com",
      password: "password12",
      phone: "081234567890",
    });
    assert.equal(reg.email, "budi@example.com");
    assert.equal(loginSchema.parse({ email: "budi@example.com", password: "password12" }).email, "budi@example.com");
  });
});
