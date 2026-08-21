"use client";

import { resetPasswordSchema } from "@kranjang/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthMessage, AuthPageGuard, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const invalidTokenMessage = "Tautan tidak valid atau kedaluwarsa.";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageGuard>
          <AuthShell title="Reset password" description="Sedang menyiapkan tautan reset password Anda.">
            <p className="text-sm leading-6 text-[#616161]">Mohon tunggu sebentar.</p>
          </AuthShell>
        </AuthPageGuard>
      }
    >
      <ResetPasswordPageContent />
    </Suspense>
  );
}

function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ token, password });

    if (!parsed.success) {
      const hasTokenIssue = parsed.error.issues.some((issue) => issue.path.includes("token"));
      setError(hasTokenIssue ? invalidTokenMessage : "Password minimal 8 karakter.");
      setSuccess(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api<{ ok: true }>("/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });
      setSuccess("Password berhasil diubah. Silakan masuk dengan password baru.");
      setPassword("");
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
        title="Reset password"
        description="Masukkan password baru untuk mengaktifkan kembali akses akun Anda."
        footer={
          <>
            Sudah siap masuk?{" "}
            <Link href="/login" className="font-medium text-[#17171c] underline underline-offset-4">
              Buka halaman masuk
            </Link>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">Password baru</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </div>

          <AuthMessage message={error} />
          <AuthMessage message={success} tone="success" />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sedang menyimpan..." : "Simpan password baru"}
          </Button>
        </form>
      </AuthShell>
    </AuthPageGuard>
  );
}
