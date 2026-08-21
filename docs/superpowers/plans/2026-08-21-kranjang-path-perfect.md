# Kranjang — Path to Perfect (Jalur B)

**Goal:** Roadmap sampai Later §5.3. Wave 4 menutup sisa Next ringan; Wave 5 partial PO/retur.

**Spec:** `docs/prd/kranjang-prd-phase-9-power.md` §7 + PRD v1.1 §5.3

## Wave 4 (eksekusi) — selesai

1. `pnpm --filter @kranjang/db seed:demo`
2. Cron harian low-stock (`Asia/Jakarta`)
3. Pointer roadmap Wave 5–10 di PRD §7

## Wave 5 (eksekusi) — partial receive + retur PO

- `PurchaseItem.receivedQty` / `returnedQty`, status `PARTIAL`
- `POST /purchases/:id/receive` body qty opsional; `POST /purchases/:id/returns`
- UI detail pembelian: terima parsial + retur

## Wave 6 (eksekusi) — multi-outlet + transfer

- `OutletStock` per outlet; movement `STOCK_TRANSFER`
- Header `X-Outlet-Id` untuk konteks outlet aktif
- `CRUD /outlets` + enforce `maxOutlets` / `featureMultiOutlet` (Business 3, Pro 5)
- UI: switcher topbar, halaman Outlet, transfer di Inventory

## Wave 7 (eksekusi) — meja / hold bill / split payment

- `DiningTable`, `SaleHold` (+ items); sale opsional `diningTableId` / `saleHoldId`
- `CRUD /dining-tables`, lifecycle `/sale-holds` (OPEN → cancel/checkout)
- `POST /sales` menerima `payments[]` (jumlah = total) atau `paymentMethod` legacy
- UI: halaman Meja, kasir hold bill + split payment; cash close hanya jumlah CASH

## Waves berikutnya (belum dieksekusi)

- Wave 8: varian / konversi satuan / waste %
- Wave 9: printer + polish prod
- Wave 10: mobile / loyalty / marketplace
