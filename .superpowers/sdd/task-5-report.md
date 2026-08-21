# Task 5 Report: Verifikasi email, lupa/reset password

## Status

Selesai diimplementasikan pada branch `feat/phase-2-auth` dengan pendekatan TDD.

## Requirement Coverage

- Menambahkan `POST /api/v1/auth/verify-email` dengan validasi `verifyEmailSchema`.
- Menambahkan `POST /api/v1/auth/forgot-password` dengan validasi `forgotPasswordSchema` dan response `{ ok: true }` selalu, termasuk saat email tidak ditemukan.
- Menambahkan `POST /api/v1/auth/reset-password` dengan validasi `resetPasswordSchema`.
- Token verify dan reset tetap disimpan hashed memakai `hashToken()`, sementara plaintext hanya dipakai untuk dev log melalui `sendDevLink()`.
- Token verify atau reset yang invalid/kedaluwarsa mengembalikan `400 VALIDATION_ERROR` dengan pesan persis `Tautan tidak valid atau kedaluwarsa.`
- Reset password meng-hash password baru memakai `@node-rs/argon2` Argon2id, menandai `usedAt`, lalu merevoke semua `RefreshToken` aktif milik user.

## TDD Log

### RED

Command:

```bash
pnpm --filter @kranjang/api test test/auth.email.spec.ts
```

Hasil awal gagal sesuai ekspektasi brief:

- `POST /api/v1/auth/verify-email` mengembalikan `404` alih-alih `200/400`
- `POST /api/v1/auth/forgot-password` mengembalikan `404` alih-alih `200`
- `POST /api/v1/auth/reset-password` mengembalikan `404` alih-alih `200/400`

### GREEN

Command:

```bash
pnpm --filter @kranjang/api test test/auth.email.spec.ts
```

Hasil:

- `1` test suite lulus
- `6` test lulus

### Regression Verification

Command:

```bash
pnpm --filter @kranjang/api test
```

Hasil:

- `5` test suite lulus
- `25` test lulus

## Files Changed

- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/test/auth.email.spec.ts`
- `.superpowers/sdd/task-5-report.md`

## Implementation Notes

- Verify email mencari token hashed yang `usedAt = null` dan `expiresAt > now`, lalu menandai token terpakai dan mengisi `user.emailVerifiedAt`.
- Forgot password membuat token reset baru selama `1` jam hanya untuk user aktif (`deletedAt = null`), lalu menulis link `${WEB_URL}/reset-password?token=...` via `sendDevLink("reset", ...)`.
- Test memakai plaintext tetap dari brief, sehingga sebelum insert token manual test membersihkan hash yang sama agar rerun tidak salah mengambil row lama.

## Concerns

- Forgot/reset saat ini menumpuk token lama yang belum dipakai. Ini masih sesuai brief, tetapi jika nanti ingin membatasi satu tautan aktif per user, perlu kebijakan revoke/cleanup tambahan.

## Task 5 Review Follow-up

- Finding yang diperbaiki: `apps/api/src/auth/mailer.ts` tidak lagi men-`console.log` link plaintext saat `NODE_ENV=production`.
- Perilaku logging tetap aktif untuk `development`, `test`, dan environment non-production lain yang dipakai suite ini, sehingga tes existing tetap bisa membaca link dev.
- Verifikasi:

```bash
pnpm --filter @kranjang/api test test/auth.email.spec.ts
```

- Hasil: `7` test lulus, `1` suite lulus.
