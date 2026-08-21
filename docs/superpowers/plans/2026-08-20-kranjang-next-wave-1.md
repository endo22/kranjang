# Kranjang PRD §7 Next — Wave 1

**Goal:** Shortcut keyboard kasir, hold cart in-session, target margin di laporan.

**Spec:** `docs/prd/kranjang-prd-phase-9-power.md` §7

## Scope

1. Cashier F2/F4/F8/F9/+/- shortcuts + hint
2. Hold/restore cart via sessionStorage (max 3, keyed by session id)
3. `Product.targetMargin` + profitability vs target in reports/UI

## Tests

- `pnpm --filter @kranjang/web test` (cashier shortcut/hold helpers)
- `pnpm --filter @kranjang/api test` (targetMargin / profitability)

## Out of scope

Email low-stock, footer logo/QR, partial PO, §5.3, Phase 8 ops.
