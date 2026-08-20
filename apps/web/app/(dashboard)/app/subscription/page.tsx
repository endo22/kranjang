"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, jsonInit } from "@/lib/api";
import { formatRp } from "@/lib/format";

type Billing = {
  subscriptionStatus: string;
  trialEndDate: string;
  plan: { code: string; name: string } | null;
  latest: { payments: Array<{ orderId: string; status: string; amount: number }> } | null;
};

type CheckoutResult = {
  orderId: string;
  snapToken: string | null;
  clientKey: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  business: "Business",
  pro: "Pro",
};

const allowMockPay = process.env.NODE_ENV !== "production";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: () => void;
          onPending?: () => void;
          onError?: () => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "TRIAL":
      return "Masa percobaan";
    case "ACTIVE":
      return "Aktif";
    case "EXPIRED":
      return "Berakhir";
    case "SUSPENDED":
      return "Ditangguhkan";
    default:
      return status;
  }
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "PAID":
      return "Lunas";
    case "PENDING":
      return "Menunggu";
    case "FAILED":
      return "Gagal";
    default:
      return status;
  }
}

function snapScriptUrl() {
  return process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

function loadSnapScript(clientKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.snap) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-kranjang-snap]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Gagal memuat Midtrans Snap")));
      return;
    }
    const script = document.createElement("script");
    script.src = snapScriptUrl();
    script.setAttribute("data-client-key", clientKey);
    script.setAttribute("data-kranjang-snap", "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Midtrans Snap"));
    document.body.appendChild(script);
  });
}

export default function SubscriptionPage() {
  const [data, setData] = useState<Billing | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  async function load() {
    setData(await api<Billing>("/billing/current"));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  async function activatePlan(planCode: "basic" | "business" | "pro") {
    setBusyPlan(planCode);
    try {
      const result = await api<CheckoutResult>("/billing/checkout", {
        method: "POST",
        ...jsonInit({ planCode, billingCycle: "monthly" }),
      });

      if (result.snapToken && result.clientKey) {
        await loadSnapScript(result.clientKey);
        if (!window.snap) {
          throw new Error("Midtrans Snap belum siap.");
        }
        window.snap.pay(result.snapToken, {
          onSuccess: () => {
            toast.success(`Pembayaran paket ${PLAN_LABELS[planCode]} berhasil.`);
            void load();
          },
          onPending: () => {
            toast.message("Pembayaran menunggu konfirmasi Midtrans.");
            void load();
          },
          onError: () => toast.error("Pembayaran Midtrans gagal."),
          onClose: () => void load(),
        });
        return;
      }

      if (!allowMockPay) {
        toast.error("Pembayaran Midtrans belum dikonfigurasi.");
        return;
      }

      await api("/billing/mock-pay", { method: "POST", ...jsonInit({ orderId: result.orderId }) });
      toast.success(`Paket ${PLAN_LABELS[planCode]} diaktifkan (mode pengembangan).`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal");
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Langganan</CardTitle>
        <CardDescription>Status paket dan riwayat pembayaran toko Anda.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p>
            Status: <span className="font-medium">{data ? statusLabel(data.subscriptionStatus) : "…"}</span>
          </p>
          <p>
            Paket saat ini: <span className="font-medium">{data?.plan?.name ?? "Belum memilih paket"}</span>
          </p>
          <p>
            Trial berakhir:{" "}
            {data?.trialEndDate ? new Date(data.trialEndDate).toLocaleDateString("id-ID") : "-"}
          </p>
        </div>
        <p className="text-sm text-[#616161]">
          {allowMockPay
            ? "Aktifkan paket (dev: mock-pay bila Snap belum dikonfigurasi):"
            : "Aktifkan paket melalui Midtrans Snap:"}
        </p>
        <div className="flex flex-wrap gap-3">
          {(["basic", "business", "pro"] as const).map((planCode) => (
            <Button
              key={planCode}
              variant="outline"
              disabled={busyPlan !== null}
              onClick={() => {
                void activatePlan(planCode);
              }}
            >
              {busyPlan === planCode ? "Memproses…" : `Aktifkan ${PLAN_LABELS[planCode]}`}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Riwayat pembayaran</p>
          {data?.latest?.payments?.length ? (
            data.latest.payments.map((payment) => (
              <p key={payment.orderId} className="text-sm">
                {payment.orderId} · {paymentStatusLabel(payment.status)} · {formatRp(payment.amount)}
              </p>
            ))
          ) : (
            <p className="text-sm text-[#616161]">Belum ada pembayaran.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
