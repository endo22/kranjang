# Kranjang Phase 9 Block A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selesaikan Blok A Power Pack (minggu 1–4): sesi kasir dengan nominal + ringkasan selisih, kasir filter/barcode/pajak settings, UI produk/kategori edit+BOM+minStock, stok movement terfilter + WASTE wajib catatan.

**Architecture:** Perluas API Nest yang sudah ada (sales/catalog/inventory) + UI Next yang create-heavy. Ringkasan tutup sesi dihitung di service (tanpa migrasi wajib). Prefer query/filter pada list existing. Tidak membuka §5.3.

**Tech Stack:** NestJS 11, Prisma 6, Zod (`@kranjang/shared`), Next 15 App Router, `api`/`jsonInit` di `apps/web/lib/api.ts`, Jest+Supertest API, `tsx --test` web.

**Spec:** [docs/prd/kranjang-prd-phase-9-power.md](../../prd/kranjang-prd-phase-9-power.md) §6.1–6.3, roadmap Blok A  
**Dasar:** [docs/prd/kranjang-prd.md](../../prd/kranjang-prd.md) §11 (rumus uang tidak diubah)

## Global Constraints

- Bahasa UI Indonesia; IDR; timezone `Asia/Jakarta`.
- Prefix `/api/v1`. Error `{ code, message, details }`.
- `tenantId` hanya dari JWT `tid`.
- Body JSON: selalu `jsonInit({ ... })` — **jangan** `jsonInit(JSON.stringify(...))`.
- Tidak menambah role/permission baru.
- Tidak multi-outlet, meja, split payment, printer native, varian, waste %, unit conversion.
- `ALLOW_MOCK_PAY` / Midtrans live / Phase 8 checklist: di luar Blok A.
- Foto produk Blok A: **URL tervalidasi** (`imageUrl` di `productSchema`) — unggah Storage boleh Next, bukan wajib Blok A.
- Tes API: email unik `kranjang-test-{uuid}@example.com` via helpers existing.

## Out of this plan (Blok B/C)

Pembelian detail/cancel draft, sales list/cancel UI, mitra edit, expense polish, dashboard banding+export UI, users soft-disable, billing/admin polish, pagination penuh semua list — rencana terpisah.

---

## File structure (sentuhan utama)

```
packages/shared/src/ops-schemas.ts          # cashierClose notes; inventory WASTE notes refine; product list n/a
apps/api/src/sales/sales.service.ts         # closeSession summary; currentSession totals; tax from settings
apps/api/src/sales/sales.controller.ts      # passthrough
apps/api/src/catalog/catalog.service.ts     # listProducts filters q/categoryId/productType
apps/api/src/catalog/catalog.controller.ts  # Query params
apps/api/src/inventory/inventory.service.ts # movements filters; adjust WASTE notes; low-stock helper optional
apps/api/src/inventory/inventory.controller.ts
apps/api/test/phase9.block-a.spec.ts        # new focused API tests
apps/web/app/(dashboard)/app/cashier/page.tsx
apps/web/app/(dashboard)/app/products/page.tsx
apps/web/app/(dashboard)/app/inventory/page.tsx
apps/web/test/pos-smoke.test.ts             # extend if cheap
```

---

### Task 1: API — ringkasan tutup sesi kasir

**Files:**
- Modify: `packages/shared/src/ops-schemas.ts` (`cashierCloseSchema`)
- Modify: `apps/api/src/sales/sales.service.ts` (`closeSession`, helper `summarizeSession`)
- Test: `apps/api/test/phase9.block-a.spec.ts` (create)

**Interfaces:**
- Consumes: `CashierSession`, `Sale` + `SalePayment` (atau field payment di sale), status sale bukan `CANCELLED`
- Produces: close response shape:

```ts
type CashierCloseResult = {
  id: string;
  status: "CLOSED";
  openingCash: number;
  closingCash: number;
  closedAt: string; // ISO
  summary: {
    salesCount: number;
    salesTotal: number;
    cashSalesTotal: number;
    expectedCash: number;
    cashDifference: number;
  };
};
```

Rumus (kunci):
- `salesCount` / `salesTotal`: penjualan sesi dengan `status !== "CANCELLED"` (samakan string status yang dipakai `toSale` / create sale).
- `cashSalesTotal`: total net penjualan sesi yang punya payment method `CASH` (atau satu payment CASH) — ikuti model `SalePayment` / field yang sudah dipakai saat POST sales.
- `expectedCash = openingCash + cashSalesTotal` (MVP: tidak ada cash refund terpisah; cancel mengembalikan stok tapi sesi yang sudah CLOSED tidak dihitung ulang — hanya hitung saat close).
- `cashDifference = closingCash - expectedCash`.

- [ ] **Step 1: Perluas schema close**

Di `ops-schemas.ts`:

```ts
export const cashierCloseSchema = z.object({
  closingCash: z.number().min(0),
  closingNotes: z.string().trim().max(255).optional().nullable(),
});
```

Catatan: `closingNotes` boleh diabaikan persist jika kolom belum ada — simpan ke audit `writeAudit` details saja di Step 3 jika tidak migrasi.

- [ ] **Step 2: Tulis tes gagal dulu**

Buat `apps/api/test/phase9.block-a.spec.ts`:

```ts
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp, register, uniqueEmail } from "./helpers.js";

describe("phase 9 block A", () => {
  it("closes cashier session with cash difference summary", async () => {
    const app = await createApp();
    const email = uniqueEmail();
    const created = await register(app, { email, businessName: `Warung ${email.slice(0, 8)}` });
    const auth = { Authorization: `Bearer ${created.body.accessToken}` };
    const server = request(app.getHttpServer());

    const product = await server.post("/api/v1/products").set(auth).send({
      name: "Air Mineral",
      productType: "SIMPLE",
      unit: "botol",
      buyPrice: 2000,
      sellPrice: 5000,
      minStock: 2,
    });
    expect(product.status).toBe(201);

    await server.post("/api/v1/inventory/adjust").set(auth).send({
      productId: product.body.id,
      quantity: 10,
      movementType: "INITIAL_STOCK",
      notes: "awal",
    });

    const opened = await server.post("/api/v1/cashier-sessions/open").set(auth).send({ openingCash: 100000 });
    expect(opened.status).toBe(201);

    const sale = await server.post("/api/v1/sales").set(auth).send({
      paymentMethod: "CASH",
      items: [{ productId: product.body.id, quantity: 2 }],
    });
    expect(sale.status).toBe(201);

    const closed = await server
      .post(`/api/v1/cashier-sessions/${opened.body.id}/close`)
      .set(auth)
      .send({ closingCash: 110000 });
    expect(closed.status).toBe(200);
    expect(closed.body.summary.salesCount).toBe(1);
    expect(closed.body.summary.cashSalesTotal).toBe(10000);
    expect(closed.body.summary.expectedCash).toBe(110000);
    expect(closed.body.summary.cashDifference).toBe(0);
  });
});
```

Sesuaikan expected status code close jika API sekarang mengembalikan 201 — samakan dengan controller existing lalu assert konsisten.

- [ ] **Step 3: Jalankan tes — harus FAIL** (summary belum ada)

Run: `pnpm --filter @kranjang/api test -- phase9.block-a`  
(atau perintah test package yang dipakai repo; cek `apps/api/package.json` scripts)

Expected: FAIL pada `closed.body.summary`

- [ ] **Step 4: Implement `summarizeSession` + `closeSession`**

Di `sales.service.ts`, sebelum update status CLOSED, aggregate sales untuk `session.id`. Kembalikan session + `summary` dengan `asNumber`/`roundMoney`. Persist `closingNotes` via `writeAudit` action `CASHIER_CLOSE` jika tidak ada kolom.

- [ ] **Step 5: Jalankan tes — PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/ops-schemas.ts apps/api/src/sales/sales.service.ts apps/api/test/phase9.block-a.spec.ts
git commit -m "feat(sales): ringkasan selisih kas saat tutup sesi"
```

---

### Task 2: UI kasir — nominal buka/tutup + tampil ringkasan

**Files:**
- Modify: `apps/web/app/(dashboard)/app/cashier/page.tsx`

**Interfaces:**
- Consumes: `CashierCloseResult` dari Task 1; `jsonInit({ openingCash })` / `jsonInit({ closingCash })`
- Produces: state UI `lastCloseSummary` untuk ditampilkan setelah tutup

- [ ] **Step 1: State nominal**

Tambah state:

```tsx
const [openingCash, setOpeningCash] = useState("0");
const [closingCash, setClosingCash] = useState("0");
const [lastSummary, setLastSummary] = useState<null | {
  salesCount: number;
  salesTotal: number;
  expectedCash: number;
  cashDifference: number;
}>(null);
```

- [ ] **Step 2: Form buka sesi**

Ganti hardcode open:

```tsx
void api("/cashier-sessions/open", {
  method: "POST",
  ...jsonInit({ openingCash: Number(openingCash) || 0 }),
})
```

Tampilkan `<Input type="number" min={0} value={openingCash} onChange=... />` sebelum tombol Buka sesi.

- [ ] **Step 3: Form tutup sesi**

Sama untuk `closingCash`; pada sukses:

```tsx
.then((result: { summary: typeof lastSummary }) => {
  setLastSummary(result.summary);
  return load();
})
```

Render ringkasan dengan `formatRp` jika `lastSummary` ada.

- [ ] **Step 4: Manual / smoke** — buka http://localhost:3000/app/cashier, buka sesi 100000, jual CASH, tutup 100000+omzet, selisih 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/app/cashier/page.tsx
git commit -m "feat(web): input kas buka/tutup sesi dan ringkasan"
```

---

### Task 3: Kasir — filter kategori, Enter barcode, settings pajak

**Files:**
- Modify: `apps/web/app/(dashboard)/app/cashier/page.tsx`
- Modify: `apps/api/src/sales/sales.service.ts` (pastikan create sale baca tax settings tenant — verifikasi dulu; jika sudah ada, hanya UI diskon)
- Modify: `apps/api/src/catalog/catalog.controller.ts` + `catalog.service.ts` jika list products belum support query

**Interfaces:**
- GET `/products?q=&categoryId=` (Blok A minimal)
- GET `/categories` existing
- GET `/settings` atau embed tax di load kasir

- [ ] **Step 1: Load categories + settings di kasir**

```tsx
const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
const [categoryFilter, setCategoryFilter] = useState("");
const [discount, setDiscount] = useState("0");
// settings: taxPercent, taxInclusive, receiptFooter, name
```

`load()` parallel: products, current session, categories, settings.

- [ ] **Step 2: Filter client-side dulu (cukup Blok A jika produk < 500)**

```tsx
const filtered = products.filter((p) => {
  if (!p.isActive) return false;
  if (categoryFilter && p.categoryId !== categoryFilter) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return p.name.toLowerCase().includes(q) || (p.barcode?.includes(query) ?? false);
});
```

Pastikan tipe Product punya `categoryId`, `barcode`, `isActive` — perluas mapping API product list jika field hilang di `toProduct`.

- [ ] **Step 3: Enter handler**

Pada input cari `onKeyDown`:

```tsx
if (event.key === "Enter") {
  event.preventDefault();
  const exactBarcode = products.filter((p) => p.barcode && p.barcode === query.trim());
  const pool = exactBarcode.length === 1 ? exactBarcode : filtered;
  if (pool.length === 1) {
    // add to cart qty+1 (reuse logic tombol produk)
  }
}
```

Autofocus input cari.

- [ ] **Step 4: Checkout body**

```tsx
...jsonInit({
  paymentMethod: method,
  discountAmount: Number(discount) || 0,
  items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
})
```

Verifikasi `sales.service` create sudah hitung tax dari `tenant` settings; jika hardcoded 0, wire `taxPercent`/`taxInclusive` dari `requireTenantOutlet` / settings row **tanpa mengubah rumus §11** (pajak tetap masuk revenue sesuai PRD).

- [ ] **Step 5: Preview struk print**

Setelah sale sukses, `window.print()` pada elemen struk sederhana (nama toko, items, total, metode, footer) — CSS `@media print` hide chrome app jika mudah; minimal `window.open` dokumen teks.

- [ ] **Step 6: Toast stok**

`catch` → `toast.error(error.message)` sudah ada; pastikan `ApiError` message dari `STOCK_INSUFFICIENT` tampil utuh.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/(dashboard)/app/cashier/page.tsx apps/api/src/sales/sales.service.ts apps/api/src/catalog/*
git commit -m "feat(web): kasir filter kategori, barcode Enter, diskon/pajak"
```

---

### Task 4: API — list produk filter + pastikan PATCH minStock/barcode

**Files:**
- Modify: `apps/api/src/catalog/catalog.controller.ts`
- Modify: `apps/api/src/catalog/catalog.service.ts`
- Test: extend `phase9.block-a.spec.ts`

**Interfaces:**
- `listProducts(user, { q?: string; categoryId?: string; productType?: string; activeOnly?: boolean })`
- Response items include `minStock`, `barcode`, `categoryId`, `isActive`, `imageUrl`

- [ ] **Step 1: Tes**

```ts
it("filters products by q and returns minStock", async () => {
  // create two products, GET /products?q=Air
  // expect length 1 and body[0].minStock defined
});
```

- [ ] **Step 2: FAIL lalu implement Query di controller**

```ts
@Get("products")
listProducts(
  @CurrentUser() user: JwtPayload | undefined,
  @Query("q") q?: string,
  @Query("categoryId") categoryId?: string,
  @Query("productType") productType?: string,
) {
  return this.catalogService.listProducts(this.require(user), { q, categoryId, productType });
}
```

`where`: `deletedAt: null`, optional `name contains q` OR barcode equals, categoryId, productType. Prisma `mode: "insensitive"` jika provider support; else `contains` biasa.

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "feat(catalog): filter list produk dan expose minStock"
```

---

### Task 5: UI produk — edit, nonaktif, BOM, barcode, minStock, imageUrl

**Files:**
- Modify: `apps/web/app/(dashboard)/app/products/page.tsx` (perluasan besar; boleh tetap satu file Blok A)

**Interfaces:**
- PATCH `/products/:id` body subset productSchema
- PUT `/products/:id/recipe` `{ items: [{ ingredientId, quantity }] }`
- DELETE `/products/:id` atau PATCH `isActive: false` — prefer soft via PATCH `isActive: false` jika delete keras berbahaya; jika API Delete = soft, pakai Delete.

- [ ] **Step 1: List actions**

Tiap baris produk: tombol Edit, Nonaktif. Klik Edit isi form state dari produk (GET `/products/:id` jika list tipis).

- [ ] **Step 2: Form fields**

Tambah input: `barcode`, `minStock`, `imageUrl` (URL), checkbox aktif. Submit create vs patch tergantung `editingId`.

```tsx
await api(`/products/${editingId}`, {
  method: "PATCH",
  ...jsonInit({
    name,
    productType,
    unit,
    sellPrice: Number(sellPrice),
    buyPrice: Number(buyPrice),
    categoryId: categoryId || null,
    barcode: barcode || null,
    minStock: Number(minStock) || 0,
    imageUrl: imageUrl || null,
    isActive,
  }),
});
```

- [ ] **Step 3: Editor BOM**

Jika `productType === "RECIPE"` dan editing: list bahan dari GET detail (pastikan API detail menyertakan recipe items — jika belum, perluas `getProduct`). UI: pilih ingredient + qty, simpan PUT recipe.

- [ ] **Step 4: Kategori edit**

PATCH `/categories/:id` dari list kategori (inline rename) + DELETE dengan toast error jika gagal FK.

- [ ] **Step 5: Manual cek** — edit nama, set minStock 5, set recipe, nonaktif → tidak muncul di kasir (`isActive` filter Task 3).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(dashboard)/app/products/page.tsx apps/api/src/catalog/catalog.service.ts
git commit -m "feat(web): edit produk, BOM, barcode, dan minStock"
```

---

### Task 6: API inventory — filter movements + WASTE notes wajib

**Files:**
- Modify: `packages/shared/src/ops-schemas.ts` (`inventoryAdjustSchema`)
- Modify: `apps/api/src/inventory/inventory.controller.ts`
- Modify: `apps/api/src/inventory/inventory.service.ts`
- Test: `phase9.block-a.spec.ts`

**Interfaces:**
- GET `/inventory/movements?from=&to=&productId=`
- Adjust: jika `movementType === "WASTE"` dan notes kosong → 400 `VALIDATION_ERROR` `"Catatan wajib untuk waste."`

- [ ] **Step 1: Schema**

Refine dengan `.superRefine` pada `inventoryAdjustSchema`:

```ts
export const inventoryAdjustSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number(),
    movementType: z.enum(["ADJUSTMENT", "WASTE", "INITIAL_STOCK"]),
    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.movementType === "WASTE" && !value.notes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Catatan wajib untuk waste.", path: ["notes"] });
    }
  });
```

- [ ] **Step 2: Tes**

```ts
it("rejects WASTE without notes and filters movements", async () => {
  // adjust WASTE without notes → 400
  // adjust WASTE with notes → 201
  // GET movements?productId= → contains row
});
```

- [ ] **Step 3: Implement query movements**

```ts
async movements(user: JwtPayload, query: { from?: string; to?: string; productId?: string }) {
  const where: Prisma.StockMovementWhereInput = { tenantId: user.tid };
  if (query.productId) where.productId = query.productId;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }
  return this.prisma.stockMovement.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
}
```

Wire `@Query` di controller.

- [ ] **Step 4: PASS + commit**

```bash
git commit -m "feat(inventory): filter movement dan catatan wajib untuk waste"
```

---

### Task 7: UI inventory — filter + low stock + notes WASTE

**Files:**
- Modify: `apps/web/app/(dashboard)/app/inventory/page.tsx`

- [ ] **Step 1: State filter** `from`, `to`, `productId`; load movements dengan query string.

- [ ] **Step 2: Field notes**; jika `movementType === "WASTE"` dan notes kosong, toast dan jangan submit.

- [ ] **Step 3: Section "Stok menipis"** — dari products di mana `productType !== "RECIPE"` dan `stock <= minStock` dan `minStock > 0`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): filter stok movement, waste notes, dan peringatan min stock"
```

---

### Task 8: Regresi Blok A

- [ ] **Step 1:** Jalankan `apps/api` tests termasuk `ops.loop` + `phase9.block-a` — semua PASS.

- [ ] **Step 2:** Jalankan `pnpm --filter @kranjang/web test` — PASS (jsonInit + smoke).

- [ ] **Step 3:** Checklist manual singkat di PR/commit message body:
  - Buka/tutup sesi nominal + ringkasan
  - Filter kategori + Enter barcode
  - Edit produk + BOM + minStock
  - WASTE tanpa notes ditolak; low stock terlihat

- [ ] **Step 4: Commit chore jika ada fix kecil terakhir**

```bash
git commit -m "test: regresi phase 9 block A"
```

---

## Self-review vs PRD §6.1–6.3

| Requirement | Task |
| --- | --- |
| Nominal buka/tutup + ringkasan selisih | 1–2 |
| Filter kategori, barcode Enter, diskon/pajak, struk print, toast stok | 3 |
| Edit/nonaktif produk, BOM, barcode, minStock, imageUrl | 4–5 |
| Movement filter, WASTE notes, low stock | 6–7 |
| Regresi | 8 |
| Storage upload foto | Ditunda Next (URL only) — sesuai keputusan Blok A di Global Constraints |
| §5.3 items | Tidak ada task |

---

## Execution handoff

Plan tersimpan di `docs/superpowers/plans/2026-08-20-kranjang-phase-9-block-a.md`.

**Dua opsi eksekusi:**

1. **Subagent-Driven (disarankan)** — satu subagent per task, review antar task  
2. **Inline Execution** — kerjakan task berurutan di sesi ini dengan checkpoint  

Blok B/C punya plan terpisah setelah Blok A hijau.

**Pilih pendekatan mana?**
