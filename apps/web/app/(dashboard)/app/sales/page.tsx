"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatRp } from "@/lib/format";

type Sale = { id: string; receiptNo: string; totalNet: number; status: string };

export default function SalesPage() {
  const [rows, setRows] = useState<Sale[]>([]);

  async function load() {
    setRows(await api("/sales"));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penjualan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
            <span>{row.receiptNo} · {row.status} · {formatRp(row.totalNet)}</span>
            {row.status === "COMPLETED" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api(`/sales/${row.id}/cancel`, { method: "POST" })
                    .then(() => load())
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                }}
              >
                Batal
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
