import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="bg-[#17171c] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex overflow-hidden rounded-2xl bg-white p-1">
            <BrandLogo href="/" size="md" />
          </div>
          <p className="text-sm leading-6 text-white/75">
            Bantu toko menjaga stok, HPP, dan operasional harian tetap rapi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/" className="rounded-full px-3.5 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
            Beranda
          </Link>
          <Link href="/harga" className="rounded-full px-3.5 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
            Harga
          </Link>
          <Link href="/login" className="rounded-full px-3.5 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
            Masuk
          </Link>
          <Link href="/register" className="rounded-full px-3.5 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
            Daftar
          </Link>
        </div>
      </div>
    </footer>
  );
}
