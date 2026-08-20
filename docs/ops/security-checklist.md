# Checklist security Phase 8

- [x] Helmet di Nest bootstrap
- [x] CORS allowlist `WEB_ORIGIN` + credentials
- [x] JWT access pendek + refresh httpOnly
- [x] `tenantId` dari JWT, resource silang tenant → 404
- [x] Password Argon2id
- [x] Rate limit login
- [x] Tidak menyimpan access token di localStorage
- [ ] RLS Supabase sebagai lapisan kedua (opsional PRD)
- [ ] APM (Sentry/OpenTelemetry) di production
- [ ] Backup/PITR Supabase diaktifkan di proyek live
- [ ] Ganti default super admin password
- [ ] Matikan `ALLOW_MOCK_PAY` di production
