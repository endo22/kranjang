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
};

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  business: "Business",
  pro: "Pro",
};

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

export default function SubscriptionPage() {
  const [data, setData] = useState<Billing | null>(null);

  async function load() {
    setData(await api<Billing>("/billing/current"));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

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
        <p className="text-sm text-[#616161]">Aktifkan paket (mode pengembangan — pembayaran uji):</p>
        <div className="flex flex-wrap gap-3">
          {(["basic", "business", "pro"] as const).map((planCode) => (
            <Button
              key={planCode}
              variant="outline"
              onClick={() => {
                void api<CheckoutResult>("/billing/checkout", {
                  method: "POST",
                  ...jsonInit({ planCode, billingCycle: "monthly" }),
                })
                  .then(async (result) => {
                    await api("/billing/mock-pay", { method: "POST", ...jsonInit({ orderId: result.orderId }) });
                    toast.success(`Paket ${PLAN_LABELS[planCode]} diaktifkan (mode pengembangan).`);
                    await load();
                  })
                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
              }}
            >
              Aktifkan {PLAN_LABELS[planCode]}
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
