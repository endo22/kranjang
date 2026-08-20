# Runbook produksi Kranjang

## Layanan
- Web: Vercel (`apps/web`), env `NEXT_PUBLIC_API_URL`
- API: Railway/Render (`apps/api`), env `PORT`, `DATABASE_URL` (pooler Supabase), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`, `WEB_URL`
- Database + Storage: Supabase PostgreSQL (PITR/backup di dashboard)
- Redis: Upstash `REDIS_URL` (opsional Phase 2–5; job billing Phase 6 memakai memori jika kosong)
- Email: `RESEND_API_KEY` + `MAIL_FROM` (tanpa ini, tautan verifikasi hanya di log)
- Midtrans: `MIDTRANS_SERVER_KEY` untuk tanda tangan webhook `POST /api/v1/billing/webhook`

## Super Admin
Seed otomatis saat API start: `SUPER_ADMIN_EMAIL` (default `admin@kranjang.local`) dan `SUPER_ADMIN_PASSWORD` (default `ChangeMeAdmin12`). UI: `/admin/login`.

## Checklist deploy
1. `pnpm db:generate && pnpm db:migrate && pnpm db:seed`
2. Set CORS `WEB_ORIGIN` ke origin Vercel
3. Webhook Midtrans ke URL publik Nest, bukan Vercel
4. Helmet + cookie refresh `SameSite=Lax`; `secure` hanya production
5. Jangan log password/token
6. `pnpm db:cleanup-test` hanya di database non-produksi

## Tes
- API: `pnpm --filter @kranjang/api test`
- Loop operasional: beli bahan → terima → kasir jual RECIPE → dashboard = P&L
- Playwright smoke (opsional): `pnpm --filter @kranjang/web test` mencakup fetch halaman login jika server hidup
