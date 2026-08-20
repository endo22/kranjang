"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, downloadApi } from "@/lib/api";
import { formatRp, todayIso } from "@/lib/format";

type ProductProfit = {
  name: string;
  qty: number;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  targetMargin: number | null;
  vsTarget: number | null;
};

type Summary = {
  dashboard: { revenue: number; cogs: number; grossProfit: number; expense: number; netProfit: number; transactionCount: number };
  profitLoss: { revenue: number; netProfit: number };
  productProfitability: ProductProfit[];
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

  async function exportReport(format: "csv" | "pdf", type: "profit-loss" | "product-profitability" = "profit-loss") {
    try {
      await downloadApi(`/reports/${type}/export?from=${from}&to=${to}&format=${format}`, `${type}.${format}`);
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
          <Button variant="outline" onClick={() => void exportReport("csv", "product-profitability")}>
            Export margin CSV
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
        {data?.productProfitability?.length ? (
          <div className="space-y-2">
            <p className="font-medium">Margin vs target</p>
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[#616161]">
                    <th className="px-3 py-2">Produk</th>
                    <th>Margin %</th>
                    <th>Target %</th>
                    <th>Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {data.productProfitability.slice(0, 20).map((row) => (
                    <tr key={row.name} className="border-b border-[#f3f3f3]">
                      <td className="px-3 py-2">{row.name}</td>
                      <td>{row.margin}</td>
                      <td>{row.targetMargin === null ? "—" : row.targetMargin}</td>
                      <td>{row.vsTarget === null ? "—" : row.vsTarget}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
