"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";

type Supplier = { id: string; name: string };
type Product = { id: string; name: string };
type Purchase = { id: string; invoiceNo: string; documentStatus: string; totalAmount: number };

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Purchase[]>([]);
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

  return (
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
              .then(() => load())
              .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <Input placeholder="No invoice" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} required />
          <select className="h-11 rounded-2xl border px-3" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            {suppliers.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <select className="h-11 rounded-2xl border px-3" value={productId} onChange={(event) => setProductId(event.target.value)}>
            {products.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <Input type="number" value={qty} onChange={(event) => setQty(event.target.value)} />
          <Input type="number" value={cost} onChange={(event) => setCost(event.target.value)} />
          <Button type="submit" className="lg:col-span-5">Buat draft</Button>
        </form>
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between rounded-2xl border px-4 py-3">
              <span>{row.invoiceNo} · {row.documentStatus} · {row.totalAmount}</span>
              {row.documentStatus !== "RECEIVED" ? (
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
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
