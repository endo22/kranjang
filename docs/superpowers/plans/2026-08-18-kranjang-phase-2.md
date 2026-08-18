# Kranjang Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fondasi Kranjang yang bisa ditest: monorepo pnpm, skema ERD, register/login JWT+RBAC, isolasi tenant, kelola user, dan landing marketing.

**Architecture:** Next.js (`apps/web`) hanya UI; NestJS (`apps/api`) memegang bisnis; Prisma di `packages/db` (ERD penuh + `refresh_tokens`); kontrak Zod/enum di `packages/shared`. Access token 15 menit di JSON (memori browser); refresh 7 hari di cookie httpOnly `kranjang_refresh`.

**Tech Stack:** Node 20, pnpm, Next.js App Router, Tailwind, shadcn/ui, NestJS, Prisma, Supabase PostgreSQL, Argon2id, JWT, Zod, Jest + Supertest.

## Global Constraints

- Node 20 LTS, package manager pnpm, tanpa Turborepo.
- Bahasa UI Indonesia; uang IDR; timezone default `Asia/Jakarta`.
- Prefix API `/api/v1`. Error selalu `{ code, message, details }`.
- `tenantId` hanya dari JWT `tid`, bukan body. Resource beda tenant → 404 `NOT_FOUND`.
- Access token tidak di `localStorage` dan tidak di cookie. Refresh: cookie `kranjang_refresh`, httpOnly, `SameSite=Lax`, `Path=/api/v1/auth`, `Secure` hanya jika `NODE_ENV=production`.
- Password Argon2id, min 8 karakter. Email user unik global.
- Super Admin (`is_super_admin` atau `tenant_id` null) tidak boleh login ke app tenant (403 `FORBIDDEN`).
- Login boleh sebelum email terverifikasi; app menampilkan banner sampai `email_verified_at` terisi.
- Role kustom dan editor matrix permission tidak dibuat. Satu role per user.
- Landing memakai `PLAN_CARDS` (Basic/Business/Pro saja), bukan `GET /billing/plans`.
- Font: display `Space Grotesk`, UI `Inter`. Primary `#17171c`, canvas `#ffffff`, deep green `#003c33`, coral `#ff7759`, CTA pill 32px, kartu media radius 22px, tanpa drop shadow berat.
- Port: web `3000`, API `3001`. CORS `WEB_ORIGIN` + `credentials: true`.
- Tes API memakai `DATABASE_URL` non-production; email unik `kranjang-test-{uuid}@example.com`.
- Jangan implementasi POS, produk, Midtrans, Super Admin UI, Redis, atau RLS.

**Spec:** `docs/superpowers/specs/2026-08-18-kranjang-phase-2-design.md`  
**ERD:** `docs/prd/erd.md`  
**Desain visual:** `docs/prd/DESIGN.md`

---

## File structure

```
package.json
pnpm-workspace.yaml
.gitignore
.nvmrc
apps/api/package.json
apps/api/src/main.ts
apps/api/src/app.module.ts
apps/api/src/prisma/prisma.service.ts
apps/api/src/prisma/prisma.module.ts
apps/api/src/common/errors.ts
apps/api/src/common/http-exception.filter.ts
apps/api/src/common/zod-pipe.ts
apps/api/src/common/auth.constants.ts
apps/api/src/common/current-user.ts
apps/api/src/common/jwt.strategy.ts
apps/api/src/common/jwt-auth.guard.ts
apps/api/src/common/permissions.guard.ts
apps/api/src/common/require-permissions.ts
apps/api/src/auth/auth.module.ts
apps/api/src/auth/auth.controller.ts
apps/api/src/auth/auth.service.ts
apps/api/src/auth/tokens.ts
apps/api/src/auth/rate-limit.ts
apps/api/src/auth/mailer.ts
apps/api/src/users/users.module.ts
apps/api/src/users/users.controller.ts
apps/api/src/users/users.service.ts
apps/api/src/roles/roles.module.ts
apps/api/src/roles/roles.controller.ts
apps/api/src/roles/roles.service.ts
apps/api/src/me/me.module.ts
apps/api/src/me/me.controller.ts
apps/api/src/me/me.service.ts
apps/api/src/tenants/tenants.module.ts
apps/api/src/tenants/tenants.controller.ts
apps/api/src/tenants/tenants.service.ts
apps/api/test/helpers.ts
apps/api/test/auth.register.spec.ts
apps/api/test/auth.session.spec.ts
apps/api/test/auth.email.spec.ts
apps/api/test/users.rbac.spec.ts
apps/api/test/me.settings.spec.ts
apps/web/app/layout.tsx
apps/web/app/globals.css
apps/web/app/(marketing)/page.tsx
apps/web/app/(marketing)/harga/page.tsx
apps/web/app/(auth)/login/page.tsx
apps/web/app/(auth)/register/page.tsx
apps/web/app/(auth)/forgot-password/page.tsx
apps/web/app/(auth)/reset-password/page.tsx
apps/web/app/(auth)/verify-email/page.tsx
apps/web/app/(dashboard)/app/layout.tsx
apps/web/app/(dashboard)/app/page.tsx
apps/web/app/(dashboard)/app/users/page.tsx
apps/web/app/(dashboard)/app/settings/page.tsx
apps/web/app/(dashboard)/app/profile/page.tsx
apps/web/components/marketing/*
apps/web/components/app/sidebar.tsx
apps/web/lib/api.ts
apps/web/lib/auth-context.tsx
packages/shared/src/*
packages/db/prisma/schema.prisma
packages/db/prisma/seed.ts
packages/db/src/index.ts
```

Setiap file satu tanggung jawab. Modul NestJS tidak saling impor service lintas domain kecuali lewat Prisma.

---

### Task 1: Workspace pnpm + `packages/shared`

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/permissions.ts`
- Create: `packages/shared/src/plans.ts`
- Create: `packages/shared/src/auth-schemas.ts`
- Create: `packages/shared/src/user-schemas.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/shared.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: `ERROR_CODES`, `PERMISSION_CODES`, `ROLE_TEMPLATE_PERMISSIONS`, `PLAN_CARDS`, `SUBSCRIPTION_PLANS_SEED`, `EXPENSE_CATEGORY_NAMES`, `registerSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `verifyEmailSchema`, `changePasswordSchema`, `patchMeSchema`, `createUserSchema`, `updateUserSchema`, `patchSettingsSchema`, type `RegisterBody`, `LoginBody`, `ApiErrorBody`

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/package.json`:

```json
{
  "name": "@kranjang/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "node --import tsx --test src/shared.test.ts"
  },
  "dependencies": {
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
```

`packages/shared/src/shared.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ERROR_CODES,
  PERMISSION_CODES,
  PLAN_CARDS,
  ROLE_TEMPLATE_PERMISSIONS,
  SUBSCRIPTION_PLANS_SEED,
  loginSchema,
  registerSchema,
} from "./index.ts";

describe("shared contracts", () => {
  it("exposes Phase 2 error codes", () => {
    assert.deepEqual(ERROR_CODES, [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_ERROR",
      "CONFLICT",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
    ]);
  });

  it("Owner has user.manage and subscription.manage; Cashier does not", () => {
    assert.ok(ROLE_TEMPLATE_PERMISSIONS.Owner.includes("user.manage"));
    assert.ok(ROLE_TEMPLATE_PERMISSIONS.Owner.includes("subscription.manage"));
    assert.ok(!ROLE_TEMPLATE_PERMISSIONS.Cashier.includes("user.manage"));
    assert.equal(ROLE_TEMPLATE_PERMISSIONS.Administrator.includes("subscription.manage"), false);
    assert.equal(PERMISSION_CODES.length, 21);
  });

  it("landing cards are paid plans only and match seed prices", () => {
    assert.deepEqual(PLAN_CARDS.map((p) => p.code), ["basic", "business", "pro"]);
    for (const card of PLAN_CARDS) {
      const seed = SUBSCRIPTION_PLANS_SEED.find((s) => s.code === card.code);
      assert.ok(seed);
      assert.equal(seed.priceMonthly, card.priceMonthly);
    }
  });

  it("rejects short password and short phone", () => {
    const parsed = registerSchema.safeParse({
      businessName: "Warung",
      ownerName: "Budi",
      email: "budi@example.com",
      password: "short",
      phone: "08123",
    });
    assert.equal(parsed.success, false);
  });

  it("accepts valid register and login bodies", () => {
    const reg = registerSchema.parse({
      businessName: "Warung Nasi Goreng Pak Budi",
      ownerName: "Budi",
      email: "budi@example.com",
      password: "password12",
      phone: "081234567890",
    });
    assert.equal(reg.email, "budi@example.com");
    assert.equal(loginSchema.parse({ email: "budi@example.com", password: "password12" }).email, "budi@example.com");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

```bash
pnpm --filter @kranjang/shared test
```

Expected: FAIL (workspace/file belum ada atau `Cannot find module`).

- [ ] **Step 3: Implementasi minimal**

Root `package.json`:

```json
{
  "name": "kranjang",
  "private": true,
  "packageManager": "pnpm@10.6.5",
  "scripts": {
    "dev": "pnpm --filter @kranjang/api --filter @kranjang/web --parallel dev",
    "test": "pnpm --filter @kranjang/shared test && pnpm --filter @kranjang/api test",
    "db:generate": "pnpm --filter @kranjang/db generate",
    "db:migrate": "pnpm --filter @kranjang/db migrate",
    "db:seed": "pnpm --filter @kranjang/db seed"
  },
  "engines": {
    "node": ">=20"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

`.nvmrc`: `20`

`.gitignore`:

```
node_modules
dist
.next
.env
.env.local
*.log
packages/db/src/generated
coverage
```

`packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`packages/shared/src/errors.ts`:

```ts
export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiErrorBody = {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
};
```

`packages/shared/src/permissions.ts`:

```ts
export const PERMISSION_CODES = [
  "product.view",
  "product.create",
  "product.update",
  "product.delete",
  "recipe.manage",
  "sales.view",
  "sales.create",
  "sales.cancel",
  "purchase.view",
  "purchase.create",
  "purchase.receive",
  "inventory.view",
  "inventory.adjust",
  "expense.view",
  "expense.create",
  "expense.update",
  "expense.delete",
  "report.view",
  "user.manage",
  "subscription.manage",
  "settings.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const ROLE_TEMPLATE_NAMES = [
  "Owner",
  "Administrator",
  "Manager",
  "Cashier",
  "Inventory Staff",
] as const;

export const ROLE_TEMPLATE_PERMISSIONS: Record<(typeof ROLE_TEMPLATE_NAMES)[number], readonly PermissionCode[]> = {
  Owner: PERMISSION_CODES,
  Administrator: PERMISSION_CODES.filter((c) => c !== "subscription.manage"),
  Manager: [
    "product.view",
    "product.update",
    "recipe.manage",
    "sales.view",
    "purchase.view",
    "inventory.view",
    "expense.view",
    "report.view",
    "settings.manage",
  ],
  Cashier: ["product.view", "sales.view", "sales.create"],
  "Inventory Staff": [
    "product.view",
    "product.create",
    "product.update",
    "recipe.manage",
    "purchase.view",
    "purchase.create",
    "purchase.receive",
    "inventory.view",
    "inventory.adjust",
  ],
};

export const EXPENSE_CATEGORY_NAMES = [
  "listrik",
  "air",
  "internet",
  "sewa",
  "gaji",
  "transportasi",
  "maintenance",
  "marketing",
  "lainnya",
] as const;
```

`packages/shared/src/plans.ts`:

```ts
export const SUBSCRIPTION_PLANS_SEED = [
  { code: "trial", name: "Free Trial", priceMonthly: 0, durationDays: 30, maxOutlets: 1, featureReports: true, featureInventory: true, featureMultiOutlet: false, featureExport: false },
  { code: "basic", name: "Basic", priceMonthly: 49000, durationDays: 30, maxOutlets: 1, featureReports: true, featureInventory: true, featureMultiOutlet: false, featureExport: false },
  { code: "business", name: "Business", priceMonthly: 99000, durationDays: 30, maxOutlets: 1, featureReports: true, featureInventory: true, featureMultiOutlet: false, featureExport: true },
  { code: "pro", name: "Pro", priceMonthly: 199000, durationDays: 30, maxOutlets: 1, featureReports: true, featureInventory: true, featureMultiOutlet: false, featureExport: true },
] as const;

export const PLAN_CARDS = SUBSCRIPTION_PLANS_SEED.filter((p) => p.code !== "trial").map((p) => ({
  code: p.code,
  name: p.name,
  priceMonthly: p.priceMonthly,
}));
```

`packages/shared/src/auth-schemas.ts`:

```ts
import { z } from "zod";

export const registerSchema = z.object({
  businessName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
  phone: z.string().min(10).max(20),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(72),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
```

`packages/shared/src/user-schemas.ts`:

```ts
import { z } from "zod";

export const patchMeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).nullable().optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
  phone: z.string().min(10).max(20).optional(),
  roleId: z.string().uuid(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).nullable().optional(),
  roleId: z.string().uuid().optional(),
});

export const patchSettingsSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).nullable().optional(),
  timezone: z.string().min(3).max(40).optional(),
  allowNegativeStock: z.boolean().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  receiptFooter: z.string().max(2000).nullable().optional(),
});
```

`packages/shared/src/index.ts`:

```ts
export * from "./errors.ts";
export * from "./permissions.ts";
export * from "./plans.ts";
export * from "./auth-schemas.ts";
export * from "./user-schemas.ts";
```

- [ ] **Step 4: Jalankan tes sampai lulus**

```bash
pnpm install
pnpm --filter @kranjang/shared test
```

Expected: PASS, 5 tes.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .nvmrc .gitignore packages/shared pnpm-lock.yaml
git commit -m "feat: add pnpm workspace and shared API contracts"
```

---

### Task 2: Prisma ERD + seed

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/prisma/schema.prisma` (salin dari `docs/superpowers/plans/2026-08-18-kranjang-phase-2.schema.prisma`)
- Create: `packages/db/prisma/seed.ts`
- Create: `packages/db/src/index.ts`
- Test: `packages/db/src/seed-plans.test.ts`

**Interfaces:**
- Consumes: `PERMISSION_CODES`, `ROLE_TEMPLATE_PERMISSIONS`, `SUBSCRIPTION_PLANS_SEED` dari `@kranjang/shared`
- Produces: `PrismaClient` dari `packages/db/src/index.ts`; tabel `refresh_tokens`; seed mengisi `permissions`, `subscription_plans`, role template `tenant_id = null`

Kolom, tipe Decimal, dan relasi **harus** mengikuti `docs/prd/erd.md` bagian 4 (semua tabel 4.1–4.28). Tambah model `RefreshToken` `@@map("refresh_tokens")` sesuai spec 4.1. PK UUID `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`. Uang `Decimal(19,2)`, qty `Decimal(18,4)`, waktu `DateTime @db.Timestamptz`. `@@map` snake_case plural. `onDelete: Restrict` kecuali `PurchaseItem` → Cascade. Relasi resep: `RecipeMenu` / `RecipeIngredient`. Unique parsial ERD yang tidak didukung Prisma biasa: buat unique biasa + filter `deletedAt` di aplikasi.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/db/src/seed-plans.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_CARDS, SUBSCRIPTION_PLANS_SEED } from "@kranjang/shared";

const root = dirname(fileURLToPath(import.meta.url));

describe("prisma schema and seed data", () => {
  it("schema contains refresh_tokens and tenants", () => {
    const schema = readFileSync(join(root, "../prisma/schema.prisma"), "utf8");
    assert.match(schema, /@@map\("refresh_tokens"\)/);
    assert.match(schema, /@@map\("tenants"\)/);
    assert.match(schema, /@@map\("sales"\)/);
  });

  it("seed plan codes include trial plus landing cards", () => {
    assert.deepEqual(
      SUBSCRIPTION_PLANS_SEED.map((p) => p.code),
      ["trial", "basic", "business", "pro"],
    );
    assert.equal(PLAN_CARDS.length, 3);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Tambah dulu script test di `packages/db/package.json` (boleh gagal resolve schema). Run:

```bash
pnpm --filter @kranjang/db test
```

Expected: FAIL `schema.prisma` tidak ada.

- [ ] **Step 3: Tulis schema + seed**

`packages/db/package.json`:

```json
{
  "name": "@kranjang/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "seed": "prisma db seed",
    "test": "node --import tsx --test src/seed-plans.test.ts"
  },
  "dependencies": {
    "@kranjang/shared": "workspace:*",
    "@prisma/client": "^6.5.0"
  },
  "devDependencies": {
    "prisma": "^6.5.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
```

Tambah di `packages/db/package.json` (prisma seed config) — Prisma 6 membaca:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Gabungkan kedua objek JSON itu jadi satu `package.json`.

`packages/db/src/index.ts`:

```ts
export { PrismaClient } from "./generated/client/index.js";
```

Salin **tanpa mengubah isi** file `docs/superpowers/plans/2026-08-18-kranjang-phase-2.schema.prisma` ke `packages/db/prisma/schema.prisma`. Unique `(tenantId, name)` pada `Role` sudah `@@unique([tenantId, name])`. Seed template memakai `findFirst({ where: { tenantId: null, name } })` lalu `create` jika kosong — bukan `upsert` dengan `tenantId` null.

`packages/db/prisma/seed.ts`:

```ts
import { PrismaClient } from "../src/generated/client/index.js";
import {
  PERMISSION_CODES,
  ROLE_TEMPLATE_PERMISSIONS,
  ROLE_TEMPLATE_NAMES,
  SUBSCRIPTION_PLANS_SEED,
} from "@kranjang/shared";

const prisma = new PrismaClient();

async function main() {
  for (const code of PERMISSION_CODES) {
    const [module] = code.split(".");
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, module, description: code },
    });
  }

  const permissions = await prisma.permission.findMany();
  const byCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const plan of SUBSCRIPTION_PLANS_SEED) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        durationDays: plan.durationDays,
        maxOutlets: plan.maxOutlets,
        featureReports: plan.featureReports,
        featureInventory: plan.featureInventory,
        featureMultiOutlet: plan.featureMultiOutlet,
        featureExport: plan.featureExport,
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        durationDays: plan.durationDays,
        maxOutlets: plan.maxOutlets,
        featureReports: plan.featureReports,
        featureInventory: plan.featureInventory,
        featureMultiOutlet: plan.featureMultiOutlet,
        featureExport: plan.featureExport,
        isActive: true,
      },
    });
  }

  for (const name of ROLE_TEMPLATE_NAMES) {
    let role = await prisma.role.findFirst({ where: { tenantId: null, name } });
    if (!role) {
      role = await prisma.role.create({ data: { tenantId: null, name, isSystem: true } });
    } else {
      role = await prisma.role.update({ where: { id: role.id }, data: { isSystem: true } });
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: ROLE_TEMPLATE_PERMISSIONS[name].map((code) => ({
        roleId: role.id,
        permissionId: byCode.get(code)!,
      })),
    });
  }
}

main().finally(() => prisma.$disconnect());
```

Catatan: unique `Role` `(tenantId, name)` dengan `tenantId` null di PostgreSQL hanya satu baris per nama — sesuai template.

`packages/db/.env.example`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
```

- [ ] **Step 4: Generate, migrate, tes**

Salin `.env.example` → `packages/db/.env` dengan URL Supabase non-production. Lalu:

```bash
pnpm install
pnpm db:generate
pnpm --filter @kranjang/db exec prisma migrate dev --name init
pnpm db:seed
pnpm --filter @kranjang/db test
```

Expected: migrasi sukses, seed tanpa error, tes PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add Prisma schema from ERD and platform seed"
```

---

### Task 3: NestJS bootstrap + filter error + register

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`, `apps/api/.env.example`
- Create: seluruh file `apps/api/src/common/*`, `apps/api/src/prisma/*`, `apps/api/src/auth/*`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/test/helpers.ts`, `apps/api/test/auth.register.spec.ts`

**Interfaces:**
- Consumes: `registerSchema`, `PrismaClient`, seed role template
- Produces: `POST /api/v1/auth/register` → 201 `{ user, tenant, accessToken }` + cookie `kranjang_refresh`; `AuthService.register(body: RegisterBody): Promise<AuthResult>`; `AuthResult = { user: AuthUserDto, tenant: AuthTenantDto, accessToken: string, refreshPlain: string }`; `AuthUserDto = { id: string, name: string, email: string, role: string, permissions: string[], emailVerifiedAt: string | null }`; `AuthTenantDto = { id: string, name: string, slug: string, subscriptionStatus: string, trialEndDate: string }`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/helpers.ts`:

```ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { RegisterBody } from "@kranjang/shared";

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  await app.init();
  return app;
}

export function uniqueEmail(): string {
  return `kranjang-test-${randomUUID()}@example.com`;
}

export function registerBody(overrides: Partial<RegisterBody> = {}): RegisterBody {
  return {
    businessName: "Warung Nasi Goreng Pak Budi",
    ownerName: "Budi",
    email: uniqueEmail(),
    password: "password12",
    phone: "081234567890",
    ...overrides,
  };
}

export function register(app: INestApplication, body?: Partial<RegisterBody>) {
  return request(app.getHttpServer()).post("/api/v1/auth/register").send(registerBody(body));
}
```

`apps/api/test/auth.register.spec.ts`:

```ts
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@kranjang/db";
import { ROLE_TEMPLATE_NAMES } from "@kranjang/shared";
import { createApp, register, uniqueEmail } from "./helpers";

describe("POST /api/v1/auth/register", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("returns VALIDATION_ERROR for empty body", async () => {
    const res = await register(app, { businessName: "", ownerName: "", email: "x", password: "1", phone: "1" } as never);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("creates tenant, owner, outlet, trial, roles, settings, expenses, subscription", async () => {
    const email = uniqueEmail();
    const res = await register(app, { email });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("Owner");
    expect(res.body.user.permissions).toEqual(expect.arrayContaining(["user.manage", "subscription.manage"]));
    expect(res.body.tenant.subscriptionStatus).toBe("TRIAL");
    expect(res.headers["set-cookie"].join(";")).toMatch(/kranjang_refresh=/);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: res.body.tenant.id } });
    const days = (tenant.trialEndDate.getTime() - tenant.trialStartDate.getTime()) / 86400000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);

    const roles = await prisma.role.findMany({ where: { tenantId: tenant.id } });
    expect(roles.map((r) => r.name).sort()).toEqual([...ROLE_TEMPLATE_NAMES].sort());

    expect(await prisma.outlet.count({ where: { tenantId: tenant.id, name: "Outlet Utama" } })).toBe(1);
    expect(await prisma.tenantSettings.count({ where: { tenantId: tenant.id } })).toBe(1);
    expect(await prisma.expenseCategory.count({ where: { tenantId: tenant.id } })).toBe(9);
    expect(await prisma.subscription.count({ where: { tenantId: tenant.id, status: "TRIAL" } })).toBe(1);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(owner.passwordHash).not.toBe("password12");
    expect(owner.passwordHash.length).toBeGreaterThan(20);
  });

  it("returns CONFLICT for duplicate email", async () => {
    const email = uniqueEmail();
    expect((await register(app, { email })).status).toBe(201);
    const again = await register(app, { email });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("CONFLICT");
  });

  it("makes unique slugs for the same business name", async () => {
    const a = await register(app, { businessName: "Warung Sama" });
    const b = await register(app, { businessName: "Warung Sama" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.tenant.slug).not.toBe(b.body.tenant.slug);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

```bash
pnpm --filter @kranjang/api test
```

Expected: FAIL (package/app belum ada).

- [ ] **Step 3: Implementasi**

`apps/api/package.json` scripts: `"dev": "tsx watch src/main.ts"`, `"test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand"`. Dependencies: `@nestjs/common` `@nestjs/core` `@nestjs/platform-express` `@nestjs/jwt` `@nestjs/passport` `passport` `passport-jwt` `cookie-parser` `argon2` `helmet` `reflect-metadata` `rxjs` `zod` `@kranjang/shared` `@kranjang/db`. Dev: `jest` `ts-jest` `@types/jest` `supertest` `@types/supertest` `@types/cookie-parser` `@types/passport-jwt` `tsx` `typescript`.

Jest config di `apps/api/package.json`:

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "roots": ["<rootDir>/test"],
    "moduleNameMapper": {
      "^(\\.\\.?/.+)\\.js$": "$1"
    }
  }
}
```

`apps/api/.env.example`:

```
DATABASE_URL=
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
WEB_ORIGIN=http://localhost:3000
WEB_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
```

`main.ts`: Helmet, CORS `origin: process.env.WEB_ORIGIN`, `credentials: true`, `cookieParser()`, `app.setGlobalPrefix("api/v1")`, listen `PORT || 3001`.

`HttpExceptionFilter`: tangkap `HttpException` dan unknown. Unknown → status 500, `{ code: "INTERNAL_ERROR", message: "Terjadi kesalahan. Silakan coba lagi.", details: {} }`. Jika `exception.getResponse()` sudah `ApiErrorBody`, pakai itu.

Buat `AppError extends HttpException` dengan constructor `(code, message, status, details = {})`.

`ZodPipe`: `schema.parse(value)` catch → `AppError("VALIDATION_ERROR", "Data tidak valid", 400, { issues })`.

`tokens.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import { JwtService } from "@nestjs/jwt";

export const REFRESH_COOKIE = "kranjang_refresh";
export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type JwtPayload = { sub: string; tid: string; role: string; perms: string[] };

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function newRefreshPlain(): string {
  return randomBytes(32).toString("hex");
}

export function signAccess(jwt: JwtService, payload: JwtPayload): string {
  return jwt.sign(payload, { expiresIn: ACCESS_TTL_SEC });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/api/v1/auth",
    secure: process.env.NODE_ENV === "production",
    maxAge: REFRESH_TTL_MS,
  };
}
```

`mailer.ts`:

```ts
export function sendDevLink(kind: "verify" | "reset", url: string): void {
  console.log(`[kranjang-mail] ${kind}: ${url}`);
}
```

`AuthService.register`:

1. `findFirst` user `email` + `deletedAt: null` → jika ada, `AppError("CONFLICT", "Email sudah terpakai", 409)`.
2. `argon2.hash(password)`.
3. `slugify(businessName)`; loop jika slug dipakai, tambah `-${randomBytes(2).toString("hex")}`.
4. `prisma.$transaction`: create Tenant (`subscriptionStatus: "TRIAL"`, `paymentStatus: "NONE"`, trial +30 hari, `subscriptionPlanId` = plan `trial`); TenantSettings; copy setiap Role `tenantId: null` beserta RolePermission; User Owner; UserRole ke role Owner; Outlet `Outlet Utama` `isDefault: true`; ExpenseCategory dari `EXPENSE_CATEGORY_NAMES` `isSystem: true`; Subscription `status: "TRIAL"`, `billingCycle: "TRIAL"`, period start/end = trial; AuditLog `CREATE` module `tenant`.
5. Buat `EmailVerificationToken` (plain random, simpan hash, expires 24 jam). Log `sendDevLink("verify", `${WEB_URL}/verify-email?token=${plain}`)`.
6. Access JWT + refresh plain, simpan `RefreshToken` hash, expires 7 hari.
7. Return `AuthResult` (tanggal `trialEndDate` ISO string).

Controller set cookie lalu return JSON tanpa `refreshPlain`.

Jangan baca `tenantId` dari body.

- [ ] **Step 4: Jalankan tes sampai lulus**

Pastikan `apps/api/.env` berisi `DATABASE_URL` yang sama dengan `packages/db/.env`.

```bash
pnpm --filter @kranjang/api test test/auth.register.spec.ts
```

Expected: PASS keempat tes.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: register tenant with trial and JWT session"
```

---

### Task 4: Login, refresh rotasi, logout, rate limit

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`, `auth.service.ts`, `rate-limit.ts`
- Create: `apps/api/src/common/jwt.strategy.ts`, `jwt-auth.guard.ts`
- Test: `apps/api/test/auth.session.spec.ts`

**Interfaces:**
- Consumes: `loginSchema`, `hashToken`, cookie `kranjang_refresh`
- Produces: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`; pesan login gagal persis `"Email atau password salah."`; Super Admin `"Akun platform tidak dapat masuk ke aplikasi tenant pada fase ini."`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@kranjang/db";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers";

describe("auth session", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("logs in owner and sets refresh cookie", async () => {
    const email = uniqueEmail();
    await register(app, { email });
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "password12" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("Owner");
    expect(res.headers["set-cookie"].join(";")).toMatch(/kranjang_refresh=/);
  });

  it("returns generic UNAUTHORIZED for bad password", async () => {
    const email = uniqueEmail();
    await register(app, { email });
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "wrong-pass" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(res.body.message).toBe("Email atau password salah.");
  });

  it("rejects super admin login", async () => {
    const email = uniqueEmail();
    const hash = await (await import("argon2")).default.hash("password12");
    await prisma.user.create({
      data: { email, name: "SA", passwordHash: hash, isSuperAdmin: true, tenantId: null },
    });
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "password12" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("rotates refresh token", async () => {
    const email = uniqueEmail();
    const created = await register(app, { email });
    const cookie = created.headers["set-cookie"];
    const first = await request(app.getHttpServer()).post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();
    const old = await request(app.getHttpServer()).post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(old.status).toBe(401);
  });

  it("refresh without cookie is UNAUTHORIZED", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rate-limits the 6th failed login within 15 minutes", async () => {
    const email = uniqueEmail();
    await register(app, { email });
    for (let i = 0; i < 5; i += 1) {
      const failed = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "wrong-pass" });
      expect(failed.status).toBe(401);
    }
    const limited = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "wrong-pass" });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
  });

  it("logout revokes refresh", async () => {
    const created = await register(app);
    const cookie = created.headers["set-cookie"];
    const out = await request(app.getHttpServer()).post("/api/v1/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(200);
    const again = await request(app.getHttpServer()).post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(again.status).toBe(401);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

```bash
pnpm --filter @kranjang/api test test/auth.session.spec.ts
```

Expected: FAIL (route login belum ada / 404).

- [ ] **Step 3: Implementasi**

`rate-limit.ts`: `Map<string, { count: number; resetAt: number }>`. `assertLoginAllowed(email: string)`: jika `count > 5` dan `now < resetAt` → `AppError("RATE_LIMITED", "Terlalu banyak percobaan login. Coba lagi nanti.", 429)`. Window 15 menit. `resetLoginFailures` dipanggil saat login sukses.

`login`: cari user `email` `deletedAt: null`. Jika tidak ada atau `argon2.verify` gagal → pesan generik 401. Jika `isSuperAdmin || tenantId == null` → 403. Load role+permissions. Update `lastLoginAt`. Audit `LOGIN`. Terbitkan access+refresh (revoke tidak perlu).

`refresh`: baca cookie; hash; cari `RefreshToken` `revokedAt: null` `expiresAt > now`; set `revokedAt`; buat token baru `replacedBy`; access baru. Gagal → clear cookie + 401.

`logout`: revoke semua refresh user yang match cookie / semua aktif user itu; clear cookie; audit `LOGOUT`.

JwtStrategy: extract Bearer, secret `JWT_ACCESS_SECRET`, validate mengembalikan `JwtPayload`.

- [ ] **Step 4: Jalankan tes sampai lulus**

```bash
pnpm --filter @kranjang/api test test/auth.session.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add login, rotating refresh, and logout"
```

---

### Task 5: Verifikasi email, lupa/reset password

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`, `auth.service.ts`, `mailer.ts`
- Test: `apps/api/test/auth.email.spec.ts`

**Interfaces:**
- Consumes: `verifyEmailSchema`, `forgotPasswordSchema`, `resetPasswordSchema`
- Produces: `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`; forgot selalu 200 meski email tidak ada (jangan bocorkan); token hash di DB, plaintext hanya di log dev

- [ ] **Step 1: Tulis tes yang gagal**

```ts
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@kranjang/db";
import { createHash } from "node:crypto";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers";

describe("email verification and reset", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("verifies email with stored token hash", async () => {
    const email = uniqueEmail();
    const created = await register(app, { email });
    const userId = created.body.user.id;
    const plain = "test-verify-token-plain";
    await prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: createHash("sha256").update(plain).digest("hex"),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const res = await request(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token: plain });
    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("resets password and allows new login", async () => {
    const email = uniqueEmail();
    await register(app, { email });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const plain = "test-reset-token-plain";
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(plain).digest("hex"),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const reset = await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: plain, password: "newpass123" });
    expect(reset.status).toBe(200);
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "newpass123" });
    expect(login.status).toBe(200);
  });

  it("forgot-password always 200", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/forgot-password").send({ email: uniqueEmail() });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

```bash
pnpm --filter @kranjang/api test test/auth.email.spec.ts
```

Expected: FAIL 404.

- [ ] **Step 3: Implementasi**

Verify: hash token, cari baris `usedAt: null` `expiresAt > now`, set `usedAt` + `user.emailVerifiedAt = now`. Token tidak valid → 400 `VALIDATION_ERROR` pesan `"Tautan tidak valid atau kedaluwarsa."`.

Forgot: jika user ada, buat token 1 jam, log `${WEB_URL}/reset-password?token=...`. Response `{ ok: true }` selalu.

Reset: sama seperti verify; `argon2.hash` password baru; `usedAt`; revoke semua `RefreshToken` user itu.

- [ ] **Step 4: Tes lulus**

```bash
pnpm --filter @kranjang/api test test/auth.email.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add email verification and password reset"
```

---

### Task 6: Users CRUD, isolasi tenant, RBAC Cashier

**Files:**
- Create: `apps/api/src/users/*`, `apps/api/src/roles/*`, `apps/api/src/common/permissions.guard.ts`, `require-permissions.ts`, `current-user.ts`
- Test: `apps/api/test/users.rbac.spec.ts`

**Interfaces:**
- Consumes: `JwtPayload`, `createUserSchema`, `updateUserSchema`
- Produces: `GET/POST /api/v1/users`, `GET/PATCH/DELETE /api/v1/users/:id`, `GET /api/v1/roles`; `UsersService` selalu `where: { tenantId: payload.tid, deletedAt: null }`; `@RequirePermissions("user.manage")` pada users write/read; roles `@RequirePermissions("user.manage")` (halaman User & Role)

- [ ] **Step 1: Tulis tes yang gagal**

```ts
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@kranjang/db";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers";

async function login(app: INestApplication, email: string, password = "password12") {
  return request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password });
}

describe("users RBAC and tenant isolation", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("hides tenant A user from tenant B", async () => {
    const a = await register(app, { email: uniqueEmail(), businessName: "Usaha A" });
    const b = await register(app, { email: uniqueEmail(), businessName: "Usaha B" });
    const list = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${b.body.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.find((u: { id: string }) => u.id === a.body.user.id)).toBeUndefined();

    const get = await request(app.getHttpServer())
      .get(`/api/v1/users/${a.body.user.id}`)
      .set("Authorization", `Bearer ${b.body.accessToken}`);
    expect(get.status).toBe(404);
    expect(get.body.code).toBe("NOT_FOUND");
  });

  it("forbids cashier from deleting users", async () => {
    const ownerEmail = uniqueEmail();
    const owner = await register(app, { email: ownerEmail });
    const roles = await request(app.getHttpServer())
      .get("/api/v1/roles")
      .set("Authorization", `Bearer ${owner.body.accessToken}`);
    const cashierRole = roles.body.find((r: { name: string }) => r.name === "Cashier");
    const cashierEmail = uniqueEmail();
    const created = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ name: "Kasir Satu", email: cashierEmail, password: "password12", roleId: cashierRole.id });
    expect(created.status).toBe(201);

    const cashierLogin = await login(app, cashierEmail);
    const del = await request(app.getHttpServer())
      .delete(`/api/v1/users/${created.body.id}`)
      .set("Authorization", `Bearer ${cashierLogin.body.accessToken}`);
    expect(del.status).toBe(403);
    expect(del.body.code).toBe("FORBIDDEN");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

```bash
pnpm --filter @kranjang/api test test/users.rbac.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementasi**

`@CurrentUser()` decorator: `request.user` sebagai `JwtPayload`.

`PermissionsGuard`: baca metadata `permissions`, jika `user.perms` tidak mengandung semua → `AppError("FORBIDDEN", "Anda tidak memiliki izin untuk aksi ini.", 403)`. Tanpa JWT → 401.

`UsersService.list/get/create/update/softDelete`:
- get: tidak ketemu atau beda tenant → 404 `"Data tidak ditemukan."` (pesan sama).
- create: role harus `role.tenantId === tid`; email unik; hash password; satu `UserRole`.
- update role: dilarang jika target adalah Owner terakhir dan `roleId` bukan Owner → 400 `VALIDATION_ERROR`.
- delete: dilarang `id === sub`; dilarang hapus Owner terakhir; soft delete.

`RolesService.list`: roles `tenantId = tid` include permissions, tidak ada PATCH.

Response user: `{ id, name, email, phone, role, createdAt }` tanpa `passwordHash`.

- [ ] **Step 4: Tes lulus**

```bash
pnpm --filter @kranjang/api test test/users.rbac.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add tenant-scoped users and RBAC guards"
```

---

### Task 7: Me, ganti password, settings

**Files:**
- Create: `apps/api/src/me/*`, `apps/api/src/tenants/*`
- Test: `apps/api/test/me.settings.spec.ts`

**Interfaces:**
- Consumes: `patchMeSchema`, `changePasswordSchema`, `patchSettingsSchema`
- Produces: `GET/PATCH /api/v1/me`, `POST /api/v1/me/change-password`, `GET/PATCH /api/v1/settings` (`settings.manage`)

- [ ] **Step 1: Tulis tes yang gagal**

```ts
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers";

describe("me and settings", () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });

  it("patches profile and tenant settings", async () => {
    const owner = await register(app, { email: uniqueEmail() });
    const auth = { Authorization: `Bearer ${owner.body.accessToken}` };
    const me = await request(app.getHttpServer()).patch("/api/v1/me").set(auth).send({ name: "Budi Edited" });
    expect(me.status).toBe(200);
    expect(me.body.name).toBe("Budi Edited");

    const settings = await request(app.getHttpServer())
      .patch("/api/v1/settings")
      .set(auth)
      .send({ allowNegativeStock: true, timezone: "Asia/Jakarta" });
    expect(settings.status).toBe(200);
    expect(settings.body.allowNegativeStock).toBe(true);
  });

  it("changes password", async () => {
    const email = uniqueEmail();
    const owner = await register(app, { email });
    const res = await request(app.getHttpServer())
      .post("/api/v1/me/change-password")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ currentPassword: "password12", newPassword: "password99" });
    expect(res.status).toBe(200);
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: "password99" });
    expect(login.status).toBe(200);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

```bash
pnpm --filter @kranjang/api test test/me.settings.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementasi**

`MeService.get/patch` dari `sub`. Change password: verify current, hash baru. Settings: update `Tenant` + `TenantSettings` untuk `tid`. GET settings gabungan `{ name, phone, timezone, allowNegativeStock, taxPercent, taxInclusive, receiptFooter, trialEndDate, subscriptionStatus }`.

- [ ] **Step 4: Tes lulus**

```bash
pnpm --filter @kranjang/api test
```

Expected: **semua** tes API PASS (register, session, email, users, me).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add profile and tenant settings endpoints"
```

---

### Task 8: Next.js + token DESIGN.md + landing

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/(marketing)/page.tsx`, `apps/web/app/(marketing)/harga/page.tsx`, `apps/web/components/marketing/plan-cards.tsx`, `apps/web/components/marketing/site-header.tsx`, `apps/web/components/marketing/site-footer.tsx`, `apps/web/.env.example`

**Interfaces:**
- Consumes: `PLAN_CARDS` dari `@kranjang/shared`
- Produces: rute `/` dan `/harga`; CTA ke `/register`; nav Masuk `/login`

Frontend Phase 2 **tanpa Playwright**. Verifikasi: `pnpm --filter @kranjang/web build` sukses.

- [ ] **Step 1: Scaffold Next.js + shadcn**

Di `apps/web`: Next 15 App Router, TypeScript, Tailwind, eslint. `transpilePackages: ["@kranjang/shared"]`.

Init shadcn (neutral, CSS variables). Tambah komponen: `button`, `input`, `label`, `card`, `toast` (sonner), `dropdown-menu`, `tooltip`, `avatar`, `dialog`, `sheet`.

`globals.css` set:

```css
:root {
  --background: #ffffff;
  --foreground: #212121;
  --primary: #17171c;
  --primary-foreground: #ffffff;
  --accent: #003c33;
  --destructive: #b30000;
  --radius: 0.5rem;
}
body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.font-display { font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.02em; }
```

Layout import Google fonts Inter + Space Grotesk.

- [ ] **Step 2: Landing**

Header: logo teks “Kranjang”, tautan Beranda `/`, Harga `/harga`, tombol pill Masuk dan Daftar.

Hero: headline display besar, subcopy Indonesia, CTA primer Daftar, sekunder Masuk (underline).

Kartu media radius 22px, latar `soft-stone` `#eeece7`, tanpa data dashboard fiktif.

Strip kepercayaan: teks “Dipakai pemilik warung dan rumah makan”, 4 placeholder nama generik (bukan merek palsu seolah klien).

Band `#003c33` radius 22px, teks putih, penjelasan HPP/resep.

`plan-cards.tsx` map `PLAN_CARDS`, format `Rp 49.000` (id-ID), CTA Daftar.

Footer gelap `#17171c`.

`/harga` memakai `PlanCards` yang sama, bukan redirect.

- [ ] **Step 3: Build**

```bash
pnpm --filter @kranjang/web build
```

Expected: compile sukses.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: add marketing landing with shared plan cards"
```

---

### Task 9: Halaman auth + klien sesi

**Files:**
- Create: `apps/web/lib/api.ts`, `apps/web/lib/auth-context.tsx`, `apps/web/app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx`
- Modify: `apps/web/app/layout.tsx` (bungkus `AuthProvider`)

**Interfaces:**
- Consumes: `registerSchema`, `loginSchema`, `NEXT_PUBLIC_API_URL` default `http://localhost:3001/api/v1`
- Produces: `api<T>(path, init)` — `credentials: "include"`, `Authorization` jika ada access; pada 401 **sekali** `POST /auth/refresh` lalu ulang; `AuthProvider` state memori `{ accessToken, user, tenant } | null`; bootstrap: `refresh` saat mount

- [ ] **Step 1: `api.ts` + `auth-context.tsx`**

`setAccessToken` di module-level variable (`let accessToken: string | null`), bukan localStorage.

`AuthProvider.login/register` simpan `user`, `tenant`, `accessToken` dari JSON.

`logout` panggil `POST /auth/logout` lalu clear state.

- [ ] **Step 2: Form**

Register fields sesuai `registerSchema`. Error `message` dari API. Sukses → `router.push("/app")`.

Login sama. Forgot: pesan “Jika email terdaftar, tautan dikirim.” (dev: cek log API). Reset baca `?token=`. Verify baca `?token=`, tampilkan sukses/gagal.

Jika `user` sudah ada, halaman auth `redirect("/app")`.

- [ ] **Step 3: Build**

```bash
pnpm --filter @kranjang/web build
```

Expected: sukses.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: add auth pages and in-memory session client"
```

---

### Task 10: App shell, dashboard, users, settings, profil

**Files:**
- Create: `apps/web/components/app/sidebar.tsx`, `apps/web/components/app/topbar.tsx`, `apps/web/app/(dashboard)/app/layout.tsx`, `page.tsx`, `users/page.tsx`, `settings/page.tsx`, `profile/page.tsx`, `forbidden/page.tsx`

**Interfaces:**
- Consumes: `user.permissions`, `GET /me`, `GET /settings`, `GET /users`, `GET /roles`
- Produces: `/app` wajib sesi (bootstrap refresh gagal → `/login`); nav disabled “Segera” untuk modul masa depan; User & Role / Pengaturan **disembunyikan** jika permission tidak ada; URL langsung tanpa izin → `/app/forbidden` (403 UI)

- [ ] **Step 1: Layout**

Sidebar item:

```ts
export const NAV = [
  { href: "/app", label: "Dashboard", kind: "live" as const },
  { href: "/app/users", label: "User & Role", kind: "perm" as const, permission: "user.manage" },
  { href: "/app/settings", label: "Pengaturan", kind: "perm" as const, permission: "settings.manage" },
  { href: "/app/cashier", label: "Kasir", kind: "soon" as const },
  { href: "/app/products", label: "Produk", kind: "soon" as const },
  { href: "/app/inventory", label: "Inventory", kind: "soon" as const },
  { href: "/app/purchases", label: "Pembelian", kind: "soon" as const },
  { href: "/app/sales", label: "Penjualan", kind: "soon" as const },
  { href: "/app/customers", label: "Pelanggan", kind: "soon" as const },
  { href: "/app/suppliers", label: "Supplier", kind: "soon" as const },
  { href: "/app/expenses", label: "Biaya", kind: "soon" as const },
  { href: "/app/reports", label: "Laporan", kind: "soon" as const },
  { href: "/app/subscription", label: "Subscription", kind: "soon" as const },
];
```

`kind: "soon"` → disabled + Tooltip “Segera”. Avatar menu: Profil, Keluar.

Layout: jika loading refresh, skeleton; jika tidak ada sesi, `redirect("/login")`.

Banner jika `!user.emailVerifiedAt`: “Verifikasi email Anda. Cek log server untuk tautan (mode pengembangan).”

- [ ] **Step 2: Halaman hidup**

Dashboard: sisa hari trial `Math.ceil((trialEnd - now) / 86400000)` dari settings/tenant; empty state “Isi produk dan resep di tahap berikutnya, lalu jual di kasir.”

Users: tabel, dialog tambah (name, email, password, phone, select role), edit, hapus dengan konfirmasi. Jangan tampilkan hash.

Settings: form PATCH fields spec. `allowNegativeStock` checkbox, disimpan, tidak dipakai kasir.

Profile: PATCH `/me` + form ganti password.

Guard klien: jika path `/app/users` dan `!perms.includes("user.manage")` → `/app/forbidden`.

- [ ] **Step 3: Build + tes API ulang**

```bash
pnpm --filter @kranjang/web build
pnpm --filter @kranjang/api test
```

Expected: keduanya sukses.

- [ ] **Step 4: Smoke manual (DoD spec)**

`pnpm dev`. Alur: landing → daftar → (opsional tautan log verify) → login → sidebar disabled → Owner buat user Cashier → logout → login Cashier tidak melihat User & Role → buka `/app/users` dapat 403 UI.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add app shell, users admin, and settings"
```

---

## Self-review (coverage)

| Spec | Task |
| --- | --- |
| Monorepo pnpm, Node 20, tanpa Turbo | 1 |
| Shared Zod, PLAN_CARDS, permissions | 1 |
| Prisma ERD + refresh_tokens + seed | 2 |
| Register atomik + trial 30 hari + cookie | 3 |
| Login/refresh/logout/rate limit/super admin | 4 |
| Verify/forgot/reset + log tautan | 5 |
| Isolasi tenant 404, Cashier 403 | 6 |
| Me, password, settings | 7 |
| Landing + /harga | 8 |
| Auth pages + memori token + refresh bootstrap | 9 |
| Shell, banner verifikasi, nav disabled | 10 |
| Tes Jest DoD 1–6 | 3–7 |
| Tidak ada POS/Midtrans/admin | semua task menolak menambahnya |
