"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";
import { formatRp } from "@/lib/format";

type Product = { id: string; name: string; sellPrice: number; productType: string; barcode: string | null; isActive: boolean };
type CartItem = { product: Product; quantity: number };
type CashierCloseSummary = {
  salesCount: number;
  salesTotal: number;
  cashSalesTotal: number;
  expectedCash: number;
  cashDifference: number;
};

export default function CashierPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [method, setMethod] = useState("CASH");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [lastSummary, setLastSummary] = useState<CashierCloseSummary | null>(null);

  async function load() {
    const [nextProducts, current] = await Promise.all([
      api<Product[]>("/products"),
      api<{ id: string } | null>("/cashier-sessions/current"),
    ]);
    setProducts(nextProducts.filter((product) => product.isActive !== false));
    setSession(current);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuat kasir."));
  }, []);

  const filtered = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) || product.barcode?.includes(query)),
    [products, query],
  );
  const total = cart.reduce((sum, item) => sum + item.product.sellPrice * item.quantity, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Kasir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!session ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Kas buka</p>
                <Input
                  type="number"
                  min={0}
                  value={openingCash}
                  onChange={(event) => setOpeningCash(event.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  void api("/cashier-sessions/open", {
                    method: "POST",
                    ...jsonInit({ openingCash: Number(openingCash) || 0 }),
                  })
                    .then(() => {
                      setLastSummary(null);
                      return load();
                    })
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                }}
              >
                Buka sesi
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Kas tutup</p>
                <Input
                  type="number"
                  min={0}
                  value={closingCash}
                  onChange={(event) => setClosingCash(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void api<{ summary: CashierCloseSummary }>(`/cashier-sessions/${session.id}/close`, {
                    method: "POST",
                    ...jsonInit({ closingCash: Number(closingCash) || 0 }),
                  })
                    .then((result) => {
                      setLastSummary(result.summary);
                      return load();
                    })
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                }}
              >
                Tutup sesi
              </Button>
            </div>
          )}
          {lastSummary ? (
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
              <p className="font-medium">Ringkasan tutup terakhir</p>
              <div className="mt-3 space-y-2 text-sm text-[#616161]">
                <div className="flex items-center justify-between gap-3">
                  <span>Jumlah transaksi</span>
                  <span className="font-medium text-[#1a1a1a]">{lastSummary.salesCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Total penjualan</span>
                  <span className="font-medium text-[#1a1a1a]">{formatRp(lastSummary.salesTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Penjualan tunai</span>
                  <span className="font-medium text-[#1a1a1a]">{formatRp(lastSummary.cashSalesTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Kas seharusnya</span>
                  <span className="font-medium text-[#1a1a1a]">{formatRp(lastSummary.expectedCash)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Selisih kas</span>
                  <span className="font-medium text-[#1a1a1a]">{formatRp(lastSummary.cashDifference)}</span>
                </div>
              </div>
            </div>
          ) : null}
          <Input placeholder="Cari nama atau barcode" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className="rounded-2xl border border-[#e5e7eb] p-4 text-left hover:bg-[#eeece7]"
                onClick={() => {
                  setCart((current) => {
                    const existing = current.find((item) => item.product.id === product.id);
                    if (existing) {
                      return current.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
                    }
                    return [...current, { product, quantity: 1 }];
                  });
                }}
              >
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-[#616161]">{formatRp(product.sellPrice)}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Keranjang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cart.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between text-sm">
              <span>
                {item.product.name} × {item.quantity}
              </span>
              <span>{formatRp(item.product.sellPrice * item.quantity)}</span>
            </div>
          ))}
          <p className="text-xl font-medium">{formatRp(total)}</p>
          <select className="h-11 w-full rounded-2xl border px-3" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option>CASH</option>
            <option>QRIS</option>
            <option>TRANSFER</option>
            <option>EWALLET</option>
            <option>CARD</option>
          </select>
          <Button
            className="w-full"
            disabled={!session || cart.length === 0}
            onClick={() => {
              void api("/sales", {
                method: "POST",
                ...jsonInit({
                  paymentMethod: method,
                  items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
                }),
              })
                .then(() => {
                  toast.success("Transaksi tersimpan.");
                  setCart([]);
                  void load();
                })
                .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
            }}
          >
            Bayar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
