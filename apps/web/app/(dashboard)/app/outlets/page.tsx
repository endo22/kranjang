"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { AppReveal, AppStagger, AppStaggerItem } from "@/components/app/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit, setActiveOutletId } from "@/lib/api";

type Outlet = { id: string; name: string; address: string | null; isDefault: boolean };

const inputFocusClass =
  "transition-[box-shadow,border-color] duration-200 focus-visible:border-[#003c33]/40 focus-visible:ring-[#003c33]/25";
const btnPressClass = "transition-transform duration-150 active:scale-[0.98]";
const cardSurfaceClass =
  "border-[#e2e6e4] bg-white transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(23,23,28,0.05)]";

const easeOut = [0.16, 1, 0.3, 1] as const;

export default function OutletsPage() {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<Outlet[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Outlet[]>("/outlets"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load().catch((error) => {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Gagal");
    });
  }, []);

  const stats = useMemo(() => {
    const withAddress = rows.filter((row) => Boolean(row.address?.trim())).length;
    const defaultOutlet = rows.find((row) => row.isDefault) ?? null;
    return { total: rows.length, withAddress, defaultName: defaultOutlet?.name ?? "—" };
  }, [rows]);

  return (
    <div className="space-y-5">
      <AppReveal className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#003c33]/70">Multi-branch</p>
          <h1 className="font-display text-2xl tracking-[-0.03em] text-[#17171c] sm:text-3xl">Outlet</h1>
          <p className="max-w-xl text-sm leading-6 text-[#616161]">
            Kelola cabang/toko. Batas jumlah mengikuti paket langganan.
          </p>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-[#003c33]/25 via-[#e2e6e4] to-transparent" />
      </AppReveal>

      <AppStagger className="grid gap-3 sm:grid-cols-3">
        <AppStaggerItem>
          <div className="rounded-2xl border border-[#e2e6e4] bg-white px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(23,23,28,0.04)]">
            <p className="text-xs font-medium text-[#616161]">Total outlet</p>
            <p className="mt-1 font-display text-2xl tabular-nums tracking-[-0.03em] text-[#17171c]">{stats.total}</p>
          </div>
        </AppStaggerItem>
        <AppStaggerItem>
          <div className="rounded-2xl border border-[#003c33]/15 bg-[#edfce9]/60 px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(0,60,51,0.06)]">
            <p className="text-xs font-medium text-[#616161]">Outlet default</p>
            <p className="mt-1 truncate font-display text-lg tracking-[-0.02em] text-[#003c33]">{stats.defaultName}</p>
          </div>
        </AppStaggerItem>
        <AppStaggerItem>
          <div className="rounded-2xl border border-[#e2e6e4] bg-white px-4 py-3 transition-shadow duration-300 hover:shadow-[0_10px_28px_rgba(23,23,28,0.04)]">
            <p className="text-xs font-medium text-[#616161]">Punya alamat</p>
            <p className="mt-1 font-display text-2xl tabular-nums tracking-[-0.03em] text-[#17171c]">
              {stats.withAddress}
            </p>
          </div>
        </AppStaggerItem>
      </AppStagger>

      <AppReveal delay={0.04}>
        <Card className={cardSurfaceClass}>
          <CardHeader>
            <CardTitle className="font-display text-xl tracking-[-0.02em]">Tambah outlet</CardTitle>
            <CardDescription>Nama wajib; alamat opsional untuk cabang fisik.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 rounded-2xl border border-[#e2e6e4] bg-[#f4f6f5] p-4 md:grid-cols-[1fr_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void api("/outlets", {
                  method: "POST",
                  ...jsonInit({ name, address: address.trim() ? address.trim() : null }),
                })
                  .then(() => {
                    setName("");
                    setAddress("");
                    toast.success("Outlet ditambahkan.");
                    return load();
                  })
                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
              }}
            >
              <Input
                placeholder="Nama outlet"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className={inputFocusClass}
              />
              <Input
                placeholder="Alamat (opsional)"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className={inputFocusClass}
              />
              <Button type="submit" className={btnPressClass}>
                Tambah outlet
              </Button>
            </form>
          </CardContent>
        </Card>
      </AppReveal>

      <AppReveal delay={0.08}>
        <Card className={cardSurfaceClass}>
          <CardHeader>
            <CardTitle className="font-display text-xl tracking-[-0.02em]">Daftar outlet</CardTitle>
            <CardDescription>
              {loading ? "Memuat…" : `${rows.length} outlet aktif. Default dipakai untuk sesi operasional.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  className="space-y-2"
                >
                  <div className="h-16 animate-pulse rounded-2xl bg-[#e8eeec]" />
                  <div className="h-16 animate-pulse rounded-2xl bg-[#e8eeec]" />
                </motion.div>
              ) : rows.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: easeOut }}
                  className="rounded-2xl border border-dashed border-[#e2e6e4] bg-[#f4f6f5] px-4 py-8 text-center text-sm text-[#616161]"
                >
                  Belum ada outlet. Tambah cabang pertama di form atas.
                </motion.p>
              ) : (
                <AppStagger className="space-y-2">
                  {rows.map((row) => (
                    <AppStaggerItem key={row.id}>
                      <div
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors duration-200 ${
                          row.isDefault
                            ? "border-[#003c33]/35 bg-[#edfce9]/50"
                            : "border-[#e2e6e4] bg-white hover:border-[#003c33]/25 hover:bg-[#f4f6f5]"
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-[#17171c]">{row.name}</p>
                            {row.isDefault ? (
                              <span className="rounded-full border border-[#003c33]/25 bg-[#edfce9] px-2 py-0.5 text-xs text-[#003c33]">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[#616161]">{row.address?.trim() ? row.address : "Tanpa alamat"}</p>
                        </div>
                        {!row.isDefault ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className={btnPressClass}
                              onClick={() => {
                                void api(`/outlets/${row.id}`, { method: "PATCH", ...jsonInit({ isDefault: true }) })
                                  .then(() => {
                                    setActiveOutletId(row.id);
                                    toast.success("Outlet default diperbarui.");
                                    return load();
                                  })
                                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                              }}
                            >
                              Jadikan default
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={btnPressClass}
                              onClick={() => {
                                void api(`/outlets/${row.id}`, { method: "DELETE" })
                                  .then(() => {
                                    toast.success("Outlet dinonaktifkan.");
                                    return load();
                                  })
                                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                              }}
                            >
                              Hapus
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </AppStaggerItem>
                  ))}
                </AppStagger>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </AppReveal>
    </div>
  );
}
