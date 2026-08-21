"use client";

import { verifyEmailSchema } from "@kranjang/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthMessage, AuthPageGuard, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const invalidTokenMessage = "Tautan tidak valid atau kedaluwarsa.";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthPageGuard>
          <AuthShell title="Verifikasi email" description="Sedang menyiapkan tautan verifikasi Anda.">
            <p className="text-sm leading-6 text-[#616161]">Mohon tunggu sebentar.</p>
          </AuthShell>
        </AuthPageGuard>
      }
    >
      <VerifyEmailPageContent />
    </Suspense>
  );
}

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Sedang memverifikasi email Anda.");

  useEffect(() => {
    const parsed = verifyEmailSchema.safeParse({ token });

    if (!parsed.success) {
      setStatus("error");
      setMessage(invalidTokenMessage);
      return;
    }

    let active = true;

    void (async () => {
      try {
        await api<{ ok: true }>("/auth/verify-email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(parsed.data),
        });

        if (!active) {
          return;
        }

        setStatus("success");
        setMessage("Email berhasil diverifikasi. Anda bisa masuk ke aplikasi.");
      } catch (verifyError) {
        if (!active) {
          return;
        }

        setStatus("error");
        setMessage(verifyError instanceof Error ? verifyError.message : "Terjadi kesalahan. Silakan coba lagi.");
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <AuthPageGuard>
      <AuthShell
        title="Verifikasi email"
        description="Kami sedang memeriksa tautan verifikasi untuk akun Anda."
        footer={
          <>
            Butuh akses cepat?{" "}
            <Link href="/login" className="font-medium text-[#17171c] underline underline-offset-4">
              Buka halaman masuk
            </Link>
          </>
        }
      >
        {status === "loading" ? (
          <p className="text-sm leading-6 text-[#616161]">{message}</p>
        ) : (
          <AuthMessage message={message} tone={status === "success" ? "success" : "error"} />
        )}

        <Button asChild className="w-full">
          <Link href={status === "success" ? "/login" : "/register"}>
            {status === "success" ? "Lanjut ke masuk" : "Kembali ke daftar"}
          </Link>
        </Button>
      </AuthShell>
    </AuthPageGuard>
  );
}
