export type MovementFilters = {
  from: string;
  to: string;
  productId: string;
};

export type InventoryAdjustmentDraft = {
  movementType: string;
  notes: string;
};

export type InventoryProduct = {
  id: string;
  name: string;
  productType: string;
  stock: number;
  minStock: number;
};

export function buildInventoryMovementsPath(filters: MovementFilters) {
  const params = new URLSearchParams();

  if (filters.from) {
    params.set("from", `${filters.from}T00:00:00.000+07:00`);
  }

  if (filters.to) {
    params.set("to", `${filters.to}T23:59:59.999+07:00`);
  }

  if (filters.productId) {
    params.set("productId", filters.productId);
  }

  const query = params.toString();
  return query ? `/inventory/movements?${query}` : "/inventory/movements";
}

export function validateInventoryAdjustment(draft: InventoryAdjustmentDraft) {
  if (draft.movementType === "WASTE" && !draft.notes.trim()) {
    return "Catatan wajib untuk waste.";
  }

  return null;
}

export function getLowStockProducts(products: InventoryProduct[]) {
  return products
    .filter((product) => product.productType !== "RECIPE" && product.minStock > 0 && product.stock <= product.minStock)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      minStock: product.minStock,
    }))
    .sort((left, right) => left.stock - right.stock || left.name.localeCompare(right.name));
}
