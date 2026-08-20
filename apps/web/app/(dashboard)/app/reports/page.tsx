"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, downloadApi } from "@/lib/api";
import { formatRp, todayIso } from "@/lib/format";

type Summary = {
  dashboard: { revenue: number; cogs: number; grossProfit: number; expense: number; netProfit: number; transactionCount: number };
  profitLoss: { revenue: number; netProfit: number };
};

export default function ReportsPage() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<Summary | null>(null);

  async function load() {
    setData(await api(`/reports/profit-loss?from=${from}&to=${to}`));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  async function exportReport(format: "csv" | "pdf") {
    try {
      await downloadApi(`/reports/profit-loss/export?from=${from}&to=${to}&format=${format}`, `profit-loss.${format}`);
      toast.success(`Laporan ${format.toUpperCase()} diunduh.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunduh");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <Button onClick={() => void load()}>Terapkan</Button>
          <Button variant="outline" onClick={() => void exportReport("csv")}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => void exportReport("pdf")}>
            Export PDF
          </Button>
        </div>
        {data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <p>Omzet {formatRp(data.dashboard.revenue)}</p>
            <p>HPP {formatRp(data.dashboard.cogs)}</p>
            <p>Laba kotor {formatRp(data.dashboard.grossProfit)}</p>
            <p>Biaya {formatRp(data.dashboard.expense)}</p>
            <p>Laba bersih {formatRp(data.dashboard.netProfit)}</p>
            <p>Transaksi {data.dashboard.transactionCount}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
