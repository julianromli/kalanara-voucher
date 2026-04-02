"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import {
  createAdminUser,
  updateAdminUserProfile,
  updateAdminUserRole,
  type AdminOnboardingMode,
} from "@/lib/actions/admin-users";
import type { Admin, AdminRole } from "@/lib/database.types";

interface AdminUsersClientProps {
  initialUsers: Admin[];
}

interface NewUserFormState {
  email: string;
  name: string;
  role: AdminRole;
  onboardingMode: AdminOnboardingMode;
  password: string;
  confirmPassword: string;
}

interface EditUserFormState {
  id: string;
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

const MIN_PASSWORD_LENGTH = 8;

const ROLE_COLORS = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  MANAGER: "bg-blue-100 text-blue-800",
  STAFF: "bg-gray-100 text-gray-800"
} as const;

const INITIAL_NEW_USER_FORM: NewUserFormState = {
  email: "",
  name: "",
  role: "STAFF",
  onboardingMode: "invite",
  password: "",
  confirmPassword: "",
};

const INITIAL_EDIT_USER_FORM: EditUserFormState = {
  id: "",
  email: "",
  name: "",
  password: "",
  confirmPassword: "",
};

const CREATE_NAME_INPUT_ID = "create-admin-name";
const CREATE_EMAIL_INPUT_ID = "create-admin-email";
const CREATE_ROLE_SELECT_ID = "create-admin-role";
const CREATE_ONBOARDING_GROUP_ID = "create-admin-onboarding";
const CREATE_PASSWORD_INPUT_ID = "create-admin-password";
const CREATE_CONFIRM_PASSWORD_INPUT_ID = "create-admin-confirm-password";
const EDIT_NAME_INPUT_ID = "edit-admin-name";
const EDIT_EMAIL_INPUT_ID = "edit-admin-email";
const EDIT_PASSWORD_INPUT_ID = "edit-admin-password";
const EDIT_CONFIRM_PASSWORD_INPUT_ID = "edit-admin-confirm-password";

function getPasswordError(password: string, confirmPassword: string) {
  if (!password && !confirmPassword) {
    return "";
  }

  if (!password || !confirmPassword) {
    return "Password dan konfirmasi password wajib diisi bersama.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }

  if (password !== confirmPassword) {
    return "Konfirmasi password harus sama dengan password.";
  }

  return "";
}

export function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const router = useRouter();
  const { user: currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "ALL">("ALL");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserFormState>(INITIAL_NEW_USER_FORM);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState>(INITIAL_EDIT_USER_FORM);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const superAdminCount = users.filter((user) => user.role === "SUPER_ADMIN").length;

  const isManualMode = newUserForm.onboardingMode === "manual";
  const createPasswordError = isManualMode
    ? getPasswordError(newUserForm.password, newUserForm.confirmPassword)
    : "";
  const isCreateDisabled =
    isCreatingUser ||
    !newUserForm.name.trim() ||
    !newUserForm.email.trim() ||
    Boolean(createPasswordError);

  const editPasswordError = getPasswordError(
    editUserForm.password,
    editUserForm.confirmPassword
  );
  const isEditDisabled =
    isUpdatingUser || !editUserForm.name.trim() || Boolean(editPasswordError);

  const handleCreateUser = async () => {
    if (isCreateDisabled) {
      if (createPasswordError) {
        showToast(createPasswordError, "error");
      }
      return;
    }

    setIsCreatingUser(true);

    try {
      const result = await createAdminUser(newUserForm);
      setUsers((previousUsers) => [result.admin, ...previousUsers]);
      setIsCreateDialogOpen(false);
      setNewUserForm(INITIAL_NEW_USER_FORM);
      showToast(
        result.onboardingMode === "invite"
          ? "Undangan admin berhasil dikirim"
          : "Admin berhasil dibuat dan bisa login sekarang",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal membuat admin user",
        "error"
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const openEditDialog = (user: Admin) => {
    setEditUserForm({
      id: user.id,
      email: user.email,
      name: user.name,
      password: "",
      confirmPassword: "",
    });
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditUserForm(INITIAL_EDIT_USER_FORM);
  };

  const handleUpdateUser = async () => {
    if (isEditDisabled) {
      if (editPasswordError) {
        showToast(editPasswordError, "error");
      }
      return;
    }

    setIsUpdatingUser(true);

    try {
      const updatedUser = await updateAdminUserProfile(editUserForm);
      setUsers((previousUsers) =>
        previousUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user))
      );
      closeEditDialog();
      showToast(
        editUserForm.password
          ? "Profil admin dan password berhasil diperbarui"
          : "Profil admin berhasil diperbarui",
        "success"
      );
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal memperbarui profil admin",
        "error"
      );
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: AdminRole) => {
    const previousUsers = [...users];
    setUsers(users.map((user) => (user.id === userId ? { ...user, role: newRole } : user)));

    try {
      const result = await updateAdminUserRole(userId, newRole);
      if (!result) {
        setUsers(previousUsers);
        showToast("Failed to update user role", "error");
      }
    } catch {
      setUsers(previousUsers);
      showToast("Failed to update user role", "error");
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="User Management" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Kelola admin, akses, dan onboarding akun tim.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <HugeiconsIcon icon={PlusSignIcon} className="w-4 h-4 mr-2" />
              Tambah Admin
            </Button>
          </div>

          <div className="bg-card rounded-2xl shadow-spa border border-border p-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <Input
                placeholder="Cari nama atau email admin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as AdminRole | "ALL")}
                className="px-3 py-2 border border-border rounded-lg"
              >
                <option value="ALL">Semua Role</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/50">
                     <th className="text-left p-4">Nama</th>
                     <th className="text-left p-4">Email</th>
                     <th className="text-left p-4">Role</th>
                     <th className="text-left p-4">Dibuat</th>
                     <th className="text-right p-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => {
                    const isCurrentUser = currentUser?.id === user.id;
                    const isLastSuperAdmin =
                      user.role === "SUPER_ADMIN" && superAdminCount === 1;

                    return (
                      <tr key={user.id} className="hover:bg-accent/50">
                        <td className="p-4">
                          <div className="font-medium">{user.name}</div>
                        </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="p-4">
                        <Badge className={ROLE_COLORS[user.role]}>
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleUpdate(user.id, e.target.value as AdminRole)}
                            disabled={isCurrentUser || isLastSuperAdmin}
                            className="px-2 py-1 text-sm border border-border rounded"
                          >
                            <option value="SUPER_ADMIN">Super Admin</option>
                            <option value="MANAGER">Manager</option>
                            <option value="STAFF">Staff</option>
                          </select>
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => openEditDialog(user)}
                           >
                             <HugeiconsIcon icon={PencilEdit01Icon} className="w-4 h-4" />
                           </Button>
                        </div>
                        {(isCurrentUser || isLastSuperAdmin) && (
                          <p className="mt-2 text-right text-xs text-muted-foreground">
                            {isCurrentUser
                              ? "Anda tidak bisa mengubah role akun sendiri"
                              : "Super admin terakhir harus tetap aktif"}
                          </p>
                        )}
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                 <p className="text-muted-foreground">Tidak ada admin yang cocok.</p>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Admin Baru</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
               <label htmlFor={CREATE_NAME_INPUT_ID} className="block text-sm font-medium mb-1">Nama</label>
                <Input
                  id={CREATE_NAME_INPUT_ID}
                  value={newUserForm.name}
                   onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                  placeholder="Masukkan nama lengkap"
                />
             </div>
             
             <div>
                <label htmlFor={CREATE_EMAIL_INPUT_ID} className="block text-sm font-medium mb-1">Email</label>
                <Input
                  id={CREATE_EMAIL_INPUT_ID}
                  type="email"
                  value={newUserForm.email}
                   onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                 placeholder="Masukkan email admin"
               />
             </div>
             
             <div>
                <label htmlFor={CREATE_ROLE_SELECT_ID} className="block text-sm font-medium mb-1">Role</label>
               <select
                 id={CREATE_ROLE_SELECT_ID}
                 value={newUserForm.role}
                 onChange={(e) =>
                   setNewUserForm({
                    ...newUserForm,
                    role: e.target.value as AdminRole,
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg"
              >
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>

            <div>
              <label htmlFor={CREATE_ONBOARDING_GROUP_ID} className="block text-sm font-medium mb-2">Metode onboarding</label>
              <div id={CREATE_ONBOARDING_GROUP_ID} className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/40">
                  <input
                    type="radio"
                    name="onboardingMode"
                    value="invite"
                    checked={newUserForm.onboardingMode === "invite"}
                    onChange={() =>
                      setNewUserForm((currentForm) => ({
                        ...currentForm,
                        onboardingMode: "invite",
                        password: "",
                        confirmPassword: "",
                      }))
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium">Kirim undangan email</p>
                    <p className="text-xs text-muted-foreground">
                      Admin baru menerima link Supabase untuk set password sendiri.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/40">
                  <input
                    type="radio"
                    name="onboardingMode"
                    value="manual"
                    checked={newUserForm.onboardingMode === "manual"}
                    onChange={() =>
                      setNewUserForm((currentForm) => ({
                        ...currentForm,
                        onboardingMode: "manual",
                      }))
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium">Atur password manual</p>
                    <p className="text-xs text-muted-foreground">
                      Super admin menetapkan password awal agar akun bisa login langsung.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {isManualMode ? (
              <>
                <div>
                  <label htmlFor={CREATE_PASSWORD_INPUT_ID} className="block text-sm font-medium mb-1">Password awal</label>
                  <Input
                    id={CREATE_PASSWORD_INPUT_ID}
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, password: e.target.value })
                    }
                    minLength={8}
                    placeholder="Minimal sesuai kebijakan Supabase"
                  />
                </div>

                <div>
                  <label htmlFor={CREATE_CONFIRM_PASSWORD_INPUT_ID} className="block text-sm font-medium mb-1">Konfirmasi password</label>
                  <Input
                    id={CREATE_CONFIRM_PASSWORD_INPUT_ID}
                    type="password"
                    value={newUserForm.confirmPassword}
                    onChange={(e) =>
                      setNewUserForm({
                        ...newUserForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    minLength={8}
                    placeholder="Ulangi password"
                  />
                   {createPasswordError ? (
                     <p className="mt-1 text-xs text-destructive">
                       {createPasswordError}
                     </p>
                   ) : null}
                 </div>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-accent/30 p-3 text-xs text-muted-foreground">
                Link undangan akan dikirim ke email admin baru untuk set password dan masuk ke dashboard.
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setNewUserForm(INITIAL_NEW_USER_FORM);
                }}
                disabled={isCreatingUser}
              >
                 Batal
               </Button>
              <Button onClick={handleCreateUser} disabled={isCreateDisabled}>
                 {isCreatingUser ? "Menyimpan..." : "Buat Admin"}
               </Button>
             </div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => (open ? setIsEditDialogOpen(true) : closeEditDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label htmlFor={EDIT_NAME_INPUT_ID} className="mb-1 block text-sm font-medium">Nama</label>
              <Input
                id={EDIT_NAME_INPUT_ID}
                value={editUserForm.name}
                onChange={(event) =>
                  setEditUserForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                placeholder="Masukkan nama admin"
                disabled={isUpdatingUser}
              />
            </div>

            <div>
              <label htmlFor={EDIT_EMAIL_INPUT_ID} className="mb-1 block text-sm font-medium">Email</label>
              <Input id={EDIT_EMAIL_INPUT_ID} value={editUserForm.email} disabled readOnly className="bg-accent/20" />
            </div>

            <div className="rounded-lg border border-border bg-accent/20 p-3 text-xs text-muted-foreground">
              Kosongkan password jika hanya ingin memperbarui nama admin.
            </div>

            <div>
              <label htmlFor={EDIT_PASSWORD_INPUT_ID} className="mb-1 block text-sm font-medium">Password baru</label>
              <Input
                id={EDIT_PASSWORD_INPUT_ID}
                type="password"
                value={editUserForm.password}
                onChange={(event) =>
                  setEditUserForm((currentForm) => ({
                    ...currentForm,
                    password: event.target.value,
                  }))
                }
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="Isi untuk reset password"
                disabled={isUpdatingUser}
              />
            </div>

            <div>
              <label htmlFor={EDIT_CONFIRM_PASSWORD_INPUT_ID} className="mb-1 block text-sm font-medium">Konfirmasi password</label>
              <Input
                id={EDIT_CONFIRM_PASSWORD_INPUT_ID}
                type="password"
                value={editUserForm.confirmPassword}
                onChange={(event) =>
                  setEditUserForm((currentForm) => ({
                    ...currentForm,
                    confirmPassword: event.target.value,
                  }))
                }
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="Ulangi password baru"
                disabled={isUpdatingUser}
              />
              {editPasswordError ? (
                <p className="mt-1 text-xs text-destructive">{editPasswordError}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={closeEditDialog} disabled={isUpdatingUser}>
                Batal
              </Button>
              <Button onClick={handleUpdateUser} disabled={isEditDisabled}>
                {isUpdatingUser ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
