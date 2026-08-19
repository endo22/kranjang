import Link from "next/link";

import { PlanCards } from "@/components/marketing/plan-cards";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const placeholders = ["Warung", "Kedai", "Rumah makan", "Usaha rumahan"];

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-white text-[#212121]">
      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:py-24">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-[#ff7759]/30 px-4 py-2 text-sm text-[#ff7759]">
              Landing marketing Kranjang
            </div>
            <div className="space-y-5">
              <h1 className="font-display text-5xl leading-none tracking-[-0.04em] text-[#17171c] sm:text-6xl lg:text-8xl">
                Jaga operasional warung tetap rapi dari stok sampai resep.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#616161]">
                Kranjang membantu pemilik warung dan rumah makan mencatat penjualan, memantau inventaris, dan
                memahami HPP tanpa spreadsheet yang berantakan.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/register">Daftar</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/login">Masuk</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-5">
            <Card className="border-none bg-[#eeece7]">
              <CardContent className="space-y-6 p-8">
                <div className="space-y-2">
                  <p className="text-sm text-[#75758a]">Catatan harian</p>
                  <h2 className="font-display text-3xl tracking-[-0.03em] text-[#17171c]">Semua alur kasir dan stok terasa lebih tenang.</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/70 bg-white/70 p-5">
                    <p className="text-sm text-[#75758a]">Pantau inventaris</p>
                    <p className="mt-3 text-base leading-7 text-[#212121]">
                      Simpan daftar bahan dan barang agar pencatatan keluar masuk lebih mudah dibaca.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/70 bg-white/70 p-5">
                    <p className="text-sm text-[#75758a]">Penjualan harian</p>
                    <p className="mt-3 text-base leading-7 text-[#212121]">
                      Ringkas transaksi harian dalam tampilan yang ringan dan fokus pada operasional.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-[#eeece7]">
              <CardContent className="space-y-4 p-8">
                <p className="text-sm text-[#75758a]">Resep dan HPP</p>
                <p className="text-base leading-7 text-[#212121]">
                  Atur resep dan biaya bahan baku dengan struktur yang mudah diikuti tim, tanpa data dashboard fiktif.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
          <p className="text-center text-sm text-[#616161]">Dipakai pemilik warung dan rumah makan</p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-center text-sm text-[#212121] sm:grid-cols-4">
            {placeholders.map((placeholder) => (
              <div key={placeholder} className="rounded-full border border-[#e5e7eb] px-4 py-3">
                {placeholder}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
          <div className="rounded-[22px] bg-[#003c33] px-8 py-10 text-white lg:px-12 lg:py-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.2em] text-white/70">HPP dan resep</p>
                <h2 className="font-display text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">
                  Pahami biaya menu tanpa memisahkan catatan resep dari operasional.
                </h2>
              </div>
              <div className="space-y-4 text-base leading-7 text-white/80">
                <p>Kumpulkan bahan, resep, dan perhitungan HPP di satu alur yang lebih mudah dijelaskan ke tim.</p>
                <p>Ketika menu berubah, pembaruan catatan tetap dekat dengan aktivitas harian usaha.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-[#75758a]">Paket berlangganan</p>
              <h2 className="font-display text-4xl tracking-[-0.03em] text-[#17171c] sm:text-5xl">Pilih paket yang sesuai dengan ritme usaha.</h2>
            </div>
            <Button asChild variant="secondary">
              <Link href="/harga">Lihat halaman harga</Link>
            </Button>
          </div>
          <PlanCards />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
