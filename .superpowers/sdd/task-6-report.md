# Task 6 Report: API inventory

## Status
Selesai dengan TDD untuk dua requirement: filter `GET /inventory/movements` dan validasi `WASTE` wajib punya `notes`.

## TDD
- RED: `pnpm --filter @kranjang/api test -- phase9.block-a` gagal karena `POST /inventory/adjust` masih menerima `WASTE` tanpa catatan.
- GREEN: command yang sama lulus `1` suite, `4` test.

## Perubahan
- `packages/shared/src/ops-schemas.ts`: `inventoryAdjustSchema` memakai `.superRefine()` agar `movementType === "WASTE"` tanpa `notes` memicu `400 VALIDATION_ERROR` dengan pesan `Catatan wajib untuk waste.`
- `apps/api/src/inventory/inventory.controller.ts`: endpoint `GET /inventory/movements` menerima query `from`, `to`, `productId`.
- `apps/api/src/inventory/inventory.service.ts`: query movement kini memfilter berdasarkan tenant, `productId`, dan rentang `createdAt`.
- `apps/api/test/phase9.block-a.spec.ts`: menambah coverage untuk reject `WASTE` tanpa catatan dan filter movements.

## Catatan
- Commit task ini perlu ikut men-stage modul inventory yang masih untracked di tree kerja saat ini.

## Addendum 2026-08-20
- `GET /inventory/movements` sekarang memvalidasi `from`, `to`, dan `productId` di controller sebelum masuk ke Prisma.
- Query yang invalid mengembalikan `400 VALIDATION_ERROR`, dan ada regresi test untuk `productId` UUID buruk serta `from` yang bukan tanggal.
