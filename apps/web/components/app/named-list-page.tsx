"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";

export default function NamedListPage({
  title,
  path,
  extraFields,
}: {
  title: string;
  path: string;
  extraFields?: boolean;
}) {
  const [rows, setRows] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    setRows(await api(path));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, [path]);

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
            void api(path, { method: "POST", ...jsonInit({ name, phone: extraFields ? phone : undefined }) })
              .then(() => {
                setName("");
                return load();
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama" required />
          {extraFields ? <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telepon" /> : null}
          <Button type="submit">Tambah</Button>
        </form>
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border px-4 py-3">{row.name}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
