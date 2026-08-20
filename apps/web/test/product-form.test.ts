import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProductPayload,
  buildRecipePayload,
  createEmptyProductForm,
  toProductFormState,
  type ProductDetail,
} from "../app/(dashboard)/app/products/product-form";

describe("product form helpers", () => {
  it("creates empty form with safe defaults", () => {
    assert.deepEqual(createEmptyProductForm(), {
      name: "",
      productType: "SIMPLE",
      unit: "pcs",
      sellPrice: "0",
      buyPrice: "0",
      categoryId: "",
      barcode: "",
      minStock: "0",
      imageUrl: "",
      isActive: true,
    });
  });

  it("maps product detail into editable form state", () => {
    const product: ProductDetail = {
      id: "prod-1",
      name: "Es Teh",
      productType: "RECIPE",
      unit: "cup",
      sellPrice: 12000,
      buyPrice: 2500,
      stock: 8,
      hpp: 3000,
      categoryId: "cat-1",
      barcode: "899123",
      minStock: 5,
      imageUrl: "https://cdn.example.com/es-teh.jpg",
      isActive: false,
      recipe: [{ ingredientId: "ing-1", quantity: 2, unit: "gram", ingredientName: "Teh" }],
    };

    assert.deepEqual(toProductFormState(product), {
      name: "Es Teh",
      productType: "RECIPE",
      unit: "cup",
      sellPrice: "12000",
      buyPrice: "2500",
      categoryId: "cat-1",
      barcode: "899123",
      minStock: "5",
      imageUrl: "https://cdn.example.com/es-teh.jpg",
      isActive: false,
    });
  });

  it("builds product payload with null-safe optional fields", () => {
    assert.deepEqual(
      buildProductPayload({
        name: "Keripik",
        productType: "SIMPLE",
        unit: "pcs",
        sellPrice: "15000",
        buyPrice: "8000",
        categoryId: "",
        barcode: "",
        minStock: "",
        imageUrl: "",
        isActive: true,
      }),
      {
        name: "Keripik",
        productType: "SIMPLE",
        unit: "pcs",
        sellPrice: 15000,
        buyPrice: 8000,
        categoryId: null,
        barcode: null,
        minStock: 0,
        imageUrl: null,
        isActive: true,
      },
    );
  });

  it("builds recipe payload from valid rows only", () => {
    assert.deepEqual(
      buildRecipePayload([
        { ingredientId: "", quantity: "" },
        { ingredientId: "ing-1", quantity: "1.5" },
        { ingredientId: "ing-2", quantity: "0" },
        { ingredientId: "ing-3", quantity: "2" },
      ]),
      {
        items: [
          { ingredientId: "ing-1", quantity: 1.5 },
          { ingredientId: "ing-3", quantity: 2 },
        ],
      },
    );
  });
});
