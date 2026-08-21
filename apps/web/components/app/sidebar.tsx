"use client";

import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/app", label: "Dashboard", kind: "live" as const },
  { href: "/app/cashier", label: "Kasir", kind: "perm" as const, permission: "sales.create" },
  { href: "/app/products", label: "Produk", kind: "perm" as const, permission: "product.view" },
  { href: "/app/inventory", label: "Inventory", kind: "perm" as const, permission: "inventory.view" },
  { href: "/app/purchases", label: "Pembelian", kind: "perm" as const, permission: "purchase.view" },
  { href: "/app/sales", label: "Penjualan", kind: "perm" as const, permission: "sales.view" },
  { href: "/app/customers", label: "Pelanggan", kind: "perm" as const, permission: "sales.view" },
  { href: "/app/suppliers", label: "Supplier", kind: "perm" as const, permission: "purchase.view" },
  { href: "/app/expenses", label: "Biaya", kind: "perm" as const, permission: "expense.view" },
  { href: "/app/reports", label: "Laporan", kind: "perm" as const, permission: "report.view" },
  { href: "/app/users", label: "User & Role", kind: "perm" as const, permission: "user.manage" },
  { href: "/app/settings", label: "Pengaturan", kind: "perm" as const, permission: "settings.manage" },
  { href: "/app/outlets", label: "Outlet", kind: "perm" as const, permission: "settings.manage" },
  { href: "/app/subscription", label: "Subscription", kind: "perm" as const, permission: "subscription.manage" },
];

type AppSidebarProps = {
  pathname: string;
  permissions: string[];
  onNavigate?: () => void;
  className?: string;
};

function canSeeItem(item: (typeof NAV)[number], permissions: string[]) {
  if (item.kind !== "perm") {
    return true;
  }

  return permissions.includes(item.permission);
}

function isActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ pathname, permissions, onNavigate, className }: AppSidebarProps) {
  const items = NAV.filter((item) => canSeeItem(item, permissions));

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-[#e5e7eb] bg-white p-5",
        className,
      )}
    >
      <div className="mb-5 shrink-0">
        <BrandLogo href="/app" size="md" className="max-w-full" onClick={onNavigate} />
        <p className="mt-2 text-sm leading-6 text-[#616161]">Panel operasional untuk tenant Kranjang.</p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pe-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "shrink-0 rounded-2xl px-4 py-2.5 text-[0.875rem] transition-colors",
                active ? "bg-[#17171c] !text-[#ffffff]" : "text-[#212121] hover:bg-[#17171c]/5",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
