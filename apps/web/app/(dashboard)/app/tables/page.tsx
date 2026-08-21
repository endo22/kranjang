"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";

type DiningTable = { id: string; name: string; sortOrder: number; isActive: boolean };

export default function DiningTablesPage() {
  const [rows, setRows] = useState<DiningTable[]>([]);
  const [name, setName] = useState("");

  async function load() {
    setRows(await api<DiningTable[]>("/dining-tables"));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Meja</CardTitle>
          <CardDescription>Daftar meja outlet aktif untuk hold bill dine-in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void api("/dining-tables", { method: "POST", ...jsonInit({ name }) })
                .then(() => {
                  setName("");
                  toast.success("Meja ditambahkan.");
                  return load();
                })
                .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
            }}
          >
            <Input
              className="max-w-xs"
              placeholder="Nama meja"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <Button type="submit">Tambah</Button>
          </form>

          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm">
              <p className="font-medium">
                {row.name}
                {!row.isActive ? " · nonaktif" : ""}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api(`/dining-tables/${row.id}`, { method: "DELETE" })
                    .then(() => {
                      toast.success("Meja dihapus.");
                      return load();
                    })
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                }}
              >
                Hapus
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
