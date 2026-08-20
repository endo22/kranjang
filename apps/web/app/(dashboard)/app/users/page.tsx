"use client";

import { createUserSchema, updateUserSchema } from "@kranjang/shared";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type RoleRecord, type UserRecord, jsonInit } from "@/lib/api";

type CreateFormState = {
  name: string;
  email: string;
  password: string;
  phone: string;
  roleId: string;
};

type EditFormState = {
  id: string;
  name: string;
  phone: string;
  roleId: string;
};

const initialCreateForm: CreateFormState = {
  name: "",
  email: "",
  password: "",
  phone: "",
  roleId: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan. Silakan coba lagi.";
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setPageError(null);

    try {
      const [userRows, roleRows] = await Promise.all([
        api<UserRecord[]>("/users?includeInactive=1"),
        api<RoleRecord[]>("/roles"),
      ]);

      setUsers(userRows);
      setRoles(roleRows);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const roleOptions = useMemo(() => roles.map((role) => ({ value: role.id, label: role.name })), [roles]);

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    const parsed = createUserSchema.safeParse({
      name: createForm.name,
      email: createForm.email,
      password: createForm.password,
      phone: createForm.phone.trim() || undefined,
      roleId: createForm.roleId,
    });

    if (!parsed.success) {
      setCreateError("Lengkapi nama, email, password, role, dan nomor telepon dengan format yang benar.");
      return;
    }

    setIsCreating(true);

    try {
      const created = await api<UserRecord>(
        "/users",
        {
          method: "POST",
          ...jsonInit(parsed.data),
        },
      );

      setUsers((current) => [...current, created]);
      setCreateForm(initialCreateForm);
      setCreateOpen(false);
      toast.success("User berhasil ditambahkan.");
    } catch (error) {
      setCreateError(getErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  function openEditDialog(user: UserRecord) {
    setEditError(null);
    setEditForm({
      id: user.id,
      name: user.name,
      phone: user.phone ?? "",
      roleId: user.role.id,
    });
    setEditOpen(true);
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    setEditError(null);
    const parsed = updateUserSchema.safeParse({
      name: editForm.name,
      phone: editForm.phone.trim() ? editForm.phone.trim() : null,
      roleId: editForm.roleId,
    });

    if (!parsed.success) {
      setEditError("Periksa kembali nama, nomor telepon, dan role user.");
      return;
    }

    setIsUpdating(true);

    try {
      const updated = await api<UserRecord>(`/users/${editForm.id}`, {
        method: "PATCH",
        ...jsonInit(parsed.data),
      });

      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setEditOpen(false);
      setEditForm(null);
      toast.success("User berhasil diperbarui.");
    } catch (error) {
      setEditError(getErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteUser) {
      return;
    }

    setIsDeleting(true);

    try {
      await api<{ success: true }>(`/users/${deleteUser.id}`, {
        method: "DELETE",
      });

      setUsers((current) => current.filter((user) => user.id !== deleteUser.id));
      setDeleteUser(null);
      toast.success("User berhasil dinonaktifkan.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>User & Role</CardTitle>
            <CardDescription>Kelola user tenant dan penugasan role tanpa menampilkan password hash.</CardDescription>
          </div>
          <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Tambah user
          </Button>
        </CardHeader>
        <CardContent>
          {pageError ? <p className="text-sm text-[#a32626]">{pageError}</p> : null}

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
              <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
              <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#d9d9dd] bg-[#fcfcfd] p-8 text-sm leading-6 text-[#616161]">
              Belum ada user tambahan. Tambahkan user baru untuk mulai mengatur akses role di tenant ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#ececf1] text-[#75758a]">
                    <th className="px-3 py-3 font-medium">Nama</th>
                    <th className="px-3 py-3 font-medium">Email</th>
                    <th className="px-3 py-3 font-medium">Telepon</th>
                    <th className="px-3 py-3 font-medium">Role</th>
                    <th className="px-3 py-3 font-medium">Dibuat</th>
                    <th className="px-3 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[#f1f2f4] last:border-b-0">
                      <td className="px-3 py-4 font-medium text-[#17171c]">
                        {user.name}
                        {user.deletedAt ? <span className="ml-2 text-xs text-[#a32626]">(nonaktif)</span> : null}
                      </td>
                      <td className="px-3 py-4 text-[#616161]">{user.email}</td>
                      <td className="px-3 py-4 text-[#616161]">{user.phone ?? "-"}</td>
                      <td className="px-3 py-4 text-[#616161]">{user.role.name}</td>
                      <td className="px-3 py-4 text-[#616161]">{formatDate(user.createdAt)}</td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-2">
                          {!user.deletedAt ? (
                            <>
                              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => openEditDialog(user)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-2 text-[#a32626] hover:bg-[#fff5f5] hover:text-[#a32626]"
                                onClick={() => setDeleteUser(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Nonaktif
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                void api<UserRecord>(`/users/${user.id}/restore`, { method: "POST" })
                                  .then(() => {
                                    toast.success("User diaktifkan kembali.");
                                    return loadData();
                                  })
                                  .catch((error) => toast.error(getErrorMessage(error)));
                              }}
                            >
                              Aktifkan
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateError(null);
            setCreateForm(initialCreateForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah user</DialogTitle>
            <DialogDescription>Isi identitas user baru dan pilih role yang sesuai.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateSubmit}>
            <div className="space-y-2">
              <Label htmlFor="create-name">Nama</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-phone">Nomor telepon</Label>
              <Input
                id="create-phone"
                type="tel"
                value={createForm.phone}
                onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <select
                id="create-role"
                value={createForm.roleId}
                onChange={(event) => setCreateForm((current) => ({ ...current, roleId: event.target.value }))}
                className="flex h-11 w-full rounded-xl border border-[#d9d9dd] bg-white px-3 py-2 text-sm text-[#212121] outline-none focus-visible:border-[#9b60aa]"
              >
                <option value="">Pilih role</option>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {createError ? <p className="text-sm text-[#a32626]">{createError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Menyimpan..." : "Simpan user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditError(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Perbarui nama, telepon, dan role user tenant.</DialogDescription>
          </DialogHeader>

          {editForm ? (
            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nama</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => (current ? { ...current, name: event.target.value } : current))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Nomor telepon</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((current) => (current ? { ...current, phone: event.target.value } : current))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <select
                  id="edit-role"
                  value={editForm.roleId}
                  onChange={(event) => setEditForm((current) => (current ? { ...current, roleId: event.target.value } : current))}
                  className="flex h-11 w-full rounded-xl border border-[#d9d9dd] bg-white px-3 py-2 text-sm text-[#212121] outline-none focus-visible:border-[#9b60aa]"
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {editError ? <p className="text-sm text-[#a32626]">{editError}</p> : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Menyimpan..." : "Simpan perubahan"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteUser)} onOpenChange={(open) => (!open ? setDeleteUser(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan user</DialogTitle>
            <DialogDescription>
              {deleteUser ? `User ${deleteUser.name} akan dinonaktifkan dan tidak bisa login. Anda bisa mengaktifkannya kembali nanti.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteUser(null)}>
              Batal
            </Button>
            <Button type="button" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? "Menonaktifkan..." : "Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
