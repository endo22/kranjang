# Kranjang Phase 9 Block C Implementation Plan

**Goal:** Dashboard actionable + export, soft-disable user, settings untuk kasir, pagination, polish billing/admin (PRD §6.8–6.11).

**Spec:** `docs/prd/kranjang-prd-phase-9-power.md`

## Scope

1. Dashboard period comparison + lowStock link; reports export CSV/PDF via auth download
2. User soft-disable/reactivate via `deletedAt`; GET `/settings` for `sales.create`
3. Pagination `limit`/`offset` → `{ items, total }` on products, sales, purchases, expenses, movements
4. Subscription UI copy; admin tenant `q` + audit panel

## Tests

- `pnpm --filter @kranjang/api test` (incl. `phase9.block-c`)
- `pnpm --filter @kranjang/web test`

## Out of scope

§5.3, Midtrans live / matikan mock-pay production.
