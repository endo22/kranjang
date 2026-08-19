"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app/sidebar";
import { AppTopbar } from "@/components/app/topbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";

const GUARDED_ROUTES = [
  {
    prefix: "/app/users",
    permission: "user.manage",
  },
  {
    prefix: "/app/settings",
    permission: "settings.manage",
  },
] as const;

function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] p-4 sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <div className="hidden h-[calc(100vh-3rem)] animate-pulse rounded-[28px] bg-white lg:block" />
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-[28px] bg-white" />
          <div className="h-24 animate-pulse rounded-[28px] bg-white" />
          <div className="h-[420px] animate-pulse rounded-[28px] bg-white" />
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, status, logout } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const requiredPermission = useMemo(() => {
    return GUARDED_ROUTES.find((route) => pathname.startsWith(route.prefix))?.permission ?? null;
  }, [pathname]);

  useEffect(() => {
    if (status === "ready" && !session) {
      router.replace("/login");
    }
  }, [router, session, status]);

  useEffect(() => {
    if (!session || !requiredPermission || pathname === "/app/forbidden") {
      return;
    }

    if (!session.user.permissions.includes(requiredPermission)) {
      router.replace("/app/forbidden");
    }
  }, [pathname, requiredPermission, router, session]);

  if (status === "loading") {
    return <ShellSkeleton />;
  }

  if (!session) {
    return <ShellSkeleton />;
  }

  if (requiredPermission && !session.user.permissions.includes(requiredPermission) && pathname !== "/app/forbidden") {
    return <ShellSkeleton />;
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal keluar dari sesi.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] p-4 sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <div className="sticky top-6 h-[calc(100vh-3rem)]">
            <AppSidebar pathname={pathname} permissions={session.user.permissions} />
          </div>
        </div>

        <div className="space-y-4">
          <AppTopbar
            tenantName={session.tenant.name}
            userName={session.user.name}
            userEmail={session.user.email}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
          />

          {!session.user.emailVerifiedAt ? (
            <div className="rounded-[24px] border border-[#f0d9a7] bg-[#fff8e8] px-5 py-4 text-sm leading-6 text-[#8b5e15]">
              Verifikasi email Anda. Cek log server untuk tautan (mode pengembangan).
            </div>
          ) : null}

          <main>{children}</main>
        </div>
      </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm border-r border-[#e5e7eb] bg-[#f7f7f8] p-4">
          <AppSidebar
            pathname={pathname}
            permissions={session.user.permissions}
            onNavigate={() => setMobileSidebarOpen(false)}
            className="h-full"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
