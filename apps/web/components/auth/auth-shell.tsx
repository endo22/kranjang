"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

type AuthMessageProps = {
  message: string | null;
  tone?: "error" | "success";
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f7f8] px-6 py-10 text-[#212121] lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-2xl text-[#17171c]">
            Kranjang
          </Link>
          <Link href="/" className="text-sm text-[#616161] transition-colors hover:text-[#17171c]">
            Kembali ke beranda
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-[#75758a]">Akses akun</p>
            <h1 className="font-display text-4xl leading-tight tracking-[-0.03em] text-[#17171c] sm:text-5xl">
              Kelola warung dengan alur masuk yang sederhana.
            </h1>
            <p className="max-w-xl text-base leading-7 text-[#616161]">
              Masuk, daftar, atau pulihkan akses akun Kranjang untuk melanjutkan operasional usaha Anda.
            </p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {children}
              {footer ? <div className="text-sm leading-6 text-[#616161]">{footer}</div> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AuthMessage({ message, tone = "error" }: AuthMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={
        tone === "success"
          ? "rounded-2xl border border-[#cde7d3] bg-[#f3fbf5] px-4 py-3 text-sm text-[#1f6a37]"
          : "rounded-2xl border border-[#f0c9c9] bg-[#fff5f5] px-4 py-3 text-sm text-[#a32626]"
      }
    >
      {message}
    </div>
  );
}

export function AuthPageGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, status } = useAuth();

  useEffect(() => {
    if (status === "ready" && session) {
      router.replace("/app");
    }
  }, [router, session, status]);

  if (status === "loading") {
    return (
      <AuthShell title="Memeriksa sesi" description="Sedang menyiapkan akses akun Anda.">
        <p className="text-sm leading-6 text-[#616161]">Mohon tunggu sebentar.</p>
      </AuthShell>
    );
  }

  if (session) {
    return null;
  }

  return <>{children}</>;
}
