# Kranjang PRD §7 Next — Wave 2

**Goal:** Low-stock email alert (Resend) + richer receipt footer (logo URL + QR).

**Spec:** `docs/prd/kranjang-prd-phase-9-power.md` §7

## Scope

1. `sendMail` + `POST /alerts/low-stock` (debounce 6h) + inventory UI button
2. `receiptLogoUrl` / `receiptQrPayload` in settings + cashier print

## Out of scope

Partial PO receive/return, cron, storage upload, Phase 8 ops, seed-demo.
