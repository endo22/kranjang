"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";

type Row = { id: string; name: string; phone?: string | null };

export default function NamedListPage({
  title,
  path,
  extraFields,
}: {
  title: string;
  path: string;
  extraFields?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load(search = query) {
    const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    setRows(await api(`${path}${suffix}`));
  }

  useEffect(() => {
    void load("").catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, [path]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPhone("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void load(query).catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <Input placeholder="Cari nama/telepon" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button type="submit" variant="outline">
            Cari
          </Button>
        </form>

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = { name, phone: extraFields ? phone || null : undefined };
            const request = editingId
              ? api(`${path}/${editingId}`, { method: "PATCH", ...jsonInit(payload) })
              : api(path, { method: "POST", ...jsonInit(payload) });
            void request
              .then(() => {
                resetForm();
                return load();
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <Input placeholder="Nama" value={name} onChange={(event) => setName(event.target.value)} required />
          {extraFields ? <Input placeholder="Telepon" value={phone} onChange={(event) => setPhone(event.target.value)} /> : null}
          <Button type="submit">{editingId ? "Simpan" : "Tambah"}</Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Batal
            </Button>
          ) : null}
        </form>

        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm">
            <span>
              {row.name}
              {row.phone ? ` · ${row.phone}` : ""}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(row.id);
                  setName(row.name);
                  setPhone(row.phone ?? "");
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api(`${path}/${row.id}`, { method: "DELETE" })
                    .then(() => load())
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                }}
              >
                Nonaktif
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
