"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";
import { formatRp } from "@/lib/format";

type Supplier = { id: string; name: string };
type Product = { id: string; name: string };
type PurchaseItem = { productId: string; quantity: number; unitCost: number; lineTotal: number };
type Purchase = {
  id: string;
  invoiceNo: string;
  documentStatus: string;
  totalAmount: number;
  purchasedAt: string;
  supplier?: { id: string; name: string } | null;
  items: PurchaseItem[];
};

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Purchase[]>([]);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("0");
  const [invoiceNo, setInvoiceNo] = useState("");

  async function load() {
    const [nextSuppliers, nextProducts, nextRows] = await Promise.all([
      api<Supplier[]>("/suppliers"),
      api<Product[]>("/products"),
      api<Purchase[]>("/purchases"),
    ]);
    setSuppliers(nextSuppliers);
    setProducts(nextProducts);
    setRows(nextRows);
    setSupplierId((value) => value || nextSuppliers[0]?.id || "");
    setProductId((value) => value || nextProducts[0]?.id || "");
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  async function openDetail(id: string) {
    const row = await api<Purchase>(`/purchases/${id}`);
    setDetail(row);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pembelian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 lg:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              void api("/purchases", {
                method: "POST",
                ...jsonInit({
                  supplierId,
                  invoiceNo,
                  purchasedAt: new Date().toISOString().slice(0, 10),
                  items: [{ productId, quantity: Number(qty), unitCost: Number(cost) }],
                }),
              })
                .then(() => {
                  setInvoiceNo("");
                  return load();
                })
                .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
            }}
          >
            <Input placeholder="No invoice" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} required />
            <select className="h-11 rounded-2xl border px-3" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              {suppliers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select className="h-11 rounded-2xl border px-3" value={productId} onChange={(event) => setProductId(event.target.value)}>
              {products.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <Input type="number" value={qty} onChange={(event) => setQty(event.target.value)} placeholder="Qty" />
            <Input type="number" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="Harga" />
            <Button type="submit" className="lg:col-span-5">
              Buat draft
            </Button>
          </form>

          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm">
              <button type="button" className="text-left hover:underline" onClick={() => void openDetail(row.id).catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"))}>
                {row.invoiceNo} · {row.documentStatus} · {formatRp(row.totalAmount)}
              </button>
              {row.documentStatus === "DRAFT" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void api(`/purchases/${row.id}/receive`, { method: "POST" })
                        .then(() => load())
                        .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                    }}
                  >
                    Terima
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void api(`/purchases/${row.id}/cancel`, { method: "POST" })
                        .then(() => load())
                        .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                    }}
                  >
                    Batalkan
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle>Detail {detail.invoiceNo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Status: {detail.documentStatus} · Supplier: {detail.supplier?.name ?? "-"} · Total: {formatRp(detail.totalAmount)}
            </p>
            {detail.items.map((item) => (
              <p key={`${detail.id}-${item.productId}`}>
                {item.productId.slice(0, 8)}… × {item.quantity} @ {formatRp(item.unitCost)} = {formatRp(item.lineTotal)}
              </p>
            ))}
            <Button variant="outline" onClick={() => setDetail(null)}>
              Tutup
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
