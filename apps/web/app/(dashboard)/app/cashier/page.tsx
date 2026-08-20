"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit, type SettingsRecord } from "@/lib/api";
import { formatRp } from "@/lib/format";
import {
  addCartItem,
  estimateSaleTotals,
  filterProducts,
  pickProductForEnter,
  type CashierCartItem,
  type CashierProduct,
} from "./cashier-utils";

type Product = CashierProduct;
type CartItem = CashierCartItem;
type Category = { id: string; name: string };
type Customer = { id: string; name: string };
type CashierCloseSummary = {
  salesCount: number;
  salesTotal: number;
  cashSalesTotal: number;
  expectedCash: number;
  cashDifference: number;
};
type SaleResponse = {
  id: string;
  receiptNo: string;
  soldAt: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalNet: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{ method: string; amount: number }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function CashierPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [method, setMethod] = useState("CASH");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [lastSummary, setLastSummary] = useState<CashierCloseSummary | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const [nextProducts, nextCategories, nextSettings, current, nextCustomers] = await Promise.all([
      api<{ items: Product[] }>("/products?limit=100"),
      api<Category[]>("/categories"),
      api<SettingsRecord>("/settings"),
      api<{ id: string } | null>("/cashier-sessions/current"),
      api<Customer[]>("/customers"),
    ]);
    setProducts(nextProducts.items);
    setCategories(nextCategories);
    setSettings(nextSettings);
    setSession(current);
    setCustomers(nextCustomers);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuat kasir."));
  }, []);

  const filtered = useMemo(() => filterProducts(products, query, categoryFilter), [products, query, categoryFilter]);
  const totals = useMemo(
    () =>
      estimateSaleTotals(cart, Number(discount) || 0, {
        taxPercent: settings?.taxPercent ?? "0",
        taxInclusive: settings?.taxInclusive ?? true,
      }),
    [cart, discount, settings],
  );

  function handleAddProduct(product: Product) {
    setCart((current) => addCartItem(current, product));
    setQuery("");
    searchInputRef.current?.focus();
  }

  function openReceiptPreview(sale: SaleResponse) {
    if (typeof window === "undefined") {
      return;
    }

    const receiptWindow = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
    if (!receiptWindow) {
      return;
    }

    const rows = sale.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">${formatRp(item.lineTotal)}</td>
          </tr>`,
      )
      .join("");

    receiptWindow.document.write(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Struk ${escapeHtml(sale.receiptNo)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
      h1, p { margin: 0; }
      .muted { color: #6b7280; font-size: 12px; }
      .section { margin-top: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      td { padding: 6px 0; border-bottom: 1px dashed #d1d5db; vertical-align: top; }
      .summary-row { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; font-size: 14px; }
      .summary-row.total { font-weight: 700; font-size: 16px; }
      @media print { body { margin: 0; padding: 12px; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(settings?.name ?? "Kranjang")}</h1>
    <p class="muted">${escapeHtml(sale.receiptNo)} • ${escapeHtml(new Date(sale.soldAt).toLocaleString("id-ID"))}</p>
    <div class="section">
      <table>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="section">
      <div class="summary-row"><span>Subtotal</span><span>${formatRp(sale.subtotal)}</span></div>
      <div class="summary-row"><span>Diskon</span><span>${formatRp(sale.discountAmount)}</span></div>
      <div class="summary-row"><span>Pajak</span><span>${formatRp(sale.taxAmount)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${formatRp(sale.totalNet)}</span></div>
      <div class="summary-row"><span>Pembayaran</span><span>${escapeHtml(sale.payments[0]?.method ?? method)}</span></div>
    </div>
    ${
      settings?.receiptFooter
        ? `<div class="section"><p class="muted">${escapeHtml(settings.receiptFooter)}</p></div>`
        : ""
    }
    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`);
    receiptWindow.document.close();
  }

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
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              ref={searchInputRef}
              autoFocus
              placeholder="Cari nama atau barcode"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                const selected = pickProductForEnter(products, filtered, query);
                if (selected) {
                  handleAddProduct(selected);
                }
              }}
            />
            <select
              className="h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className="rounded-2xl border border-[#e5e7eb] p-4 text-left hover:bg-[#eeece7]"
                onClick={() => handleAddProduct(product)}
              >
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-[#616161]">{product.barcode ? `Barcode ${product.barcode}` : "Tanpa barcode"}</p>
                <p className="text-sm text-[#616161]">{formatRp(product.sellPrice)}</p>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? <p className="text-sm text-[#616161]">Produk tidak ditemukan.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Keranjang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cart.length === 0 ? <p className="text-sm text-[#616161]">Belum ada item di keranjang.</p> : null}
          {cart.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between text-sm">
              <span>
                {item.product.name} × {item.quantity}
              </span>
              <span>{formatRp(item.product.sellPrice * item.quantity)}</span>
            </div>
          ))}
          <div className="space-y-2">
            <p className="text-sm font-medium">Diskon transaksi</p>
            <Input type="number" min={0} value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-[#faf7f2] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>Subtotal</span>
              <span>{formatRp(totals.subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>Diskon</span>
              <span>{formatRp(totals.discountAmount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>Pajak {(settings?.taxInclusive ?? true) ? "(inkl.)" : "(eks.)"}</span>
              <span>{formatRp(totals.taxAmount)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-base font-medium">
              <span>Total</span>
              <span>{formatRp(totals.totalNet)}</span>
            </div>
            <p className="mt-2 text-xs text-[#616161]">
              {settings ? `Pajak tenant ${settings.taxPercent}%` : "Pengaturan pajak dimuat dari tenant."}
            </p>
          </div>
          <select className="h-11 w-full rounded-2xl border px-3" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Pelanggan umum</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
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
              const discountAmount = Math.max(0, Number(discount) || 0);
              void api<SaleResponse>("/sales", {
                method: "POST",
                ...jsonInit({
                  paymentMethod: method,
                  discountAmount,
                  customerId: customerId || undefined,
                  items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
                }),
              })
                .then((sale) => {
                  openReceiptPreview(sale);
                  toast.success("Transaksi tersimpan.");
                  setCart([]);
                  setDiscount("0");
                  setCustomerId("");
                  setQuery("");
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
