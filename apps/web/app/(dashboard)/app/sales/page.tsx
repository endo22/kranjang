"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";
import { formatRp, todayIso } from "@/lib/format";

type SaleItem = { productId: string; quantity: number; lineTotal: number };
type Sale = {
  id: string;
  receiptNo: string;
  totalNet: number;
  status: string;
  soldAt?: string;
  notes?: string | null;
  discountAmount?: number;
  taxAmount?: number;
  items?: SaleItem[];
  payments?: Array<{ method: string; amount: number }>;
  customer?: { name: string } | null;
};

export default function SalesPage() {
  const [rows, setRows] = useState<Sale[]>([]);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [cancelReason, setCancelReason] = useState("");

  async function load() {
    const params = new URLSearchParams({ from, to, limit: "50", offset: "0" });
    const page = await api<{ items: Sale[] }>(`/sales?${params.toString()}`);
    setRows(page.items);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penjualan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>

        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm">
            <button
              type="button"
              className="text-left hover:underline"
              onClick={() => {
                void api<Sale>(`/sales/${row.id}`)
                  .then(setDetail)
                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
              }}
            >
              {row.receiptNo} · {row.status} · {formatRp(row.totalNet)}
            </button>
            {row.status === "COMPLETED" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-48"
                  placeholder="Alasan batal"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void api(`/sales/${row.id}/cancel`, {
                      method: "POST",
                      ...jsonInit({ reason: cancelReason || "Dibatalkan kasir" }),
                    })
                      .then(() => {
                        setCancelReason("");
                        return load();
                      })
                      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                  }}
                >
                  Batalkan
                </Button>
              </div>
            ) : null}
          </div>
        ))}

        {detail ? (
          <div className="space-y-2 rounded-2xl border p-4 text-sm">
            <p className="font-medium">
              {detail.receiptNo} · {detail.status}
            </p>
            <p>Pelanggan: {detail.customer?.name ?? "-"}</p>
            <p>
              Diskon {formatRp(detail.discountAmount ?? 0)} · Pajak {formatRp(detail.taxAmount ?? 0)} · Total{" "}
              {formatRp(detail.totalNet)}
            </p>
            {(detail.items ?? []).map((item) => (
              <p key={`${detail.id}-${item.productId}`}>
                {item.productId.slice(0, 8)}… × {item.quantity} = {formatRp(item.lineTotal)}
              </p>
            ))}
            {detail.notes ? <p>Catatan: {detail.notes}</p> : null}
            <Button variant="outline" onClick={() => setDetail(null)}>
              Tutup
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
