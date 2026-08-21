"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatRp, todayIso } from "@/lib/format";

type Dashboard = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  netProfit: number;
  transactionCount: number;
  topProducts: Array<{ name: string; qty: number }>;
  lowStock: Array<{ id: string; name: string; stock: number; minStock: number }>;
  salesChangePct: number | null;
  profitChangePct: number | null;
  previous?: { from: string; to: string; revenue: number; netProfit: number };
};

function formatChange(pct: number | null) {
  if (pct === null) {
    return "vs periode lalu: n/a";
  }
  const sign = pct > 0 ? "+" : "";
  return `vs periode lalu: ${sign}${pct}%`;
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const today = todayIso();

  useEffect(() => {
    void api<Dashboard>(`/dashboard?from=${today}&to=${today}`)
      .then(setData)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuat dashboard."));
  }, [today]);

  if (!session) {
    return null;
  }

  const trialDaysRemaining = Math.max(0, Math.ceil((new Date(session.tenant.trialEndDate).getTime() - Date.now()) / 86400000));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Omzet hari ini</CardTitle>
            <CardDescription>{data ? formatRp(data.revenue) : "…"}</CardDescription>
            <p className="text-xs text-[#616161]">{data ? formatChange(data.salesChangePct) : null}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Laba kotor</CardTitle>
            <CardDescription>{data ? formatRp(data.grossProfit) : "…"}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Laba bersih</CardTitle>
            <CardDescription>{data ? formatRp(data.netProfit) : "…"}</CardDescription>
            <p className="text-xs text-[#616161]">{data ? formatChange(data.profitChangePct) : null}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trial</CardTitle>
            <CardDescription>
              {trialDaysRemaining} hari · {session.tenant.subscriptionStatus}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stok menipis</CardTitle>
          <CardDescription>
            <Link href="/app/inventory" className="text-sm underline">
              Kelola di inventori
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.lowStock.length ? (
            data.lowStock.map((row) => (
              <p key={row.id} className="text-sm">
                <Link href={`/app/inventory?productId=${row.id}`} className="underline">
                  {row.name}
                </Link>
                : {row.stock} (min {row.minStock})
              </p>
            ))
          ) : (
            <p className="text-sm text-[#616161]">Tidak ada peringatan stok.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
