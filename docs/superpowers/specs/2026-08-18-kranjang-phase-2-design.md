# Spec: Kranjang Phase 2 — Fondasi Auth, Tenant, RBAC, Landing

**Tanggal:** 18 Agustus 2026  
**Status:** disetujui dalam sesi desain; menunggu review file ini sebelum rencana implementasi  
**Dokumen induk:** [kranjang-prd.md](../../prd/kranjang-prd.md), [erd.md](../../prd/erd.md), [DESIGN.md](../../prd/DESIGN.md)

Phase 2 menghasilkan perangkat lunak yang bisa ditest: register usaha, login, isolasi tenant, RBAC, kelola user, plus landing marketing. Kasir, stok, laporan, Midtrans, dan Super Admin UI **tidak** masuk.

---

## 1. Tujuan dan batas

**Selesai jika:**

1. Owner mendaftar, mendapat tenant + trial 30 hari, lalu login ke app.
2. Tenant A tidak bisa membaca data Tenant B di semua endpoint yang hidup.
3. Role Cashier tidak bisa mengelola user (`user.manage` → 403).
4. Landing publik menampilkan produk dan CTA ke daftar/masuk.

**Di luar spec ini:** endpoint/halaman Produk, Inventory, Pembelian, POS, Biaya, Laporan, checkout Midtrans, Super Admin, RLS Supabase, Upstash Redis, Playwright POS.

---

## 2. Stack dan repo

pnpm workspaces **tanpa Turborepo**. Script root memanggil paket lewat `pnpm --filter`.

```
kranjang/
  apps/web          Next.js App Router, TypeScript, Tailwind, shadcn/ui
  apps/api          NestJS, prefix /api/v1
  packages/db       Prisma schema (ERD penuh) + seed
  packages/shared   Zod, enum, error code, permission code, kartu paket landing
  docs/             PRD dan spec ini
```

| Item | Keputusan |
| --- | --- |
| Node | 20 LTS |
| Package manager | pnpm |
| ORM | Prisma di `packages/db`, dipakai `apps/api` |
| Database | Supabase PostgreSQL (pooler port 6543 di production) |
| Auth | JWT access di JSON (memori browser) + refresh httpOnly cookie. Bukan Supabase Auth, bukan localStorage untuk access token |
| Password | Argon2id |
| Email dev | Tautan verifikasi/reset di log API |
| Email production | Resend (kode adapter ada; tidak wajib akun untuk DoD lokal) |
| Rate limit login | In-memory per instance |
| Font | Fallback DESIGN.md: display `Space Grotesk`, UI `Inter` |

Port lokal: web `3000`, API `3001`.

---

## 3. Arsitektur

```
Browser  →  apps/web  →  apps/api  →  Prisma  →  Supabase Postgres
                 │              │
                 │              ├─ Resend atau log tautan
                 └─ token desain DESIGN.md
```

- Web tidak menulis database dan tidak memverifikasi JWT secara bisnis; ia menyimpan access token di memori dan mengirim `Authorization: Bearer`.
- API memegang seluruh logic: registrasi atomik, RBAC, tenant dari JWT (`tid`), bukan dari body.
- `packages/shared` adalah sumber kontrak request/response. Form frontend dan ValidationPipe backend memakai skema Zod yang sama.
- `packages/db` memuat **seluruh** tabel ERD sekarang supaya Phase 3 tidak merombak migrasi. Endpoint yang diimplementasi hanya Auth, Me, Users, Roles, dan Settings tenant.

Modul NestJS Phase 2: `AuthModule`, `UsersModule`, `RolesModule`, `MeModule`, `TenantsModule` (settings saja). Tidak ada `SalesModule` / `ProductsModule`.

---

## 4. Skema data Phase 2

Sumber kolom: [erd.md](../../prd/erd.md). Ditambah satu tabel yang belum ada di ERD, wajib untuk rotasi refresh token:

### 4.1 `refresh_tokens`

| Kolom | Tipe | Ket |
| --- | --- | --- |
| id | UUID PK | |
| user_id | UUID FK | |
| token_hash | VARCHAR(255) | hash token, bukan plaintext |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ NULL | |
| replaced_by | UUID NULL | token pengganti setelah rotasi |
| created_at | TIMESTAMPTZ | |

IDX: `token_hash`, `(user_id, revoked_at)`. Logout dan rotasi men-set `revoked_at`.

### 4.2 Tabel ERD yang diisi di Phase 2

Saat **seed global** (`pnpm db:seed`): `permissions`, `subscription_plans` (trial/basic/business/pro), role template `tenant_id = null` (Owner, Administrator, Manager, Cashier, Inventory Staff) + `role_permissions`.

Saat **register** (satu transaksi Prisma): `tenants`, `tenant_settings`, copy role template → `roles` tenant, `users` Owner, `user_roles`, `outlets` “Outlet Utama”, `expense_categories` standar, `subscriptions` `TRIAL` 30 hari, `audit_logs` (`CREATE` tenant/user).

Tabel lain (products, sales, …) ada di migrasi, tetap kosong.

### 4.3 Aturan yang dikunci

- PK UUID `gen_random_uuid()`.
- Unique bisnis per tenant.
- Soft delete master: user, dan tenant (tidak dipakai UI Phase 2).
- Email user unik **global**.
- MVP: satu role aktif per user; tabel `user_roles` tetap M2M, API menolak body dengan banyak role.
- `tenant_id` di body request diabaikan.

---

## 5. Auth dan sesi

| Token | Umur | Tempat |
| --- | --- | --- |
| Access JWT | 15 menit | Response JSON; memori browser |
| Refresh | 7 hari | Cookie `kranjang_refresh`, httpOnly, `SameSite=Lax`, `Path=/api/v1/auth`, `Secure` hanya production |

Payload access: `sub` (userId), `tid` (tenantId), `role` (nama role aktif), `perms` (string permission).

**Register** `POST /api/v1/auth/register`

Body (shared Zod): `businessName`, `ownerName`, `email`, `password` (min 8), `phone` (wajib, string 10–20 karakter).

Perilaku:

1. Email sudah ada → 409 `CONFLICT`.
2. Slug dari nama usaha (huruf kecil, strip). Jika bentrok, suffiks `-` + 4 karakter acak sampai unik.
3. Transaksi sesuai ERD bagian 8. `trial_end_date` = sekarang + 30 hari. `subscription_status = TRIAL`. `payment_status = NONE`.
4. Password Argon2id.
5. Token verifikasi email (hash di `email_verification_tokens`, 24 jam). Dev: log URL mutlak web `/verify-email?token=…` (token plaintext hanya di log, DB menyimpan hash).
6. Response 201: `{ user, tenant, accessToken }` + `Set-Cookie` refresh. User boleh langsung masuk app.

**Login** `POST /api/v1/auth/login`

- User `is_super_admin` atau `tenant_id` null → 403 `FORBIDDEN`, pesan: akun platform tidak masuk aplikasi tenant di Phase 2.
- User soft-deleted → 401 `UNAUTHORIZED` (pesan generik).
- Password salah atau email tidak ada → 401 `UNAUTHORIZED`, pesan yang sama: “Email atau password salah.”
- Sukses: `last_login_at`, audit `LOGIN`, access + refresh.

Login **tidak** diblokir jika email belum terverifikasi. App menampilkan banner “Verifikasi email Anda” sampai `email_verified_at` terisi.

**Refresh** `POST /api/v1/auth/refresh`  
Cookie wajib. Hash dicocokkan, belum revoked, belum expired → revoke yang lama, terbitkan pasangan baru (rotasi). Gagal → 401, hapus cookie.

**Logout** `POST /api/v1/auth/logout`  
Revoke refresh, clear cookie, audit `LOGOUT`. Access di klien dibuang.

**Forgot / reset / verify** sesuai PRD. Reset password memakai `password_reset_tokens` (1 jam). Token sekali pakai (`used_at`).

**CORS:** allowlist `http://localhost:3000` dan origin Vercel nanti; `credentials: true`. Cookie domain di local: `localhost` (bukan `.localhost`).

---

## 6. RBAC dan user

Permission seed = daftar PRD 9.2 (`product.view` … `settings.manage`). Mapping default PRD 9.2.

Guard berurutan: JWT valid → `tid` di request context → `@RequirePermissions('user.manage')`.

Resource ketemu di DB tapi `tenant_id ≠ jwt.tid` → **404** `NOT_FOUND`, bukan 403.

### Users `/api/v1/users`

Hanya permission `user.manage`. Semua query wajib `tenantId = jwt.tid`.

| Aksi | Aturan |
| --- | --- |
| Create | name, email, password, phone opsional, `roleId` satu (harus role tenant itu) |
| Update | name, phone, `roleId` |
| Soft delete | `deleted_at` |
| Dilarang | hapus diri sendiri; demote atau hapus Owner terakhir di tenant; membuat user tenant lain |

Role seed semuanya `is_system`. Phase 2 tidak membuat role kustom dan tidak mengedit matrix permission (UI maupun `PATCH /roles/:id/permissions`). Halaman User & Role: daftar user, tambah/edit/hapus, pilih salah satu role sistem. `GET /roles` hanya daftar role + permission, baca saja.

### Me dan settings

- `GET/PATCH /api/v1/me` — nama, phone; bukan ganti tenant.
- `POST /api/v1/me/change-password` — password lama + baru.
- `GET/PATCH /api/v1/settings` — `settings.manage`: nama usaha, phone tenant, timezone, `allowNegativeStock`, `taxPercent`, `taxInclusive`, `receiptFooter`. `allowNegativeStock` disimpan sekarang; kasir belum memakainya.

---

## 7. Frontend: rute dan UI

Token warna/radius/tipe dari DESIGN.md. shadcn di-theme: primary `#17171c`, canvas `#ffffff`, deep green `#003c33`, coral `#ff7759`, CTA pill 32px, kartu media radius 22px, tanpa drop shadow berat.

### `(marketing)` — publik

- `/` beranda: nav (logo Kranjang, tautan Beranda / Harga, Masuk / Daftar), hero display di kanvas putih, kartu media, strip kepercayaan (placeholder logo teks, bukan merek fiktif seolah klien nyata), band hijau tua, 3 kartu paket, footer.
- Harga paket diimpor dari `PLAN_CARDS` di `packages/shared`. Isinya **hanya** Basic / Business / Pro (49000 / 99000 / 199000 IDR), sinkron dengan seed `subscription_plans`. Trial tidak dijual di landing. Tidak memanggil `GET /billing/plans`.
- `/harga` adalah halaman terpisah yang memakai komponen kartu paket yang sama dengan beranda, bukan alias redirect.
- CTA → `/register`.

### `(auth)` — tamu; jika sudah ada access token, redirect `/app`

- `/register`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`
- Copy bahasa Indonesia. Validasi Zod shared. Empty/loading/error pada form.

### `(app)` — wajib sesi

Layout sidebar PRD bagian 17.

| Item | Phase 2 |
| --- | --- |
| Dashboard | Selalu di nav. Empty state + sisa hari trial + banner verifikasi email jika `email_verified_at` null |
| User & Role | Tampil di nav hanya jika `user.manage`. URL langsung tanpa izin → halaman 403 |
| Pengaturan | Tampil di nav hanya jika `settings.manage`. URL langsung tanpa izin → halaman 403 |
| Profil | Selalu (menu avatar): profil + ganti password |
| Kasir, Produk, Inventory, Pembelian, Penjualan, Pelanggan, Supplier, Biaya, Laporan, Subscription | Terlihat oleh semua role, **disabled**, tooltip “Segera” |

Tanpa session (access hilang dan refresh gagal) → `/login`.

401 di app: buang access memori, **satu** kali `POST /auth/refresh`; gagal → `/login`.

---

## 8. Error handling

Bentuk seragam dari `packages/shared`:

```json
{ "code": "VALIDATION_ERROR", "message": "…", "details": {} }
```

`message` untuk UI, bahasa Indonesia.

| Situasi | HTTP | Code |
| --- | --- | --- |
| Tidak ada/expired access, refresh gagal | 401 | `UNAUTHORIZED` |
| Sesi valid, permission kurang | 403 | `FORBIDDEN` |
| Super Admin login ke app tenant | 403 | `FORBIDDEN` |
| Id tidak ada atau beda tenant | 404 | `NOT_FOUND` |
| Validasi Zod | 400 | `VALIDATION_ERROR` |
| Email sudah terpakai | 409 | `CONFLICT` |
| Login gagal (generik) | 401 | `UNAUTHORIZED` |
| >5 percobaan login per email per 15 menit | 429 | `RATE_LIMITED` |
| Gagal tak terduga (termasuk register gagal setelah BEGIN) | 500 | `INTERNAL_ERROR` — transaksi di-rollback; pesan generik ke klien |

Error code Phase 2: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`. `STOCK_INSUFFICIENT` dan `SUBSCRIPTION_INACTIVE` belum dipakai.

---

## 9. Keamanan

- Helmet + CORS allowlist.
- Prisma parameterized; `tenantId` dari JWT di repository/helper, bukan di controller body.
- Upload belum ada di Phase 2 (foto produk Phase 3).
- Rate limit login in-memory: kunci email dinormalisasi lowercase, 5 / 15 menit.
- Tidak log password atau token plaintext kecuali tautan verifikasi/reset di **dev**.
- Audit: `LOGIN`, `LOGOUT`, `CREATE`/`UPDATE`/`DELETE` user, `UPDATE` settings, register tenant.

---

## 10. Tes (DoD)

Jest integration di `apps/api` memakai `DATABASE_URL` yang sama dengan Prisma (developer mengarahkannya ke project Supabase non-production). Tidak ada database kedua. Setiap tes memakai email unik (`kranjang-test-{uuid}@example.com`) dan tidak menghapus data tenant lain. Tes tidak boleh dijalankan terhadap database production.

Wajib lulus:

1. Register → tenant, owner, outlet default, trial 30 hari, lima role tenant, `tenant_settings`, kategori expense, subscription TRIAL.
2. Login Owner → permission termasuk `user.manage` dan `subscription.manage`.
3. Dua tenant; user A tidak muncul di `GET /users` tenant B; `GET /users/:idA` sebagai B → 404.
4. Owner membuat user role Cashier; Cashier `DELETE /users/:id` → 403.
5. Email duplikat → 409; password salah → 401 generik; refresh tanpa cookie → 401.
6. Unit: hash password tidak menyimpan plaintext; slug unik saat nama usaha sama.

Frontend: tanpa Playwright di Phase 2. Verifikasi manual: landing → daftar → tautan log verifikasi → login → sidebar disabled → buat kasir → logout.

---

## 11. Env yang dibutuhkan

Web: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`

API: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN=http://localhost:3000`, `NODE_ENV`. Opsional: `RESEND_API_KEY`.

Tidak ada secret di git. `.env.example` di masing-masing app.

---

## 12. File yang akan dibuat (peta)

| Path | Tanggung jawab |
| --- | --- |
| `pnpm-workspace.yaml`, `package.json` root | Workspace, script `dev`, `db:migrate`, `db:seed` |
| `packages/shared/src` | Zod auth/users, enum status, `PERMISSIONS`, `PLAN_CARDS`, error codes |
| `packages/db/prisma/schema.prisma` | ERD + `refresh_tokens` |
| `packages/db/prisma/seed.ts` | Permission, plan, role template |
| `apps/api/src/auth` | Register/login/refresh/logout/forgot/reset/verify |
| `apps/api/src/users` | CRUD user + assign role |
| `apps/api/src/roles` | List role tenant (readonly) |
| `apps/api/src/me` | Profil, ganti password |
| `apps/api/src/tenants` | GET/PATCH settings |
| `apps/api/src/common` | JWT strategy, tenant context, permission guard, exception filter |
| `apps/web/app/(marketing)` | Landing + harga |
| `apps/web/app/(auth)` | Form auth |
| `apps/web/app/(app)` | Shell, dashboard placeholder, users, settings, profile |
| `apps/web/lib/api.ts` | Fetch + refresh sekali + cookie credentials |

---

## 13. Yang sengaja tidak dibuat

- `GET /billing/plans` dan checkout
- Enforcement expired/read-only
- Modul produk/POS
- Super Admin `/admin`
- Redis, Docker sebagai syarat `pnpm dev`
- Menyimpan access token di cookie atau localStorage
