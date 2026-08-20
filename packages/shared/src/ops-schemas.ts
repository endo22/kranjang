import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  productType: z.enum(["INGREDIENT", "SIMPLE", "RECIPE"]),
  unit: z.string().trim().min(1).max(20),
  categoryId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  sku: optionalText,
  barcode: optionalText,
  buyPrice: z.number().min(0),
  sellPrice: z.number().min(0),
  minStock: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url().max(255).optional().nullable(),
});

export const patchProductSchema = productSchema.partial().refine((body) => Object.keys(body).length > 0, {
  message: "Body tidak boleh kosong.",
});

export const recipeSchema = z.object({
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        quantity: z.number().positive(),
      }),
    )
    .min(1),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optionalText,
  address: optionalText,
});

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optionalText,
});

export const purchaseSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceNo: z.string().trim().min(1).max(60),
  purchasedAt: z.string().min(8).max(32),
  discountAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
  notes: optionalText,
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
      }),
    )
    .min(1),
});

export const inventoryAdjustSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number(),
    movementType: z.enum(["ADJUSTMENT", "WASTE", "INITIAL_STOCK"]),
    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.movementType === "WASTE" && !value.notes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Catatan wajib untuk waste.",
        path: ["notes"],
      });
    }
  });

export const cashierOpenSchema = z.object({
  openingCash: z.number().min(0).optional(),
});

export const cashierCloseSchema = z.object({
  closingCash: z.number().min(0),
  closingNotes: z.string().trim().max(255).optional().nullable(),
});

export const saleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  discountAmount: z.number().min(0).optional(),
  notes: optionalText,
  paymentMethod: z.enum(["CASH", "QRIS", "TRANSFER", "EWALLET", "CARD"]),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        discountAmount: z.number().min(0).optional(),
      }),
    )
    .min(1),
});

export const expenseSchema = z.object({
  categoryId: z.string().uuid(),
  description: z.string().trim().min(2).max(255),
  amount: z.number().positive(),
  expenseDate: z.string().min(8).max(32),
  paymentMethod: z.enum(["CASH", "QRIS", "TRANSFER", "EWALLET", "CARD"]),
  attachmentPath: optionalText,
});

export const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const checkoutSchema = z.object({
  planCode: z.enum(["basic", "business", "pro"]),
  billingCycle: z.enum(["monthly", "annual"]),
});

export const mockPaySchema = z.object({
  orderId: z.string().min(8).max(64),
});

export const adminLoginSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export const adminTenantStatusSchema = z.object({
  subscriptionStatus: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED", "TRIAL", "GRACE_PERIOD"]),
});

export const adminPlanSchema = z.object({
  name: z.string().min(2).max(80),
  priceMonthly: z.number().min(0),
  durationDays: z.number().int().positive(),
  maxOutlets: z.number().int().positive(),
  featureReports: z.boolean(),
  featureInventory: z.boolean(),
  featureMultiOutlet: z.boolean(),
  featureExport: z.boolean(),
  isActive: z.boolean().optional(),
});

export type ProductBody = z.infer<typeof productSchema>;
export type PurchaseBody = z.infer<typeof purchaseSchema>;
export type SaleBody = z.infer<typeof saleSchema>;
