"use client";

import { registerSchema } from "@kranjang/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthMessage, AuthPageGuard, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

const initialForm = {
  businessName: "",
  ownerName: "",
  email: "",
  password: "",
  phone: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = registerSchema.safeParse(form);

    if (!parsed.success) {
      setError("Lengkapi nama usaha, nama pemilik, email, password, dan nomor telepon dengan benar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await register(parsed.data);
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
        title="Daftar"
        description="Buat akun tenant baru untuk mulai memakai Kranjang."
        footer={
          <>
            Sudah punya akun?{" "}
            <Link href="/login" className="font-medium text-[#17171c] underline underline-offset-4">
              Masuk
            </Link>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="businessName">Nama usaha</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
              placeholder="Warung Nusantara"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Nama pemilik</Label>
            <Input
              id="ownerName"
              value={form.ownerName}
              onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
              placeholder="Budi Santoso"
            />
          </div>

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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Minimal 8 karakter"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Nomor telepon</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="081234567890"
            />
          </div>

          <AuthMessage message={error} />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sedang membuat akun..." : "Daftar"}
          </Button>
        </form>
      </AuthShell>
    </AuthPageGuard>
  );
}
