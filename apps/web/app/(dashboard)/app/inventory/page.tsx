"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";
import { buildInventoryMovementsPath, getLowStockProducts, validateInventoryAdjustment } from "./page-helpers";

type Movement = {
  id: string;
  productId: string;
  productName: string;
  movementType: string;
  quantity: number;
  stockAfter: number;
  createdAt: string;
  notes?: string | null;
};

type Product = {
  id: string;
  name: string;
  productType: string;
  stock: number;
  minStock: number;
};

export default function InventoryPage() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [movementType, setMovementType] = useState("ADJUSTMENT");
  const [notes, setNotes] = useState("");

  async function load(filters = { from: filterFrom, to: filterTo, productId: filterProductId }) {
    const [movements, nextProducts] = await Promise.all([
      api<{ items: Movement[] }>(buildInventoryMovementsPath(filters)),
      api<{ items: Product[] }>("/products?limit=100"),
    ]);
    setRows(movements.items);
    setProducts(nextProducts.items);
    setProductId((current) => current || nextProducts.items[0]?.id || "");
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  const lowStockRows = getLowStockProducts(products);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Filter histori stok, catat waste, dan pantau produk yang sudah menyentuh minimum stok.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 lg:grid-cols-[180px_180px_1fr_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuat movement."));
            }}
          >
            <Input type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} />
            <Input type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} />
            <select
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3"
              value={filterProductId}
              onChange={(event) => setFilterProductId(event.target.value)}
            >
              <option value="">Semua produk</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Terapkan filter
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFilterFrom("");
                setFilterTo("");
                setFilterProductId("");
                void load({ from: "", to: "", productId: "" }).catch((error) =>
                  toast.error(error instanceof Error ? error.message : "Gagal memuat movement."),
                );
              }}
            >
              Reset
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adjustment stok</CardTitle>
          <CardDescription>Catatan wajib diisi saat memilih tipe movement `WASTE`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 lg:grid-cols-[1.2fr_180px_160px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const validationError = validateInventoryAdjustment({ movementType, notes });
              if (validationError) {
                toast.error(validationError);
                return;
              }

              void api("/inventory/adjust", {
                method: "POST",
                ...jsonInit({
                  productId,
                  quantity: Number(quantity),
                  movementType,
                  notes: notes.trim() || undefined,
                }),
              })
                .then(async () => {
                  setNotes("");
                  await load();
                })
                .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
            }}
          >
            <select
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3"
              value={movementType}
              onChange={(event) => setMovementType(event.target.value)}
            >
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="WASTE">WASTE</option>
              <option value="INITIAL_STOCK">INITIAL_STOCK</option>
            </select>
            <Input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={movementType === "WASTE" ? "Catatan waste wajib diisi" : "Catatan opsional"}
            />
            <Button type="submit" disabled={!productId}>
              Simpan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stok menipis</CardTitle>
          <CardDescription>Produk non-resep dengan stok saat ini sudah di bawah atau sama dengan minimum stok.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={lowStockRows.length === 0}
            onClick={() => {
              void api<{ count: number; to: string[] }>("/alerts/low-stock", { method: "POST" })
                .then((result) => {
                  toast.success(`Alert ${result.count} produk dikirim ke ${result.to.join(", ") || "log/dev"}.`);
                })
                .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal mengirim alert"));
            }}
          >
            Kirim alert stok
          </Button>
          {lowStockRows.length ? (
            lowStockRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-[#e5e7eb] px-4 py-3 text-sm">
                <span className="font-medium">{row.name}</span> · stok {row.stock} / min {row.minStock}
              </div>
            ))
          ) : (
            <p className="text-sm text-[#616161]">Tidak ada peringatan minimum stok.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement stok</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#616161]">
                <th className="py-2">Waktu</th>
                <th>Produk</th>
                <th>Tipe</th>
                <th>Qty</th>
                <th>Stok akhir</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t">
                  <td className="py-3 text-[#616161]" colSpan={6}>
                    Belum ada movement untuk filter ini.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2">{new Date(row.createdAt).toLocaleString("id-ID")}</td>
                    <td>{row.productName}</td>
                    <td>{row.movementType}</td>
                    <td>{row.quantity}</td>
                    <td>{row.stockAfter}</td>
                    <td>{row.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
