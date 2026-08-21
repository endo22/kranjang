# Kranjang Phase 9 Block B Implementation Plan

**Goal:** Perdalam pembelian, penjualan, mitra, dan biaya (PRD §6.4–6.7).

**Spec:** `docs/prd/kranjang-prd-phase-9-power.md`

## Scope

1. Purchase cancel draft + UI list/detail/receive/cancel
2. Sale cancel `{ reason }` + list filter tanggal + detail UI
3. Partners edit/search/deactivate; expenses edit/filter
4. Optional: cashier customer select

## Tests

- `pnpm --filter @kranjang/api test -- phase9.block-b` (new)
- `pnpm --filter @kranjang/api test -- ops.loop`
- `pnpm --filter @kranjang/web test`

## Out of scope

Block C, §5.3 features.
