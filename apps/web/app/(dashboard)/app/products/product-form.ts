export type ProductType = "INGREDIENT" | "SIMPLE" | "RECIPE";

export type ProductDetail = {
  id: string;
  name: string;
  productType: ProductType;
  unit: string;
  sellPrice: number;
  buyPrice: number;
  stock: number;
  hpp: number;
  categoryId: string | null;
  barcode: string | null;
  minStock: number;
  targetMargin: number | null;
  imageUrl: string | null;
  isActive: boolean;
  recipe: Array<{
    ingredientId: string;
    quantity: number;
    unit: string;
    ingredientName?: string;
  }>;
};

export type ProductFormState = {
  name: string;
  productType: ProductType;
  unit: string;
  sellPrice: string;
  buyPrice: string;
  categoryId: string;
  barcode: string;
  minStock: string;
  targetMargin: string;
  imageUrl: string;
  isActive: boolean;
};

export type RecipeDraftItem = {
  ingredientId: string;
  quantity: string;
};

export function createEmptyProductForm(): ProductFormState {
  return {
    name: "",
    productType: "SIMPLE",
    unit: "pcs",
    sellPrice: "0",
    buyPrice: "0",
    categoryId: "",
    barcode: "",
    minStock: "0",
    targetMargin: "",
    imageUrl: "",
    isActive: true,
  };
}

export function toProductFormState(product: ProductDetail): ProductFormState {
  return {
    name: product.name,
    productType: product.productType,
    unit: product.unit,
    sellPrice: String(product.sellPrice),
    buyPrice: String(product.buyPrice),
    categoryId: product.categoryId ?? "",
    barcode: product.barcode ?? "",
    minStock: String(product.minStock),
    targetMargin: product.targetMargin === null || product.targetMargin === undefined ? "" : String(product.targetMargin),
    imageUrl: product.imageUrl ?? "",
    isActive: product.isActive,
  };
}

export function buildProductPayload(form: ProductFormState) {
  return {
    name: form.name,
    productType: form.productType,
    unit: form.unit,
    sellPrice: Number(form.sellPrice),
    buyPrice: Number(form.buyPrice),
    categoryId: form.categoryId || null,
    barcode: form.barcode || null,
    minStock: Number(form.minStock) || 0,
    targetMargin: form.targetMargin.trim() === "" ? null : Number(form.targetMargin),
    imageUrl: form.imageUrl || null,
    isActive: form.isActive,
  };
}

export function buildRecipePayload(items: RecipeDraftItem[]) {
  return {
    items: items
      .map((item) => ({
        ingredientId: item.ingredientId,
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.ingredientId && Number.isFinite(item.quantity) && item.quantity > 0),
  };
}
