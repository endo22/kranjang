"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit, setAccessToken } from "@/lib/api";

type Overview = {
  tenants: { total: number; trial: number; active: number; expired: number };
  users: number;
  businessTransactions: number;
  subscriptionRevenue: number;
  payments: { success: number; failed: number };
};

type Tenant = { id: string; name: string; subscriptionStatus: string; email?: string };
type AuditRow = {
  id: string;
  action: string;
  module: string;
  entity: string;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

export default function AdminHomePage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");

  async function load(search = query) {
    const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    const [nextOverview, nextTenants, nextAudits] = await Promise.all([
      api<Overview>("/admin/overview"),
      api<Tenant[]>(`/admin/tenants${suffix}`),
      api<AuditRow[]>("/admin/audit-logs"),
    ]);
    setOverview(nextOverview);
    setTenants(nextTenants);
    setAudits(nextAudits);
  }

  useEffect(() => {
    const token = sessionStorage.getItem("kranjang_admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAccessToken(token);
    void load("").catch(() => router.replace("/admin/login"));
  }, [router]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Super Admin</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <p>Tenant {overview?.tenants.total}</p>
          <p>Trial {overview?.tenants.trial}</p>
          <p>Aktif {overview?.tenants.active}</p>
          <p>Expired {overview?.tenants.expired}</p>
          <p>User {overview?.users}</p>
          <p>Transaksi bisnis {overview?.businessTransactions}</p>
          <p>Payment sukses {overview?.payments.success}</p>
          <p>Payment gagal {overview?.payments.failed}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void load(query).catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
            }}
          >
            <Input placeholder="Cari nama / slug / email" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Button type="submit" variant="outline">
              Cari
            </Button>
          </form>
          {tenants.map((tenant) => (
            <div key={tenant.id} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
              <span>
                {tenant.name} · {tenant.subscriptionStatus}
                {tenant.email ? ` · ${tenant.email}` : ""}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api(`/admin/tenants/${tenant.id}/status`, {
                    method: "PATCH",
                    ...jsonInit({
                      subscriptionStatus: tenant.subscriptionStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                    }),
                  })
                    .then(() => load())
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                }}
              >
                {tenant.subscriptionStatus === "SUSPENDED" ? "Aktifkan" : "Suspend"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audits.slice(0, 30).map((row) => (
            <p key={row.id} className="text-sm">
              {new Date(row.createdAt).toLocaleString("id-ID")} · {row.actor?.name ?? "sistem"} · {row.action} · {row.module}/
              {row.entity}
            </p>
          ))}
          {audits.length === 0 ? <p className="text-sm text-[#616161]">Belum ada audit.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
