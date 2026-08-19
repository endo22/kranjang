"use client";

import { changePasswordSchema, patchMeSchema } from "@kranjang/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type MeProfile, jsonInit } from "@/lib/api";

type ProfileFormState = {
  name: string;
  phone: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialPasswordForm: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan. Silakan coba lagi.";
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(initialPasswordForm);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  async function loadProfile() {
    setIsLoading(true);
    setProfileError(null);

    try {
      const nextProfile = await api<MeProfile>("/me");
      setProfile(nextProfile);
      setProfileForm({
        name: nextProfile.name,
        phone: nextProfile.phone ?? "",
      });
    } catch (error) {
      setProfileError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profileForm) {
      return;
    }

    const parsed = patchMeSchema.safeParse({
      name: profileForm.name,
      phone: profileForm.phone.trim() ? profileForm.phone.trim() : null,
    });

    if (!parsed.success) {
      setProfileError("Nama dan nomor telepon profil belum valid.");
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);

    try {
      const saved = await api<MeProfile>("/me", {
        method: "PATCH",
        ...jsonInit(parsed.data),
      });

      setProfile(saved);
      setProfileForm({
        name: saved.name,
        phone: saved.phone ?? "",
      });
      toast.success("Profil berhasil diperbarui.");
    } catch (error) {
      setProfileError(getErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Konfirmasi password baru harus sama.");
      return;
    }

    const parsed = changePasswordSchema.safeParse({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });

    if (!parsed.success) {
      setPasswordError("Periksa password saat ini dan password baru Anda.");
      return;
    }

    setIsSavingPassword(true);
    setPasswordError(null);

    try {
      await api<{ success: true }>("/me/change-password", {
        method: "POST",
        ...jsonInit(parsed.data),
      });

      setPasswordForm(initialPasswordForm);
      toast.success("Password berhasil diganti.");
    } catch (error) {
      setPasswordError(getErrorMessage(error));
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Perbarui data akun Anda melalui endpoint `PATCH /me`.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
              <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
              <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
            </div>
          ) : profile && profileForm ? (
            <form className="space-y-5" onSubmit={handleProfileSubmit}>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nama</Label>
                <Input
                  id="profile-name"
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={profile.email} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">Nomor telepon</Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((current) => (current ? { ...current, phone: event.target.value } : current))
                  }
                />
              </div>

              <div className="rounded-[24px] border border-[#ececf1] bg-[#fcfcfd] p-4 text-sm leading-6 text-[#616161]">
                Akun dibuat pada {formatDate(profile.createdAt)}.
              </div>

              {profileError ? <p className="text-sm text-[#a32626]">{profileError}</p> : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingProfile}>
                  {isSavingProfile ? "Menyimpan..." : "Simpan profil"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-[#a32626]">{profileError ?? "Profil tidak dapat dimuat."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ganti password</CardTitle>
          <CardDescription>Ubah password akun melalui endpoint `POST /me/change-password`.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handlePasswordSubmit}>
            <div className="space-y-2">
              <Label htmlFor="current-password">Password saat ini</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Password baru</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi password baru</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                }
              />
            </div>

            {passwordError ? <p className="text-sm text-[#a32626]">{passwordError}</p> : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Menyimpan..." : "Ganti password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
