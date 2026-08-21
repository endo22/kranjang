import { PlanCards } from "@/components/marketing/plan-cards";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function HargaPage() {
  return (
    <div className="min-h-screen bg-white text-[#212121]">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex rounded-full border border-[#ff7759]/30 px-4 py-2 text-sm text-[#ff7759]">
            Harga Kranjang
          </div>
          <h1 className="font-display text-5xl leading-none tracking-[-0.04em] text-[#17171c] sm:text-6xl lg:text-7xl">
            Paket yang sama dengan beranda, dalam halaman harga khusus.
          </h1>
          <p className="text-lg leading-8 text-[#616161]">
            Halaman ini berdiri sendiri dan menampilkan Basic, Business, dan Pro tanpa redirect maupun panggilan paket
            dari API.
          </p>
        </div>

        <section className="mt-14">
          <PlanCards />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
