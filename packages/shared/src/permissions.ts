export const PERMISSION_CODES = [
  "product.view",
  "product.create",
  "product.update",
  "product.delete",
  "recipe.manage",
  "sales.view",
  "sales.create",
  "sales.cancel",
  "purchase.view",
  "purchase.create",
  "purchase.receive",
  "inventory.view",
  "inventory.adjust",
  "expense.view",
  "expense.create",
  "expense.update",
  "expense.delete",
  "report.view",
  "user.manage",
  "subscription.manage",
  "settings.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const ROLE_TEMPLATE_NAMES = [
  "Owner",
  "Administrator",
  "Manager",
  "Cashier",
  "Inventory Staff",
] as const;

export const ROLE_TEMPLATE_PERMISSIONS: Record<(typeof ROLE_TEMPLATE_NAMES)[number], readonly PermissionCode[]> = {
  Owner: PERMISSION_CODES,
  Administrator: PERMISSION_CODES.filter((c) => c !== "subscription.manage"),
  Manager: [
    "product.view",
    "product.update",
    "recipe.manage",
    "sales.view",
    "purchase.view",
    "inventory.view",
    "expense.view",
    "report.view",
    "settings.manage",
  ],
  Cashier: ["product.view", "sales.view", "sales.create"],
  "Inventory Staff": [
    "product.view",
    "product.create",
    "product.update",
    "recipe.manage",
    "purchase.view",
    "purchase.create",
    "purchase.receive",
    "inventory.view",
    "inventory.adjust",
  ],
};

export const EXPENSE_CATEGORY_NAMES = [
  "listrik",
  "air",
  "internet",
  "sewa",
  "gaji",
  "transportasi",
  "maintenance",
  "marketing",
  "lainnya",
] as const;
