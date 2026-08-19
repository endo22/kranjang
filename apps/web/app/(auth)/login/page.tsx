"use client";

import { loginSchema } from "@kranjang/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthMessage, AuthPageGuard, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

const initialForm = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse(form);

    if (!parsed.success) {
      setError("Masukkan email yang valid dan password Anda.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login(parsed.data);
      router.push("/app");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageGuard>
      <AuthShell
        title="Masuk"
        description="Lanjutkan ke akun Kranjang untuk mengelola operasional usaha Anda."
        footer={
          <>
            Belum punya akun?{" "}
            <Link href="/register" className="font-medium text-[#17171c] underline underline-offset-4">
              Daftar
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
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="nama@usaha.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm text-[#616161] underline underline-offset-4">
                Lupa password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Masukkan password"
            />
          </div>

          <AuthMessage message={error} />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sedang masuk..." : "Masuk"}
          </Button>
        </form>
      </AuthShell>
    </AuthPageGuard>
  );
}
