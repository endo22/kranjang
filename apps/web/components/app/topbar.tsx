"use client";

import { LogOut, Menu, UserCircle2 } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppTopbarProps = {
  tenantName: string;
  userName: string;
  userEmail: string;
  onOpenSidebar: () => void;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

export function AppTopbar({
  tenantName,
  userName,
  userEmail,
  onOpenSidebar,
  onLogout,
  isLoggingOut,
}: AppTopbarProps) {
  return (
    <header className="flex items-center justify-between gap-4 rounded-[28px] border border-[#e5e7eb] bg-white px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Buka navigasi</span>
        </Button>

        <div className="min-w-0">
          <p className="truncate text-sm text-[#616161]">Tenant aktif</p>
          <h1 className="truncate text-lg font-medium text-[#17171c]">{tenantName}</h1>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 rounded-full border border-[#e5e7eb] px-2 py-1.5 text-left transition-colors hover:bg-[#17171c]/5"
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getInitials(userName) || "KR"}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium text-[#17171c]">{userName}</p>
              <p className="truncate text-xs text-[#75758a]">{userEmail}</p>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-[#17171c]">{userName}</p>
            <p className="truncate text-xs text-[#75758a]">{userEmail}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/app/profile" className="cursor-pointer">
              <UserCircle2 className="mr-2 h-4 w-4" />
              Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void onLogout();
            }}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
