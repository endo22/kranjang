"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, jsonInit } from "@/lib/api";
import { formatRp, todayIso } from "@/lib/format";

type Category = { id: string; name: string };
type Expense = { id: string; description: string; amount: number; category: { name: string } };

export default function ExpensesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Expense[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");

  async function load() {
    const [nextCategories, nextRows] = await Promise.all([api<Category[]>("/expense-categories"), api<Expense[]>("/expenses")]);
    setCategories(nextCategories);
    setRows(nextRows);
    setCategoryId((value) => value || nextCategories[0]?.id || "");
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biaya</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void api("/expenses", {
              method: "POST",
              ...jsonInit({
                categoryId,
                description,
                amount: Number(amount),
                expenseDate: todayIso(),
                paymentMethod: "CASH",
              }),
            })
              .then(() => {
                setDescription("");
                return load();
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal"));
          }}
        >
          <select className="h-11 rounded-2xl border px-3" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Deskripsi" required />
          <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Button type="submit">Simpan</Button>
        </form>
        {rows.map((row) => (
          <p key={row.id} className="text-sm">{row.category.name} · {row.description} · {formatRp(row.amount)}</p>
        ))}
      </CardContent>
    </Card>
  );
}
