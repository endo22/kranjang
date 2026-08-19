import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-[#17171c] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-xl space-y-3">
          <p className="font-display text-3xl">Kranjang</p>
          <p className="text-sm leading-6 text-white/75">
            Bantu warung dan rumah makan menjaga resep, HPP, dan operasional harian tetap rapi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm text-white/75">
          <Link href="/">Beranda</Link>
          <Link href="/harga">Harga</Link>
          <Link href="/login">Masuk</Link>
          <Link href="/register">Daftar</Link>
        </div>
      </div>
    </footer>
  );
}
