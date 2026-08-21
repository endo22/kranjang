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

## Waves berikutnya (belum dieksekusi)

- Wave 6: multi-outlet + transfer
- Wave 7: meja / hold bill / split payment
- Wave 8: varian / konversi satuan / waste %
- Wave 9: printer + polish prod
- Wave 10: mobile / loyalty / marketplace
