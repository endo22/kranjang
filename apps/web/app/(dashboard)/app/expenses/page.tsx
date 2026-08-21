"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";
import { formatRp, todayIso } from "@/lib/format";

type Category = { id: string; name: string };
type Expense = {
  id: string;
  description: string;
  amount: number;
  expenseDate?: string;
  categoryId?: string;
  paymentMethod?: string;
  category: { name: string };
};

export default function ExpensesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Expense[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams({ from, to, limit: "50", offset: "0" });
    const [nextCategories, nextRows] = await Promise.all([
      api<Category[]>("/expense-categories"),
      api<{ items: Expense[] }>(`/expenses?${params.toString()}`),
    ]);
    setCategories(nextCategories);
    setRows(nextRows.items);
    setCategoryId((value) => value || nextCategories[0]?.id || "");
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  function resetForm() {
    setEditingId(null);
    setDescription("");
    setAmount("0");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biaya</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>

        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = {
              categoryId,
              description,
              amount: Number(amount),
              expenseDate: todayIso(),
              paymentMethod: "CASH" as const,
            };
            const request = editingId
              ? api(`/expenses/${editingId}`, { method: "PATCH", ...jsonInit(payload) })
              : api("/expenses", { method: "POST", ...jsonInit(payload) });
            void request
              .then(() => {
                resetForm();
                return load();
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <select className="h-11 rounded-2xl border px-3" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Deskripsi" required />
          <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Button type="submit">{editingId ? "Simpan" : "Tambah"}</Button>
        </form>

        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm">
            <span>
              {row.category.name} · {row.description} · {formatRp(row.amount)}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(row.id);
                  setDescription(row.description);
                  setAmount(String(row.amount));
                  setCategoryId(row.categoryId ?? categories[0]?.id ?? "");
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api(`/expenses/${row.id}`, { method: "DELETE" })
                    .then(() => load())
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
                }}
              >
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
