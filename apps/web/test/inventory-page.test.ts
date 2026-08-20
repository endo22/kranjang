import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInventoryMovementsPath, getLowStockProducts, validateInventoryAdjustment } from "../app/(dashboard)/app/inventory/page-helpers";

describe("inventory page helpers", () => {
  it("builds movements query with from, to, and product filters", () => {
    const path = buildInventoryMovementsPath({
      from: "2026-08-20",
      to: "2026-08-21",
      productId: "product-1",
    });

    assert.equal(
      path,
      "/inventory/movements?from=2026-08-20T00%3A00%3A00.000%2B07%3A00&to=2026-08-21T23%3A59%3A59.999%2B07%3A00&productId=product-1",
    );
  });

  it("requires notes for waste adjustments", () => {
    assert.equal(
      validateInventoryAdjustment({
        movementType: "WASTE",
        notes: "   ",
      }),
      "Catatan wajib untuk waste.",
    );
    assert.equal(
      validateInventoryAdjustment({
        movementType: "WASTE",
        notes: "Kemasan rusak",
      }),
      null,
    );
    assert.equal(
      validateInventoryAdjustment({
        movementType: "ADJUSTMENT",
        notes: "",
      }),
      null,
    );
  });

  it("returns only non-recipe products with active minimum stock alerts", () => {
    const rows = getLowStockProducts([
      { id: "1", name: "Beras", productType: "INGREDIENT", stock: 2, minStock: 3 },
      { id: "2", name: "Nasi Goreng", productType: "RECIPE", stock: 1, minStock: 5 },
      { id: "3", name: "Minyak", productType: "INGREDIENT", stock: 8, minStock: 5 },
      { id: "4", name: "Sambal", productType: "SIMPLE", stock: 0, minStock: 0 },
    ]);

    assert.deepEqual(rows, [{ id: "1", name: "Beras", stock: 2, minStock: 3 }]);
  });
});
