import { z } from "zod";

export const registerSchema = z.object({
  businessName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
  phone: z.string().min(10).max(20),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(72),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
