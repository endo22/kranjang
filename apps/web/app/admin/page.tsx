"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, setAccessToken } from "@/lib/api";

type Overview = {
  tenants: { total: number; trial: number; active: number; expired: number };
  users: number;
  businessTransactions: number;
  subscriptionRevenue: number;
  payments: { success: number; failed: number };
};

type Tenant = { id: string; name: string; subscriptionStatus: string };

export default function AdminHomePage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem("kranjang_admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAccessToken(token);
    void Promise.all([api<Overview>("/admin/overview"), api<Tenant[]>("/admin/tenants")])
      .then(([nextOverview, nextTenants]) => {
        setOverview(nextOverview);
        setTenants(nextTenants);
      })
      .catch(() => router.replace("/admin/login"));
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
        <CardContent className="space-y-2">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
              <span>{tenant.name} · {tenant.subscriptionStatus}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api(`/admin/tenants/${tenant.id}/status`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ subscriptionStatus: tenant.subscriptionStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED" }),
                  }).then(() => location.reload());
                }}
              >
                {tenant.subscriptionStatus === "SUSPENDED" ? "Aktifkan" : "Suspend"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
