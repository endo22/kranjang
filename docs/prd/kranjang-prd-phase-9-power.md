# PRD Kranjang — Phase 9 Power Pack

**Produk:** Kranjang — SaaS pencatatan usaha dan kasir (POS)  
**Dokumen:** Phase 9 — Power Pack (perkuat modul existing)  
**Versi:** 9.0  
**Tanggal:** 20 Agustus 2026  
**Status:** Disetujui — 20 Agustus 2026  
**Dasar:** [kranjang-prd.md](./kranjang-prd.md) v1.1 (Phase 1–8)  
**Bahasa produk:** Indonesia  
**Mata uang:** IDR  
**Timezone default:** `Asia/Jakarta`

---

## 1. Ringkasan eksekutif

Phase 2–8 sudah menutup **loop toko**: daftar → produk & stok → beli → jualan → lihat laba → langganan → admin. Banyak API master sudah CRUD; sebagian UI masih **create-heavy**, kasir masih hardcode nominal sesi, dan laporan belum mendorong aksi.

**Phase 9 Power Pack** memperdalam modul yang sudah ada dalam **satu kuartal (~12 minggu)**. Bukan membuka fitur yang keluar MVP di PRD v1.1 §5.3.

### Keputusan terkunci

| Keputusan | Pilihan |
| --- | --- |
| Fokus | Perkuat modul existing (bukan §5.3) |
| Horizon eksekusi | 1 kuartal; Next/Later hanya lampiran |
| Rumus keuangan | Tetap mengikuti PRD v1.1 §11 (P&L, HPP moving average, snapshot COGS) |
| Role / permission | Tidak menambah role baru; pakai RBAC yang ada |
| Isolasi tenant | Tetap dari JWT `tid`; tidak dari body frontend |
| Endpoint baru | Hanya jika gap nyata; prefer perluas response existing |

---

## 2. Masalah, tujuan, dan bukan tujuan

### Masalah

1. Halaman master sering hanya menambah data; edit/nonaktif/cari kurang dipakai di UI meski API sudah ada.
2. Kasir lambat/rapuh untuk operasi harian: kas buka/tutup = 0, filter kategori & alur barcode tipis, diskon/pajak setting belum jelas di checkout.
3. Laporan & dashboard memberi angka, jarang memberi **langkah berikutnya** (mis. stok menipis → inventory).
4. List besar tanpa pagination/search seragam berisiko lambat saat data tumbuh.

### Tujuan Phase 9

1. Owner/Admin/Manager menyelesaikan kerja harian tanpa spreadsheet samping.
2. Cashier checkout lebih cepat, tahan salah input, sesi kas punya nominal & ringkasan.
3. Inventory Staff mengelola stok/pembelian dengan histori & status yang jelas.
4. Setiap modul utama punya 1–2 peningkatan tajam yang terukur di acceptance criteria.
5. Tidak ada regresi isolasi tenant, RBAC, atau konsistensi angka P&L.

### Bukan tujuan Phase 9

Semua item PRD v1.1 **§5.3**, plus:

- Akuntansi lengkap (jurnal, neraca)
- Pemesanan online, KDS, marketplace, loyalty
- Aplikasi native mobile
- Multi-outlet UI, transfer stok antar outlet
- Split payment, hold bill berbasis meja, printer thermal native
- Varian kompleks (ukuran/level sebagai dimensi produk)
- Waste % otomatis di resep, tabel konversi satuan penuh
- Menggantikan checklist produksi Phase 8 (APM, backup, matikan mock-pay) — Phase 8 tetap wajib sebelum bayar production

---

## 3. Prinsip Phase 9

1. **API dulu, UI mengejar** — manfaatkan PATCH/DELETE/list yang sudah ada sebelum menambah endpoint.
2. **Satu pekerjaan per layar** — edit/nonaktif harus jelas; jangan menambah wizard besar.
3. **Angka tidak berubah arti** — dashboard = P&L; HPP snapshot di `sale_items` tetap.
4. **Error yang bisa ditindak** — pesan stok kurang, validasi, sesi terbuka: bahasa Indonesia, kode error existing.
5. **Regresi wajib** — smoke POS + minimal 1 tes API per area Now kritis.
6. **Regresi body JSON** — pola `jsonInit(object)` (bukan double `JSON.stringify`) harus dipertahankan.

---

## 4. Metrik keberhasilan (kuartal)

| Metrik | Target |
| --- | --- |
| Master UI lengkap | Produk, kategori, supplier, customer, expense: punya alur **tambah + edit + nonaktif/hapus aman** di UI |
| Sesi kasir | Buka/tutup dengan nominal kas; setelah tutup tampil ringkasan (omzet, jumlah transaksi, selisih kas) |
| Kasir usable | Filter kategori di grid; fokus input cari + Enter menambah ke cart jika cocok barcode/nama unik |
| Setting → POS | `taxPercent` / `taxInclusive` / `allowNegativeStock` dari settings dipakai di checkout |
| Laporan actionable | Kartu stok menipis di dashboard punya tautan ke `/app/inventory` (atau filter produk) |
| Konsistensi angka | Smoke: angka dashboard periode = laporan P&L periode yang sama |
| Platform | List produk/sales/purchases/expenses/movements mendukung `limit`+`offset` atau cursor + `q` pencarian di API yang dipakai UI |
| Regresi keamanan | Suite RBAC/tenant existing tetap hijau |

---

## 5. Persona & use case Phase 9

| ID | Aktor | Use case | Prioritas Now |
| --- | --- | --- | --- |
| P9-UC01 | Cashier | Buka sesi dengan uang modal; tutup dengan hitung kas; lihat selisih | P0 |
| P9-UC02 | Cashier | Cari/barcode, filter kategori, checkout dengan diskon/pajak, preview struk print | P0 |
| P9-UC03 | Inventory / Admin | Edit produk, BOM RECIPE, barcode, min stock, nonaktif | P0 |
| P9-UC04 | Inventory | Lihat movement terfilter; adjust WASTE wajib catatan; pantau di bawah min | P0 |
| P9-UC05 | Inventory | Kelola pembelian draft → terima → detail; batalkan draft | P0 |
| P9-UC06 | Admin | Edit/nonaktif supplier & customer; cari nama | P1 |
| P9-UC07 | Manager / Cashier | List penjualan, detail struk, batal dengan alasan (izin) | P0 |
| P9-UC08 | Owner / Admin | Edit/hapus biaya; filter periode; kelola kategori biaya di UI | P1 |
| P9-UC09 | Owner | Dashboard banding periode + export laporan dari UI | P1 |
| P9-UC10 | Owner | Lihat status langganan & riwayat pembayaran jelas | P2 |
| P9-UC11 | Super Admin | Filter tenant; audit log ringkas terbaca | P2 |
| P9-UC12 | Semua | Empty/error state konsisten; list panjang tetap responsif | P1 |

---

## 6. Ruang lingkup Now — kebutuhan fungsional

Tiap area: persona, perilaku, acceptance, dampak teknis, out-of-scope lokal.

### 6.1 POS / Kasir — P0

**Persona:** Cashier, Owner (pantau sesi)

**Perilaku**

- Form **buka sesi**: input `openingCash` (≥ 0), default bisa 0 tapi tidak hardcode diam-diam tanpa input.
- Form **tutup sesi**: input `closingCash` (≥ 0); response/UI menampilkan ringkasan: total penjualan sesi, jumlah transaksi (exclude canceled jika sudah jadi aturan existing), `expectedCash` (opening + cash sales − cash refunds jika ada), `cashDifference` = closing − expected.
- Grid produk: filter **kategori** + query nama/barcode.
- Input pencarian: autofocus; **Enter** menambah item jika tepat satu hasil cocok barcode atau nama.
- Checkout mengirim `discountAmount` sesuai UI; pajak dihitung dari settings tenant (`taxPercent`, `taxInclusive`) konsisten dengan service sales.
- Setelah sukses: preview struk (browser print); toast jelas untuk `STOCK_INSUFFICIENT` dan validasi.
- Blok checkout jika tidak ada sesi OPEN.

**Acceptance**

- [ ] Tidak ada hardcode `openingCash: 0` / `closingCash: 0` tanpa kontrol UI.
- [ ] Tutup sesi menampilkan selisih kas.
- [ ] Filter kategori mengubah daftar produk yang tampil.
- [ ] Enter pada barcode unik menambah qty di cart.
- [ ] Print preview struk memuat nama toko, item, total, metode bayar, footer settings jika ada.

**API / UI**

- UI: `apps/web/app/(dashboard)/app/cashier/page.tsx`
- API: perluas `POST cashier-sessions/:id/close` response (ringkasan) dan/atau `GET cashier-sessions/current` menyertakan agregat sesi berjalan.
- Field opsional body close: `closingNotes` (string pendek) jika berguna untuk audit.

**Out-of-scope lokal:** hold bill meja, split payment, printer thermal SDK, multi metode bayar satu struk.

---

### 6.2 Produk & kategori — P0

**Persona:** Administrator, Inventory Staff, Manager

**Perilaku**

- List produk: cari, filter `productType` & kategori, status aktif.
- Detail/edit: nama, tipe, unit, harga jual/beli, barcode, `minStock`, kategori, `isActive` / soft-delete sesuai pola existing.
- RECIPE: editor BOM (tambah/ubah/hapus bahan + qty) lewat `PUT /products/:id/recipe`; validasi minimal 1 bahan sebelum bisa dijual (aturan existing dipertahankan).
- Foto: unggah ke Supabase Storage **atau** URL gambar tervalidasi (pilih satu jalur utama di implementasi; dokumenkan di plan teknis). Skema `ProductImage` / `imageUrl` existing dipakai.
- Kategori: edit nama, hapus/nonaktif aman jika tidak dipakai atau dengan aturan yang jelas.

**Acceptance**

- [ ] User dengan `product.manage` bisa edit dan nonaktifkan produk dari UI.
- [ ] BOM RECIPE bisa diubah tanpa recreate produk.
- [ ] Barcode unik per tenant; duplikat ditolak dengan pesan jelas.
- [ ] `minStock` bisa di-set dan dipakai peringatan stok (lihat 6.3).

**API / UI**

- API sudah: categories/products PATCH/DELETE, recipe PUT — **wajib diekspose di UI**.
- UI: `apps/web/app/(dashboard)/app/products/page.tsx` (perluasan besar).

**Out-of-scope lokal:** varian dimensi, konversi satuan antar unit.

---

### 6.3 Stok / inventory — P0

**Persona:** Inventory Staff, Manager

**Perilaku**

- Halaman movement: filter rentang tanggal + produk; pagination.
- Adjust: tipe ADJUSTMENT / WASTE / INITIAL_STOCK; untuk **WASTE**, `notes` wajib.
- Daftar/peringatan produk SIMPLE/INGREDIENT dengan `onHand <= minStock` (dan `minStock > 0`).
- Hormati `allowNegativeStock` dari settings saat adjust/sales (perilaku existing).

**Acceptance**

- [ ] Filter movement mengubah hasil list.
- [ ] Submit WASTE tanpa catatan ditolak (UI + API).
- [ ] Produk di bawah min terlihat di inventory dan/atau dashboard.

**API / UI**

- `GET /inventory/movements` — query `from`, `to`, `productId`, `limit`, `offset`.
- `POST /inventory/adjust` — enforce notes untuk WASTE.
- Field `minStock` sudah ada di skema Product — pastikan PATCH produk & response list mengirimkannya.
- UI: `apps/web/app/(dashboard)/app/inventory/page.tsx`

**Out-of-scope lokal:** transfer antar outlet, stock opname multi-langkah kompleks.

---

### 6.4 Pembelian — P0

**Persona:** Inventory Staff

**Perilaku**

- List pembelian dengan status (draft / received / canceled jika ditambah).
- Detail: header + baris item, total.
- Aksi **terima** (`POST /purchases/:id/receive`) dari UI untuk draft.
- **Batalkan draft** (endpoint baru `POST /purchases/:id/cancel` atau DELETE draft-only) — hanya status draft; tidak mengembalikan stok karena belum receive.
- Create tetap: supplier, invoice, tanggal, baris produk/qty/cost.

**Acceptance**

- [ ] User melihat daftar dan membuka detail.
- [ ] Receive menaikkan stok + movement + moving average (perilaku Phase 3).
- [ ] Draft bisa dibatalkan; received tidak bisa di-cancel lewat alur draft.

**API / UI**

- Existing: GET list/detail, POST create, POST receive.
- Baru jika perlu: cancel draft.
- UI: `apps/web/app/(dashboard)/app/purchases/page.tsx`

**Out-of-scope lokal:** partial receive multi-wave, retur pembelian penuh ke supplier (boleh Next).

---

### 6.5 Mitra (supplier & customer) — P1

**Persona:** Administrator, Cashier (pilih customer)

**Perilaku**

- List + cari nama/telepon.
- Edit nama, telepon, catatan singkat; nonaktif/soft-delete.
- Kasir: pilih customer opsional dari daftar aktif (jika belum).

**Acceptance**

- [ ] Edit & nonaktif tersedia di UI customers & suppliers.
- [ ] Pencarian mempersempit list.

**API / UI**

- API PATCH/DELETE sudah ada di `partners`.
- UI: `named-list-page` diperluas atau halaman khusus edit.

**Out-of-scope lokal:** kredit limit, piutang aging lengkap.

---

### 6.6 Penjualan (riwayat) — P0

**Persona:** Manager, Cashier, Owner

**Perilaku**

- List sales: filter tanggal, status; pagination.
- Detail struk: item, diskon, pajak, bayar, kasir, sesi.
- Batal penjualan: alasan wajib; permission existing; kembalikan stok sesuai aturan cancel Phase 4.

**Acceptance**

- [ ] Detail struk bisa dibuka dari list.
- [ ] Cancel dengan alasan tercatat (audit jika sudah ada hook).
- [ ] Filter tanggal bekerja.

**API / UI**

- API: GET sales, GET sales/:id, POST cancel — ekspose penuh di UI.
- UI: `apps/web/app/(dashboard)/app/sales/page.tsx`

**Out-of-scope lokal:** edit struk setelah bayar (hanya cancel + jual ulang).

---

### 6.7 Biaya operasional — P1

**Persona:** Owner, Administrator, Manager

**Perilaku**

- List + filter periode + kategori.
- Edit & hapus expense (API PATCH/DELETE sudah ada).
- Kelola kategori biaya di UI (minimal list + create; edit nama jika endpoint ada atau ditambah tipis).

**Acceptance**

- [ ] Edit/hapus dari UI berhasil dan tercermin di laporan expense/P&L.
- [ ] Filter periode membatasi list.

**API / UI**

- `expenses` + `expense-categories`
- UI: `apps/web/app/(dashboard)/app/expenses/page.tsx`

**Out-of-scope lokal:** approval workflow multi-level.

---

### 6.8 Dashboard & laporan — P1

**Persona:** Owner, Manager

**Perilaku**

- Kartu existing tetap; tambah **banding periode sebelumnya** (atau % change) untuk penjualan & laba bersih jika data tersedia.
- Kartu **stok menipis** klikable → inventory (atau deep link query).
- Tombol export CSV/PDF di halaman reports memakai `GET /reports/:type/export`.
- Dokumen uji: angka dashboard = P&L untuk rentang sama (rumus §11 v1.1).

**Acceptance**

- [ ] Export dari UI mengunduh file.
- [ ] Link stok menipis mengarah ke tindakan.
- [ ] Tes/smoke konsistensi angka terdokumentasi dan lulus.

**API / UI**

- `reports` / `dashboard`
- UI: `app/page.tsx`, `app/reports/page.tsx`

**Out-of-scope lokal:** BI drag-drop, custom report builder.

---

### 6.9 Users, settings, profil — P1

**Persona:** Owner, Administrator, semua user (profil)

**Perilaku**

- Users: nonaktifkan user (soft) tanpa hapus hard jika memungkinkan; validasi form jelas.
- Settings: `taxPercent`, `taxInclusive`, `allowNegativeStock`, `receiptFooter` tersimpan dan **dibaca kasir**.
- Profil & ganti password: polish pesan error validasi.

**Acceptance**

- [ ] Ubah pajak di settings mengubah perhitungan di transaksi baru.
- [ ] User nonaktif tidak bisa login (atau ditolak di auth) sesuai aturan yang dipilih dan diuji.

**API / UI**

- `users`, `settings`, `me`
- Jangan tambah role baru.

---

### 6.10 Billing & Super Admin — P2

**Persona:** Owner; Super Admin Kranjang

**Perilaku**

- Subscription UI: status, trial end, paket, riwayat pembayaran (dari data billing existing) dengan copy bahasa jelas.
- `mock-pay` tetap **hanya development** (`ALLOW_MOCK_PAY`); production wajib Midtrans webhook.
- Admin: filter/cari tenant; audit log tampil ringkas (aktor, aksi, waktu).

**Acceptance**

- [ ] Owner paham status langganan tanpa jargon internal mentah.
- [ ] Admin bisa temukan tenant dan lihat audit tanpa export manual DB.

**Out-of-scope lokal:** portal self-serve invoice PDF pajak formal, SSO admin.

---

### 6.11 Platform & kualitas — P1

**Perilaku**

- Pagination + search pada list yang dipakai UI berukuran besar.
- Empty state & error toast konsisten (bahasa Indonesia).
- Soft-delete master: list default mengecualikan `deletedAt != null` di mana kolom sudah ada.
- Pertahankan perbaikan `jsonInit` (satu kali serialize).

**Acceptance**

- [ ] List produk ≥ 50 item tetap usable (pagination atau virtualisasi ringan).
- [ ] Soft-deleted tidak muncul di picker kasir.

---

## 7. Lampiran Next / Later (bukan komitmen kuartal)

### Next (setelah Phase 9 atau overflow)

- Hold **cart** dalam sesi kasir yang sama (bukan hold bill meja)
- Shortcut keyboard kasir (F-keys / qty cepat)
- Alert stok menipis via email (Resend)
- Margin / target margin per produk di laporan
- Template struk footer lebih kaya (logo kecil, QR info toko)
- Retur pembelian sebagian
- Partial receive PO

**Wave 1 (eksekusi):** [docs/superpowers/plans/2026-08-20-kranjang-next-wave-1.md](../superpowers/plans/2026-08-20-kranjang-next-wave-1.md) — shortcut + hold cart + target margin.

**Wave 2 (eksekusi):** [docs/superpowers/plans/2026-08-20-kranjang-next-wave-2.md](../superpowers/plans/2026-08-20-kranjang-next-wave-2.md) — alert stok email + footer struk logo/QR.

**Wave 3 (eksekusi):** [docs/superpowers/plans/2026-08-20-kranjang-next-wave-3.md](../superpowers/plans/2026-08-20-kranjang-next-wave-3.md) — Phase 8 production gate (mock-pay off, Midtrans Snap, Sentry, SA harden).

**Path to Perfect (Jalur B):** [docs/superpowers/plans/2026-08-21-kranjang-path-perfect.md](../superpowers/plans/2026-08-21-kranjang-path-perfect.md) — Wave 4 seed-demo + cron alert; Wave 5–10 Later §5.3.

### Later / tetap di luar (PRD v1.1 §5.3)

- Multi-outlet UI + transfer stok
- Meja / dine-in / hold bill per meja
- Split payment, printer thermal native
- Varian kompleks, waste % otomatis, konversi satuan penuh
- Native mobile app, marketplace, loyalty

---

## 8. Delta data (ERD singkat)

Tidak menulis ulang `erd.md`. Perubahan Phase 9 yang diizinkan:

| Item | Status | Catatan |
| --- | --- | --- |
| `Product.minStock` | Sudah ada | Pastikan API/UI expose |
| `Product.barcode`, `deletedAt` | Sudah ada | Enforce di list/picker |
| `CashierSession` ringkasan close | Response/aggregasi | Boleh computed; kolom persist opsional |
| `closingNotes` pada close session | Opsional baru | VARCHAR pendek jika diimplementasi |
| `Purchase` cancel draft | Status/flag | Hanya draft |
| `Sale` cancel reason | Pastikan tersimpan | Jika belum ada kolom, tambah `cancelReason` |
| Soft-delete mitra/kategori/produk | Kolom banyak yang sudah ada | Konsistensi query |

Migrasi hanya jika kolom benar-benar belum ada; prefer computed aggregates.

---

## 9. API — arah kontrak Phase 9

Prefix tetap `/api/v1`. Permission codes existing.

| Area | Perubahan arah |
| --- | --- |
| Cashier close | Response + ringkasan sesi; body `closingCash` (+ notes opsional) |
| Cashier current | Sertakan totals berjalan jika murah dihitung |
| Products/categories | Query `q`, `categoryId`, `productType`, `isActive`, pagination |
| Inventory movements | Query `from`, `to`, `productId`, pagination; WASTE notes required |
| Purchases | Cancel draft; list filter status |
| Sales | List filter tanggal/status; cancel body `{ reason }` |
| Expenses | List filter tanggal/kategori; UI pakai PATCH/DELETE |
| Reports/dashboard | Period comparison fields opsional; export sudah ada |
| Partners | Query `q`; UI pakai PATCH/DELETE |
| Billing current | Sertakan payment history ringkas jika belum |

Validasi tetap Zod di Nest; error code existing (`STOCK_INSUFFICIENT`, `VALIDATION_ERROR`, `SUBSCRIPTION_INACTIVE`, …).

---

## 10. Non-fungsional

| Aspek | Target Phase 9 |
| --- | --- |
| Performa kasir | Interaksi cart/checkout terasa < 300 ms di data tipikal toko kecil (excl. jaringan) |
| List API | Default limit masuk akal (mis. 50); max cap (mis. 100) |
| Keamanan | Tidak longgarkan isolasi tenant; Phase 8 checklist tetap pra-production |
| Observability | Tidak wajib APM penuh di P9; log error API tetap |
| Aksesibilitas dasar | Fokus keyboard di input cari kasir; kontras tombol mengikuti desain existing |
| i18n | UI Indonesia saja |

---

## 11. Keamanan & compliance (batasan)

- Phase 9 **tidak** menutup item unchecked Phase 8: RLS opsional, APM, backup/PITR, ganti password SA default, `ALLOW_MOCK_PAY=false` di production.
- Audit: aksi batal sale, terima PO, adjust WASTE, ubah harga — tulis audit jika infrastruktur Phase 7 sudah ada.
- Upload gambar: validasi tipe/ukuran; path storage per `tenant_id`.

---

## 12. Roadmap eksekusi 12 minggu

| Blok | Minggu | Isi | DoD blok |
| --- | --- | --- | --- |
| A | 1–4 | Kasir sesi+ringkasan+filter/barcode; produk/kategori edit+BOM+minStock; stok movement filter + WASTE notes | P9-UC01–04 hijau di staging |
| B | 5–8 | Pembelian detail/receive/cancel draft; sales list/detail/cancel; mitra edit/cari; expense edit/filter | P9-UC05–08 |
| C | 9–12 | Dashboard actionable + export UI; settings→POS; users soft-disable; billing/admin polish P2; pagination/empty states; regresi full | Metrik §4; smoke + API kritis hijau |

Overflow masuk lampiran **Next**, bukan diam-diam menambah §5.3.

---

## 13. Rencana tes

| Jenis | Isi |
| --- | --- |
| API | Per area P0: open/close session summary; product patch+recipe; adjust WASTE validation; purchase receive+cancel draft; sale cancel+stock restore |
| Web | Perluas smoke kasir (buka sesi nominal, tambah item, bayar); cek tidak double-JSON body |
| Regresi | Auth/RBAC/tenant suite existing; dashboard vs P&L assertion |
| Manual | Checklist print struk browser; filter kategori; link stok menipis |

---

## 14. Risiko

| Risiko | Mitigasi |
| --- | --- |
| Scope creep ke §5.3 | Tolak; catat di Next/Later |
| UI besar di products/cashier | Pecah PR per blok minggu; jangan rewrite design system |
| Ringkasan kas salah rumus | Dokumentasikan expectedCash di PRD teknis implementasi; tes unit |
| Foto Storage belum siap env | Fallback URL tervalidasi dulu |
| Soft-delete tidak konsisten | Audit query list di blok C |
| Mengabaikan Phase 8 prod | PRD ini menyebut eksplisit: P8 tetap gerbang production bayar |

---

## 15. Asumsi

1. Satu tenant = satu outlet aktif tetap (kolom `outlet_id` ada, UI multi-outlet tidak).
2. Permission codes di `@kranjang/shared` cukup; mapping role tidak dirombak.
3. Midtrans live dan matikan mock-pay adalah urusan ops/Phase 8, bukan fitur Power Pack.
4. Browser print cukup untuk struk Phase 9.
5. Data seed/dev cukup untuk demonstrasi acceptance.

---

## 16. Deliverable dokumen & tindak lanjut

- [x] Dokumen ini: `docs/prd/kranjang-prd-phase-9-power.md`
- [x] Disetujui produk (20 Agustus 2026)
- [x] Implementation plan Blok A: [docs/superpowers/plans/2026-08-20-kranjang-phase-9-block-a.md](../superpowers/plans/2026-08-20-kranjang-phase-9-block-a.md)
- [x] Implementation plan Blok B: [docs/superpowers/plans/2026-08-20-kranjang-phase-9-block-b.md](../superpowers/plans/2026-08-20-kranjang-phase-9-block-b.md)
- [x] Implementation plan Blok C: [docs/superpowers/plans/2026-08-20-kranjang-phase-9-block-c.md](../superpowers/plans/2026-08-20-kranjang-phase-9-block-c.md)
- [x] Next Wave 1 plan: [docs/superpowers/plans/2026-08-20-kranjang-next-wave-1.md](../superpowers/plans/2026-08-20-kranjang-next-wave-1.md)
- [x] Next Wave 2 plan: [docs/superpowers/plans/2026-08-20-kranjang-next-wave-2.md](../superpowers/plans/2026-08-20-kranjang-next-wave-2.md)
- [x] Next Wave 3 plan: [docs/superpowers/plans/2026-08-20-kranjang-next-wave-3.md](../superpowers/plans/2026-08-20-kranjang-next-wave-3.md)
- [x] Path to Perfect (Jalur B) Wave 4+: [docs/superpowers/plans/2026-08-21-kranjang-path-perfect.md](../superpowers/plans/2026-08-21-kranjang-path-perfect.md)
- [x] Update pointer roadmap di [kranjang-prd.md](./kranjang-prd.md) §18.

---

## 17. Definisi selesai Phase 9 (produk)

Phase 9 selesai jika:

1. Semua acceptance **P0** tercentang di staging.
2. Minimal 80% acceptance **P1** tercentang; sisa masuk Next dengan alasan.
3. **P2** billing/admin: polished cukup untuk demo Owner/SA tanpa blocker.
4. Suite tes regresi + smoke POS lulus.
5. Tidak ada fitur §5.3 yang ikut ter-ship “selundupan”.
