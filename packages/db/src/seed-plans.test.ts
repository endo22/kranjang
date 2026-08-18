import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_CARDS, SUBSCRIPTION_PLANS_SEED } from "@kranjang/shared";

const root = dirname(fileURLToPath(import.meta.url));

describe("prisma schema and seed data", () => {
  it("schema contains refresh_tokens and tenants", () => {
    const schema = readFileSync(join(root, "../prisma/schema.prisma"), "utf8");
    assert.match(schema, /@@map\("refresh_tokens"\)/);
    assert.match(schema, /@@map\("tenants"\)/);
    assert.match(schema, /@@map\("sales"\)/);
  });

  it("seed plan codes include trial plus landing cards", () => {
    assert.deepEqual(
      SUBSCRIPTION_PLANS_SEED.map((p) => p.code),
      ["trial", "basic", "business", "pro"],
    );
    assert.equal(PLAN_CARDS.length, 3);
  });
});
