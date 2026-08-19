"use client";

import { forgotPasswordSchema } from "@kranjang/shared";
import Link from "next/link";
import { useState } from "react";

import { AuthMessage, AuthPageGuard, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const successMessage = "Jika email terdaftar, tautan dikirim.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });

    if (!parsed.success) {
      setError("Masukkan email yang valid.");
      setSuccess(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api<{ ok: true }>("/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });
      setSuccess(successMessage);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Terjadi kesalahan. Silakan coba lagi.");
      setSuccess(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageGuard>
      <AuthShell
        title="Lupa password"
        description="Masukkan email akun Anda untuk menerima tautan reset password."
        footer={
          <>
            Sudah ingat password?{" "}
            <Link href="/login" className="font-medium text-[#17171c] underline underline-offset-4">
              Kembali ke masuk
            </Link>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@usaha.com"
            />
          </div>

          <AuthMessage message={error} />
          <AuthMessage message={success} tone="success" />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sedang mengirim..." : "Kirim tautan reset"}
          </Button>
        </form>
      </AuthShell>
    </AuthPageGuard>
  );
}
