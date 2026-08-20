"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { href: "/", label: "Beranda" },
  { href: "/harga", label: "Harga" },
];

const navLinkClass =
  "rounded-full px-3.5 py-2 text-sm text-[#212121] transition-colors hover:bg-[#eeece7] hover:text-[#17171c]";

export function SiteHeader() {
  return (
    <header className="border-b border-[#e5e7eb] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 lg:px-8">
        <BrandLogo href="/" size="sm" priority />

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="outline">
            <Link href="/login">Masuk</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Daftar</Link>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="max-w-xs">
            <SheetHeader>
              <SheetTitle className="sr-only">Kranjang</SheetTitle>
              <BrandLogo href="/" size="sm" />
              <SheetDescription>Navigasi marketing Kranjang.</SheetDescription>
            </SheetHeader>
            <div className="mt-8 flex flex-col gap-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-[#e5e7eb] px-4 py-3 text-sm text-[#212121] transition-colors hover:border-transparent hover:bg-[#eeece7] hover:text-[#17171c]"
                >
                  {link.label}
                </Link>
              ))}
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Masuk</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/register">Daftar</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
