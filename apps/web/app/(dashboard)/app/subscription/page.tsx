"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, jsonInit } from "@/lib/api";
import { formatRp } from "@/lib/format";

type Billing = {
  subscriptionStatus: string;
  trialEndDate: string;
  latest: { payments: Array<{ orderId: string; status: string; amount: number }> } | null;
};

type CheckoutResult = {
  orderId: string;
};

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
      </CardHeader>
      <CardContent className="space-y-4">
        <p>Status: {data?.subscriptionStatus}</p>
        <p>Trial berakhir: {data?.trialEndDate ? new Date(data.trialEndDate).toLocaleDateString("id-ID") : "-"}</p>
        <div className="flex flex-wrap gap-3">
          {["basic", "business", "pro"].map((planCode) => (
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
                    toast.success("Paket diaktifkan (mode pengembangan).");
                    await load();
                  })
                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
              }}
            >
              Bayar {planCode}
            </Button>
          ))}
        </div>
        {data?.latest?.payments.map((payment) => (
          <p key={payment.orderId} className="text-sm">{payment.orderId} · {payment.status} · {formatRp(payment.amount)}</p>
        ))}
      </CardContent>
    </Card>
  );
}
