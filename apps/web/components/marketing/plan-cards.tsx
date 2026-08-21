import * as React from "react";
import Link from "next/link";
import { PLAN_CARDS } from "@kranjang/shared";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const planNotes: Record<string, { summary: string; points: string[] }> = {
  basic: {
    summary: "Untuk usaha yang baru mulai merapikan penjualan harian.",
    points: ["1 outlet", "Laporan penjualan", "Pantau inventaris"],
  },
  business: {
    summary: "Untuk operasional yang butuh ekspor data rutin tiap bulan.",
    points: ["1 outlet", "Laporan penjualan", "Ekspor data"],
  },
  pro: {
    summary: "Untuk tim yang ingin pencatatan lebih siap dipakai bertumbuh.",
    points: ["1 outlet", "Laporan penjualan", "Ekspor data"],
  },
};

function formatIdr(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
}

export function PlanCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PLAN_CARDS.map((plan) => {
        const details = planNotes[plan.code];

        return (
          <Card key={plan.code} className="h-full border-[#f2f2f2]">
            <CardHeader className="gap-4">
              <div className="inline-flex w-fit rounded-full border border-[#ff7759]/30 px-3 py-1 text-xs text-[#ff7759]">
                {plan.name}
              </div>
              <div className="space-y-2">
                <CardTitle className="font-display text-4xl">{plan.name}</CardTitle>
                <CardDescription>{details.summary}</CardDescription>
              </div>
              <div>
                <p className="font-display text-5xl text-[#17171c]">{formatIdr(plan.priceMonthly)}</p>
                <p className="mt-2 text-sm text-[#616161]">per 30 hari</p>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-6 text-[#212121]">
                {details.points.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-[#003c33]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/register">Daftar</Link>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
