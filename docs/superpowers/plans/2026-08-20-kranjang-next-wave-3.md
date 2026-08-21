# Kranjang Phase 8 — Wave 3 (Production Gate)

**Goal:** Harden production billing (no mock-pay), Midtrans Snap checkout, Sentry APM, Super Admin password gate, runbook/env.

**Spec:** `docs/ops/security-checklist.md`, `docs/ops/runbook.md`

## Scope

1. Docs: plan pointer, runbook, `.env.example`, checklist code items
2. `mockPay` always 403 in production; Snap create transaction when Midtrans keys set
3. Subscription UI: Snap.js or (dev-only) mock-pay
4. `@sentry/node` when `SENTRY_DSN`; SA seed rejects default password in production

## Out of scope

RLS SQL, PITR dashboard toggle, partial PO, seed-demo, cron low-stock, live deploy.
