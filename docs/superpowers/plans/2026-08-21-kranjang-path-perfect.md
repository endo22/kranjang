# Kranjang — Path to Perfect (Jalur B)

**Goal:** Roadmap sampai Later §5.3. Wave 4 menutup sisa Next ringan.

**Spec:** `docs/prd/kranjang-prd-phase-9-power.md` §7 + PRD v1.1 §5.3

## Wave 4 (eksekusi)

1. `pnpm --filter @kranjang/db seed:demo` — data ops untuk `owner@kranjang.local`
2. Cron harian low-stock (`Asia/Jakarta`) memakai logika alert yang sama + debounce 6 jam
3. Pointer roadmap Wave 5–10 di PRD §7

## Waves berikutnya (belum dieksekusi di commit ini)

- Wave 5: partial receive + retur PO
- Wave 6: multi-outlet + transfer
- Wave 7: meja / hold bill / split payment
- Wave 8: varian / konversi satuan / waste %
- Wave 9: printer + polish prod
- Wave 10: mobile / loyalty / marketplace

## Out of scope Wave 4

Partial PO, multi-outlet, meja, mobile.
