# Seed demo Toko Demo Kranjang

## Goal
Script idempotent `packages/db/prisma/seed-demo.ts` mengisi data operasional untuk `owner@kranjang.local` agar semua menu dashboard punya contoh data.

## Scope
- Target: tenant milik `owner@kranjang.local` saja
- Hapus lalu isi ulang: categories, products (+ recipe), suppliers, customers, purchases, sales, cashier sessions, expenses (non-system), stock movements
- Pertahankan: user Owner, roles, outlet, tenant settings, expense categories sistem, subscription
- Opsional: user `cashier@kranjang.local` (role Cashier)

## Non-goals
- Tidak mengubah `seed.ts` permission/plan
- Tidak menyentuh tenant lain
- Tidak membuat payment/billing mock

## Run
`pnpm --filter @kranjang/db seed:demo`

Pastikan `owner@kranjang.local` sudah ada (register/login). Script menghapus lalu mengisi ulang data operasional tenant tersebut saja.
