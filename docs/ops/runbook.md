# Runbook produksi Kranjang

## Layanan
- Web: Vercel (`apps/web`), env `NEXT_PUBLIC_API_URL`
- API: Railway/Render (`apps/api`), env `PORT`, `DATABASE_URL` (pooler Supabase), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`, `WEB_URL`
- Database + Storage: Supabase PostgreSQL (PITR/backup di dashboard)
- Redis: Upstash `REDIS_URL` (opsional Phase 2–5; job billing Phase 6 memakai memori jika kosong)
- Email: `RESEND_API_KEY` + `MAIL_FROM` (tanpa ini, tautan verifikasi hanya di log)
- Midtrans Snap + webhook: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=true|false`
  - Checkout: API memanggil Snap create transaction
  - Webhook: `POST /api/v1/billing/webhook` (URL publik Nest, bukan Vercel)
- Observability: `SENTRY_DSN` (opsional; tanpa DSN API tetap boot)

## Env production wajib
- `NODE_ENV=production`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` kuat (bukan `change-me-*`)
- `WEB_ORIGIN` = origin Vercel
- `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` kuat (**bukan** `ChangeMeAdmin12` — API menolak default di production)
- Midtrans live keys + webhook URL terdaftar
- **Jangan** andalkan `ALLOW_MOCK_PAY` di production: endpoint mock-pay selalu 403 jika `NODE_ENV=production`

## Super Admin
Seed otomatis saat API start: `SUPER_ADMIN_EMAIL` (default `admin@kranjang.local`) dan `SUPER_ADMIN_PASSWORD`.  
Di production password wajib di-set dan bukan default. UI: `/admin/login` (tanpa prefill password).

## Backup / PITR (operator)
1. Buka Supabase Dashboard → Project Settings → Database → Backups
2. Pastikan PITR / Point-in-time recovery aktif untuk proyek live
3. Catat RPO/RTO dan uji restore di staging secara berkala

## RLS (opsional, operator)
Defense-in-depth: policy `tenant_id = current_setting('app.tenant_id')::uuid` bila diputuskan. Isolasi tenant tetap di JWT/app layer; RLS bukan pengganti.

## Checklist deploy
1. `pnpm db:generate && pnpm db:migrate && pnpm db:seed`
2. Set CORS `WEB_ORIGIN` ke origin Vercel
3. Webhook Midtrans ke URL publik Nest, bukan Vercel
4. Helmet + cookie refresh `SameSite=Lax`; `secure` hanya production
5. Jangan log password/token
6. Verifikasi mock-pay 403 di production; checkout menghasilkan `snapToken` dengan key live/sandbox
7. Set `SENTRY_DSN` bila ingin error 5xx ke Sentry
8. `pnpm db:cleanup-test` hanya di database non-produksi

## Tes
- API: `pnpm --filter @kranjang/api test`
- Loop operasional: beli bahan → terima → kasir jual RECIPE → dashboard = P&L
- Playwright smoke (opsional): `pnpm --filter @kranjang/web test` mencakup fetch halaman login jika server hidup
