"use client";

import { patchSettingsSchema } from "@kranjang/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type SettingsRecord, jsonInit } from "@/lib/api";

type SettingsFormState = {
  name: string;
  phone: string;
  timezone: string;
  allowNegativeStock: boolean;
  taxPercent: string;
  taxInclusive: boolean;
  receiptFooter: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan. Silakan coba lagi.";
}

function toFormState(settings: SettingsRecord): SettingsFormState {
  return {
    name: settings.name,
    phone: settings.phone ?? "",
    timezone: settings.timezone,
    allowNegativeStock: settings.allowNegativeStock,
    taxPercent: settings.taxPercent,
    taxInclusive: settings.taxInclusive,
    receiptFooter: settings.receiptFooter ?? "",
  };
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadSettings() {
    setIsLoading(true);
    setError(null);

    try {
      const settings = await api<SettingsRecord>("/settings");
      setForm(toFormState(settings));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) {
      return;
    }

    const taxPercent = Number(form.taxPercent);
    const parsed = patchSettingsSchema.safeParse({
      name: form.name,
      phone: form.phone.trim() ? form.phone.trim() : null,
      timezone: form.timezone,
      allowNegativeStock: form.allowNegativeStock,
      taxPercent,
      taxInclusive: form.taxInclusive,
      receiptFooter: form.receiptFooter.trim() ? form.receiptFooter.trim() : null,
    });

    if (!parsed.success || Number.isNaN(taxPercent)) {
      setError("Periksa kembali nama usaha, telepon, timezone, pajak, dan footer struk.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saved = await api<SettingsRecord>("/settings", {
        method: "PATCH",
        ...jsonInit(parsed.data),
      });

      setForm(toFormState(saved));
      toast.success("Pengaturan berhasil disimpan.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan</CardTitle>
        <CardDescription>
          Perbarui field tenant dan preferensi operasional. `allowNegativeStock` hanya disimpan untuk fase ini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
            <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
            <div className="h-40 animate-pulse rounded-2xl bg-[#f3f4f6]" />
          </div>
        ) : form ? (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Nama usaha</Label>
                <Input
                  id="settings-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => (current ? { ...current, name: event.target.value } : current))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-phone">Nomor telepon</Label>
                <Input
                  id="settings-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => (current ? { ...current, phone: event.target.value } : current))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-timezone">Timezone</Label>
                <Input
                  id="settings-timezone"
                  value={form.timezone}
                  onChange={(event) => setForm((current) => (current ? { ...current, timezone: event.target.value } : current))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-tax">Pajak (%)</Label>
                <Input
                  id="settings-tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.taxPercent}
                  onChange={(event) => setForm((current) => (current ? { ...current, taxPercent: event.target.value } : current))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-footer">Footer struk</Label>
              <textarea
                id="settings-footer"
                value={form.receiptFooter}
                onChange={(event) =>
                  setForm((current) => (current ? { ...current, receiptFooter: event.target.value } : current))
                }
                rows={5}
                className="flex w-full rounded-2xl border border-[#d9d9dd] bg-white px-3 py-3 text-sm text-[#212121] outline-none focus-visible:border-[#9b60aa]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-[24px] border border-[#ececf1] p-4">
                <input
                  type="checkbox"
                  checked={form.allowNegativeStock}
                  onChange={(event) =>
                    setForm((current) => (current ? { ...current, allowNegativeStock: event.target.checked } : current))
                  }
                  className="mt-1 h-4 w-4 rounded border-[#d9d9dd]"
                />
                <div>
                  <p className="text-sm font-medium text-[#17171c]">Izinkan stok negatif</p>
                  <p className="mt-1 text-sm leading-6 text-[#616161]">
                    Nilai ini hanya disimpan dan belum dipakai oleh kasir pada fase ini.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-[24px] border border-[#ececf1] p-4">
                <input
                  type="checkbox"
                  checked={form.taxInclusive}
                  onChange={(event) =>
                    setForm((current) => (current ? { ...current, taxInclusive: event.target.checked } : current))
                  }
                  className="mt-1 h-4 w-4 rounded border-[#d9d9dd]"
                />
                <div>
                  <p className="text-sm font-medium text-[#17171c]">Pajak sudah termasuk harga</p>
                  <p className="mt-1 text-sm leading-6 text-[#616161]">Atur preferensi pencatatan pajak untuk tenant Anda.</p>
                </div>
              </label>
            </div>

            {error ? <p className="text-sm text-[#a32626]">{error}</p> : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan pengaturan"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-[#a32626]">{error ?? "Pengaturan tidak dapat dimuat."}</p>
        )}
      </CardContent>
    </Card>
  );
}
