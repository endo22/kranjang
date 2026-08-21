# Checklist security Phase 8

- [x] Helmet di Nest bootstrap
- [x] CORS allowlist `WEB_ORIGIN` + credentials
- [x] JWT access pendek + refresh httpOnly
- [x] `tenantId` dari JWT, resource silang tenant → 404
- [x] Password Argon2id
- [x] Rate limit login
- [x] Tidak menyimpan access token di localStorage
- [ ] RLS Supabase sebagai lapisan kedua (opsional PRD — operator)
- [x] APM Sentry wiring di API (`SENTRY_DSN`; no-op tanpa DSN)
- [ ] Backup/PITR Supabase diaktifkan di proyek live (operator — lihat runbook)
- [ ] Ganti default super admin password di lingkungan live (kode menolak default di production)
- [x] Matikan mock-pay di production (`NODE_ENV=production` → selalu 403)
