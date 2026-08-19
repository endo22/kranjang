"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  const trialEnd = new Date(session.tenant.trialEndDate).getTime();
  const trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / 86400000));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>Ringkasan singkat tenant aktif untuk mulai bekerja di Kranjang.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] bg-[#17171c] p-5 text-white">
              <p className="text-sm text-white/70">Sisa masa trial</p>
              <p className="mt-2 text-4xl font-medium">{trialDaysRemaining} hari</p>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Trial berakhir pada {formatDate(session.tenant.trialEndDate)}.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#ececf1] p-5">
              <p className="text-sm text-[#616161]">Status langganan</p>
              <p className="mt-2 text-2xl font-medium text-[#17171c]">{session.tenant.subscriptionStatus}</p>
              <p className="mt-3 text-sm leading-6 text-[#616161]">
                Anda login sebagai {session.user.role}. Menu aktif disesuaikan dengan permission pengguna.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant</CardTitle>
            <CardDescription>Informasi dasar tenant yang sedang Anda gunakan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#616161]">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#9a9aa5]">Nama usaha</p>
              <p className="mt-1 text-base font-medium text-[#17171c]">{session.tenant.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#9a9aa5]">Pengguna aktif</p>
              <p className="mt-1 text-base font-medium text-[#17171c]">{session.user.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#9a9aa5]">Email</p>
              <p className="mt-1 text-base font-medium text-[#17171c]">{session.user.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Belum ada data operasional</CardTitle>
          <CardDescription>Modul inti POS belum dibuka pada fase ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[24px] border border-dashed border-[#d9d9dd] bg-[#fcfcfd] p-8">
            <p className="text-base leading-7 text-[#616161]">
              Isi produk dan resep di tahap berikutnya, lalu jual di kasir.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
