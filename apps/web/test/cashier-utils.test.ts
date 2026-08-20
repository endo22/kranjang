import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCartItem,
  adjustLastCartQty,
  estimateSaleTotals,
  filterProducts,
  holdActiveCart,
  pickProductForEnter,
  resolveCashierShortcut,
} from "../app/(dashboard)/app/cashier/cashier-utils";

const products = [
  {
    id: "coffee",
    name: "Kopi Susu",
    sellPrice: 18000,
    productType: "SIMPLE",
    barcode: "111",
    isActive: true,
    categoryId: "drink",
  },
  {
    id: "tea",
    name: "Teh Tarik",
    sellPrice: 15000,
    productType: "SIMPLE",
    barcode: "222",
    isActive: true,
    categoryId: "drink",
  },
  {
    id: "cake",
    name: "Cake Cokelat",
    sellPrice: 22000,
    productType: "SIMPLE",
    barcode: "333",
    isActive: true,
    categoryId: "food",
  },
  {
    id: "archived",
    name: "Produk Nonaktif",
    sellPrice: 5000,
    productType: "SIMPLE",
    barcode: "444",
    isActive: false,
    categoryId: "food",
  },
];

describe("cashier utils", () => {
  it("filters active products by category and query", () => {
    const filtered = filterProducts(products, "kopi", "drink");

    assert.deepEqual(
      filtered.map((item) => item.id),
      ["coffee"],
    );
  });

  it("prefers a unique exact barcode match on Enter", () => {
    const filtered = filterProducts(products, "1", "");
    const selected = pickProductForEnter(products, filtered, "111");

    assert.equal(selected?.id, "coffee");
  });

  it("falls back to the only filtered product on Enter", () => {
    const filtered = filterProducts(products, "cake", "");
    const selected = pickProductForEnter(products, filtered, "cake");

    assert.equal(selected?.id, "cake");
  });

  it("adds duplicate items by increasing quantity", () => {
    const cart = addCartItem([], products[0]);
    const nextCart = addCartItem(cart, products[0]);

    assert.deepEqual(nextCart, [{ product: products[0], quantity: 2 }]);
  });

  it("estimates discount and exclusive tax totals", () => {
    const totals = estimateSaleTotals(
      [
        { product: products[0], quantity: 2 },
        { product: products[2], quantity: 1 },
      ],
      5000,
      { taxPercent: "10", taxInclusive: false },
    );

    assert.deepEqual(totals, {
      subtotal: 58000,
      discountAmount: 5000,
      taxAmount: 5300,
      totalNet: 58300,
    });
  });

  it("maps keyboard shortcuts and ignores +/- while typing", () => {
    assert.equal(resolveCashierShortcut({ key: "F2" }), "focusSearch");
    assert.equal(resolveCashierShortcut({ key: "F4" }), "pay");
    assert.equal(resolveCashierShortcut({ key: "F8" }), "hold");
    assert.equal(resolveCashierShortcut({ key: "F9" }), "restore");
    assert.equal(resolveCashierShortcut({ key: "+", targetTagName: "DIV" }), "qtyUp");
    assert.equal(resolveCashierShortcut({ key: "-", targetTagName: "DIV" }), "qtyDown");
    assert.equal(resolveCashierShortcut({ key: "+", targetTagName: "INPUT" }), null);
  });

  it("adjusts quantity of the last cart item", () => {
    const cart = [
      { product: products[0], quantity: 1 },
      { product: products[1], quantity: 2 },
    ];
    assert.equal(adjustLastCartQty(cart, 1)[1]?.quantity, 3);
    assert.equal(adjustLastCartQty(cart, -2).length, 1);
  });

  it("holds an active cart up to three slots", () => {
    const first = holdActiveCart([], {
      items: [{ product: products[0], quantity: 1 }],
      discount: "0",
      customerId: "",
    });
    assert.equal(first.holds.length, 1);
    assert.equal(first.error, undefined);

    const empty = holdActiveCart([], { items: [], discount: "0", customerId: "" });
    assert.equal(empty.error, "Keranjang kosong.");

    let holds = first.holds;
    holds = holdActiveCart(holds, { items: [{ product: products[1], quantity: 1 }], discount: "0", customerId: "" }).holds;
    holds = holdActiveCart(holds, { items: [{ product: products[2], quantity: 1 }], discount: "0", customerId: "" }).holds;
    const overflow = holdActiveCart(holds, { items: [{ product: products[0], quantity: 2 }], discount: "0", customerId: "" });
    assert.equal(overflow.holds.length, 3);
    assert.match(overflow.error ?? "", /Maksimal 3/);
  });
});
