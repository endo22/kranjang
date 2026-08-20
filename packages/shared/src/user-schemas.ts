import { z } from "zod";

export const patchMeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).nullable().optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
  phone: z.string().min(10).max(20).optional(),
  roleId: z.string().uuid(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).nullable().optional(),
  roleId: z.string().uuid().optional(),
});

export const patchSettingsSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).nullable().optional(),
  timezone: z.string().min(3).max(40).optional(),
  allowNegativeStock: z.boolean().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  receiptFooter: z.string().max(2000).nullable().optional(),
  receiptLogoUrl: z.string().url().max(255).nullable().optional(),
  receiptQrPayload: z.string().trim().max(255).nullable().optional(),
});
