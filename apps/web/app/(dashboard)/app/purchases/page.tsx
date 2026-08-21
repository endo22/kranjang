"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { AppReveal, AppStagger, AppStaggerItem } from "@/components/app/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";
import { formatRp } from "@/lib/format";

type Supplier = { id: string; name: string };
type Product = { id: string; name: string };
type PurchaseItem = {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
  receivedQty: number;
  returnedQty: number;
  remainingReceive: number;
  remainingReturn: number;
  unitCost: number;
  lineTotal: number;
};
type Purchase = {
  id: string;
  invoiceNo: string;
  documentStatus: string;
  totalAmount: number;
  purchasedAt: string;
  supplier?: { id: string; name: string } | null;
  items: PurchaseItem[];
};

const selectClass =
  "h-11 w-full rounded-2xl border border-[#e2e6e4] bg-white px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#003c33]/40 focus:ring-2 focus:ring-[#003c33]/20";
const inputFocusClass =
  "transition-[box-shadow,border-color] duration-200 focus-visible:border-[#003c33]/40 focus-visible:ring-[#003c33]/25";
const btnPressClass = "transition-transform duration-150 active:scale-[0.98]";
const cardSurfaceClass =
  "border-[#e2e6e4] bg-white transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(23,23,28,0.05)]";

const easeOut = [0.16, 1, 0.3, 1] as const;

function statusBadgeClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "border-[#d9d9dd] bg-[#f4f6f5] text-[#616161]";
    case "PARTIAL":
      return "border-[#ff7759]/35 bg-[#ff7759]/10 text-[#b33a22]";
    case "RECEIVED":
      return "border-[#003c33]/25 bg-[#edfce9] text-[#003c33]";
    case "CANCELLED":
      return "border-[#b30000]/25 bg-[#b30000]/[0.06] text-[#b30000]";
    default:
      return "border-[#003c33]/20 bg-[#003c33]/[0.05] text-[#003c33]";
  }
}

export default function PurchasesPage() {
  const reduce = useReducedMotion();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Purchase[]>([]);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("0");
  const [invoiceNo, setInvoiceNo] = useState("");

  async function load() {
    const [nextSuppliers, nextProducts, nextRows] = await Promise.all([
      api<Supplier[]>("/suppliers"),
      api<{ items: Product[] }>("/products?limit=100"),
      api<{ items: Purchase[] }>("/purchases?limit=50"),
    ]);
    setSuppliers(nextSuppliers);
    setProducts(nextProducts.items);
    setRows(nextRows.items);
    setSupplierId((value) => value || nextSuppliers[0]?.id || "");
    setProductId((value) => value || nextProducts.items[0]?.id || "");
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  async function openDetail(id: string) {
    const row = await api<Purchase>(`/purchases/${id}`);
    setDetail(row);
    setReceiveQty(
      Object.fromEntries(row.items.map((item) => [item.id, item.remainingReceive > 0 ? String(item.remainingReceive) : ""])),
    );
    setReturnQty(Object.fromEntries(row.items.map((item) => [item.id, ""])));
  }

  async function refreshDetail(id: string) {
    await load();
    await openDetail(id);
  }

  const canReceive = detail && (detail.documentStatus === "DRAFT" || detail.documentStatus === "PARTIAL");
  const canReturn = detail && (detail.documentStatus === "PARTIAL" || detail.documentStatus === "RECEIVED");

  const stats = useMemo(() => {
    const draft = rows.filter((row) => row.documentStatus === "DRAFT").length;
    const partial = rows.filter((row) => row.documentStatus === "PARTIAL").length;
    const received = rows.filter((row) => row.documentStatus === "RECEIVED").length;
    return { draft, partial, received, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-5">
      <AppReveal className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#003c33]/70">Purchase order</p>
          <h1 className="font-display text-2xl tracking-[-0.03em] text-[#17171c] sm:text-3xl">Pembelian</h1>
          <p className="max-w-xl text-sm leading-6 text-[#616161]">
            Buat draft PO, terima parsial, dan catat retur tanpa meninggalkan alur stok.
          </p>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-[#003c33]/25 via-[#e2e6e4] to-transparent" />
      </AppReveal>

      <AppStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AppStaggerItem>
          <div className="rounded-2xl border border-[#e2e6e4] bg-white px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(23,23,28,0.04)]">
            <p className="text-xs font-medium text-[#616161]">Total PO</p>
            <p className="mt-1 font-display text-2xl tabular-nums tracking-[-0.03em] text-[#17171c]">{stats.total}</p>
          </div>
        </AppStaggerItem>
        <AppStaggerItem>
          <div className="rounded-2xl border border-[#e2e6e4] bg-white px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(23,23,28,0.04)]">
            <p className="text-xs font-medium text-[#616161]">Draft</p>
            <p className="mt-1 font-display text-2xl tabular-nums tracking-[-0.03em] text-[#616161]">{stats.draft}</p>
          </div>
        </AppStaggerItem>
        <AppStaggerItem>
          <div
            className={
              stats.partial
                ? "rounded-2xl border border-[#ff7759]/30 bg-[#fff7f5] px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(255,119,89,0.12)]"
                : "rounded-2xl border border-[#e2e6e4] bg-white px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(23,23,28,0.04)]"
            }
          >
            <p className="text-xs font-medium text-[#616161]">Parsial</p>
            <p
              className={
                stats.partial
                  ? "mt-1 font-display text-2xl tabular-nums tracking-[-0.03em] text-[#b33a22]"
                  : "mt-1 font-display text-2xl tabular-nums tracking-[-0.03em] text-[#17171c]"
              }
            >
              {stats.partial}
            </p>
          </div>
        </AppStaggerItem>
        <AppStaggerItem>
          <div className="rounded-2xl border border-[#003c33]/15 bg-[#edfce9]/60 px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(0,60,51,0.06)]">
            <p className="text-xs font-medium text-[#616161]">Diterima</p>
            <p className="mt-1 font-display text-2xl tabular-nums tracking-[-0.03em] text-[#003c33]">{stats.received}</p>
          </div>
        </AppStaggerItem>
      </AppStagger>

      <AppReveal delay={0.04}>
        <Card className={cardSurfaceClass}>
          <CardHeader>
            <CardTitle className="font-display text-xl tracking-[-0.02em]">Buat draft PO</CardTitle>
            <CardDescription>Invoice, supplier, satu baris produk — lanjut terima dari daftar atau detail.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 rounded-2xl border border-[#e2e6e4] bg-[#f4f6f5] p-4 lg:grid-cols-5"
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
              <Input
                placeholder="No invoice"
                value={invoiceNo}
                onChange={(event) => setInvoiceNo(event.target.value)}
                required
                className={inputFocusClass}
              />
              <select className={selectClass} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                {suppliers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={productId} onChange={(event) => setProductId(event.target.value)}>
                {products.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                placeholder="Qty"
                className={inputFocusClass}
              />
              <Input
                type="number"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                placeholder="Harga"
                className={inputFocusClass}
              />
              <Button type="submit" className={`lg:col-span-5 ${btnPressClass}`}>
                Buat draft
              </Button>
            </form>
          </CardContent>
        </Card>
      </AppReveal>

      <AppReveal delay={0.08}>
        <Card className={cardSurfaceClass}>
          <CardHeader>
            <CardTitle className="font-display text-xl tracking-[-0.02em]">Daftar pembelian</CardTitle>
            <CardDescription>{rows.length} dokumen terbaru. Klik invoice untuk buka detail.</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#e2e6e4] bg-[#f4f6f5] px-4 py-8 text-center text-sm text-[#616161]">
                Belum ada purchase order. Buat draft di atas untuk mulai.
              </p>
            ) : (
              <AppStagger className="space-y-2">
                {rows.map((row) => (
                  <AppStaggerItem key={row.id}>
                    <div
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors duration-200 ${
                        detail?.id === row.id
                          ? "border-[#003c33]/35 bg-[#edfce9]/50"
                          : "border-[#e2e6e4] bg-white hover:border-[#003c33]/25 hover:bg-[#f4f6f5]"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#003c33]/25"
                        onClick={() =>
                          void openDetail(row.id).catch((error) =>
                            toast.error(error instanceof Error ? error.message : "Gagal"),
                          )
                        }
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[#17171c]">{row.invoiceNo}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(row.documentStatus)}`}>
                            {row.documentStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-[#616161]">
                          {row.supplier?.name ?? "Tanpa supplier"} ·{" "}
                          <span className="tabular-nums font-medium text-[#003c33]">{formatRp(row.totalAmount)}</span>
                        </p>
                      </button>
                      {row.documentStatus === "DRAFT" || row.documentStatus === "PARTIAL" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className={btnPressClass}
                            onClick={() => {
                              void api(`/purchases/${row.id}/receive`, { method: "POST", ...jsonInit({}) })
                                .then(() => load())
                                .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                            }}
                          >
                            Terima sisa
                          </Button>
                          {row.documentStatus === "DRAFT" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className={btnPressClass}
                              onClick={() => {
                                void api(`/purchases/${row.id}/cancel`, { method: "POST" })
                                  .then(() => load())
                                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                              }}
                            >
                              Batalkan
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </AppStaggerItem>
                ))}
              </AppStagger>
            )}
          </CardContent>
        </Card>
      </AppReveal>

      <AnimatePresence mode="wait">
        {detail ? (
          <motion.div
            key={detail.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: easeOut }}
          >
            <Card className={cardSurfaceClass}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="font-display text-xl tracking-[-0.02em]">Detail {detail.invoiceNo}</CardTitle>
                  <CardDescription>
                    Supplier {detail.supplier?.name ?? "-"} · Total{" "}
                    <span className="tabular-nums font-medium text-[#003c33]">{formatRp(detail.totalAmount)}</span>
                  </CardDescription>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(detail.documentStatus)}`}>
                  {detail.documentStatus}
                </span>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <AppStagger className="space-y-2">
                  {detail.items.map((item) => (
                    <AppStaggerItem key={item.id}>
                      <div className="rounded-2xl border border-[#e2e6e4] bg-[#f4f6f5] px-4 py-3 transition-colors hover:border-[#003c33]/25">
                        <p className="font-medium text-[#17171c]">{item.productName ?? item.productId.slice(0, 8)}</p>
                        <p className="mt-1 text-[#616161]">
                          Pesan <span className="tabular-nums text-[#17171c]">{item.quantity}</span>
                          {" · "}diterima <span className="tabular-nums text-[#003c33]">{item.receivedQty}</span>
                          {" · "}retur <span className="tabular-nums">{item.returnedQty}</span>
                          {" @ "}
                          {formatRp(item.unitCost)}
                        </p>
                        {canReceive && item.remainingReceive > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#003c33]/70">Terima</span>
                            <Input
                              className={`h-9 w-24 ${inputFocusClass}`}
                              type="number"
                              min={0}
                              max={item.remainingReceive}
                              value={receiveQty[item.id] ?? ""}
                              onChange={(event) =>
                                setReceiveQty((current) => ({ ...current, [item.id]: event.target.value }))
                              }
                            />
                            <span className="text-[#616161]">/ {item.remainingReceive}</span>
                          </div>
                        ) : null}
                        {canReturn && item.remainingReturn > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#b33a22]/80">Retur</span>
                            <Input
                              className={`h-9 w-24 ${inputFocusClass}`}
                              type="number"
                              min={0}
                              max={item.remainingReturn}
                              value={returnQty[item.id] ?? ""}
                              onChange={(event) =>
                                setReturnQty((current) => ({ ...current, [item.id]: event.target.value }))
                              }
                            />
                            <span className="text-[#616161]">/ {item.remainingReturn}</span>
                          </div>
                        ) : null}
                      </div>
                    </AppStaggerItem>
                  ))}
                </AppStagger>

                <div className="flex flex-wrap gap-2 border-t border-[#e2e6e4] pt-4">
                  {canReceive ? (
                    <Button
                      className={btnPressClass}
                      onClick={() => {
                        const items = detail.items
                          .map((item) => ({ purchaseItemId: item.id, quantity: Number(receiveQty[item.id] || 0) }))
                          .filter((item) => item.quantity > 0);
                        if (items.length === 0) {
                          toast.error("Isi qty terima minimal satu baris.");
                          return;
                        }
                        void api(`/purchases/${detail.id}/receive`, { method: "POST", ...jsonInit({ items }) })
                          .then(() => {
                            toast.success("Penerimaan tersimpan.");
                            return refreshDetail(detail.id);
                          })
                          .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                      }}
                    >
                      Terima parsial
                    </Button>
                  ) : null}
                  {canReturn ? (
                    <Button
                      variant="outline"
                      className={btnPressClass}
                      onClick={() => {
                        const items = detail.items
                          .map((item) => ({ purchaseItemId: item.id, quantity: Number(returnQty[item.id] || 0) }))
                          .filter((item) => item.quantity > 0);
                        if (items.length === 0) {
                          toast.error("Isi qty retur minimal satu baris.");
                          return;
                        }
                        void api(`/purchases/${detail.id}/returns`, { method: "POST", ...jsonInit({ items }) })
                          .then(() => {
                            toast.success("Retur tersimpan.");
                            return refreshDetail(detail.id);
                          })
                          .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                      }}
                    >
                      Kirim retur
                    </Button>
                  ) : null}
                  <Button variant="outline" className={btnPressClass} onClick={() => setDetail(null)}>
                    Tutup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
