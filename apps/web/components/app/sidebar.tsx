"use client";

import Link from "next/link";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    <TooltipProvider delayDuration={120}>
      <aside className={cn("flex h-full flex-col rounded-[28px] border border-[#e5e7eb] bg-white p-5", className)}>
        <div className="mb-6">
          <Link href="/app" className="font-display text-2xl text-[#17171c]" onClick={onNavigate}>
            Kranjang
          </Link>
          <p className="mt-2 text-sm leading-6 text-[#616161]">Panel operasional untuk tenant Kranjang.</p>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          {items.map((item) => {
            if (item.kind === "soon") {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-[#9a9aa5]"
                    >
                      <span>{item.label}</span>
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-medium text-[#75758a]">
                        Segera
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Segera</TooltipContent>
                </Tooltip>
              );
            }

            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm transition-colors",
                  active ? "bg-[#17171c] text-white" : "text-[#212121] hover:bg-[#17171c]/5",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
