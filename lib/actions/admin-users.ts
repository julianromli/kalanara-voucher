"use server";

import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Admin, AdminRole } from "@/lib/database.types";

export type AdminOnboardingMode = "invite" | "manual";

export interface CreateAdminUserInput {
  email: string;
  name: string;
  role: AdminRole;
  onboardingMode: AdminOnboardingMode;
  password?: string;
  confirmPassword?: string;
}

export interface CreateAdminUserResult {
  admin: Admin;
  onboardingMode: AdminOnboardingMode;
}

export interface UpdateAdminUserInput {
  id: string;
  name: string;
  password?: string;
  confirmPassword?: string;
}

const MIN_ADMIN_PASSWORD_LENGTH = 8;

async function getSuperAdminCount() {
  const supabase = getAdminClient();
  const { count, error } = await supabase
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("role", "SUPER_ADMIN");

  if (error) {
    console.error("Error counting super admins:", error);
    return null;
  }

  return count ?? 0;
}

function logAdminLifecycleDenied(
  access: { userId: string; email: string; role: AdminRole },
  action: string,
  target: string,
  reason: string
) {
  logAdminAudit(access, {
    action,
    target,
    details: { reason },
  });
}

export async function createAdminUser(
  userData: CreateAdminUserInput
): Promise<CreateAdminUserResult> {
  const access = await requireAdminPermission(AdminPermission.USERS_MANAGE);

  const supabase = getAdminClient();

  const normalizedEmail = userData.email.trim().toLowerCase();
  const normalizedName = userData.name.trim();

  if (!normalizedEmail) {
    throw new Error("Email admin wajib diisi.");
  }

  if (!normalizedName) {
    throw new Error("Nama admin wajib diisi.");
  }

  if (userData.onboardingMode === "manual" && !userData.password) {
    throw new Error("Password admin wajib diisi untuk mode manual.");
  }

  const manualPassword = userData.onboardingMode === "manual" ? userData.password : undefined;

  validateAdminPassword(manualPassword, userData.confirmPassword);

  const { data: existingAdmin } = await supabase
    .from("admins")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingAdmin) {
    throw new Error("Email tersebut sudah terdaftar sebagai admin.");
  }

  const authResponse =
    userData.onboardingMode === "invite"
      ? await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
          data: {
            name: normalizedName,
            role: userData.role,
          },
          redirectTo: buildAdminInviteRedirectUrl(),
        })
      : await supabase.auth.admin.createUser({
          email: normalizedEmail,
          password: manualPassword!,
          email_confirm: true,
          user_metadata: {
            name: normalizedName,
            role: userData.role,
          },
        });

  const { data: authUser, error: authError } = authResponse;

  if (authError || !authUser.user) {
    console.error("Error creating auth user:", authError);
    throw new Error(getAdminUserCreationErrorMessage(authError?.message));
  }

  const { data, error } = await supabase
    .from("admins")
    .insert({
      id: authUser.user.id,
      email: normalizedEmail,
      name: normalizedName,
      role: userData.role
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating admin record:", error);

    const { error: cleanupError } = await supabase.auth.admin.deleteUser(authUser.user.id);
    if (cleanupError) {
      console.error("Error cleaning up auth user after admin insert failure:", cleanupError);
    }

    throw new Error(getAdminInsertErrorMessage(error?.message));
  }

  const { error: metadataSyncError } = await supabase.auth.admin.updateUserById(
    authUser.user.id,
    {
      user_metadata: {
        name: normalizedName,
        role: userData.role,
      },
    }
  );

  if (metadataSyncError) {
    console.error("Error syncing auth user role after admin creation:", metadataSyncError);
  }

  logAdminAudit(access, {
    action: "admin_user.create",
    target: data.id,
    details: {
      role: data.role,
      email: data.email,
      onboardingMode: userData.onboardingMode,
    },
  });

  return {
    admin: data,
    onboardingMode: userData.onboardingMode,
  };
}

export async function updateAdminUserProfile(
  input: UpdateAdminUserInput
): Promise<Admin> {
  const access = await requireAdminPermission(AdminPermission.USERS_MANAGE);
  const supabase = getAdminClient();

  const normalizedName = input.name.trim();
  const nextPassword = input.password || undefined;
  const nextConfirmPassword = input.confirmPassword || undefined;

  if (!input.id) {
    throw new Error("Admin tidak ditemukan.");
  }

  if (!normalizedName) {
    throw new Error("Nama admin wajib diisi.");
  }

  validateAdminPassword(nextPassword, nextConfirmPassword);

  const { data: existingAdmin, error: existingAdminError } = await supabase
    .from("admins")
    .select("*")
    .eq("id", input.id)
    .single();

  if (existingAdminError || !existingAdmin) {
    console.error("Error loading admin user for profile update:", existingAdminError);
    throw new Error("Admin tidak ditemukan.");
  }

  const { data: updatedAdmin, error: updateError } = await supabase
    .from("admins")
    .update({ name: normalizedName })
    .eq("id", input.id)
    .select()
    .single();

  if (updateError || !updatedAdmin) {
    console.error("Error updating admin profile:", updateError);
    throw new Error("Gagal memperbarui profil admin.");
  }

  const authPayload: Parameters<typeof supabase.auth.admin.updateUserById>[1] = {
    user_metadata: {
      name: updatedAdmin.name,
      role: updatedAdmin.role,
    },
  };

  if (nextPassword) {
    authPayload.password = nextPassword;
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(input.id, authPayload);

  if (authError) {
    console.error("Error syncing admin auth profile:", authError);

    logAdminAudit(access, {
      action: "admin_user.profile_update_failed",
      target: updatedAdmin.id,
      details: {
        email: updatedAdmin.email,
        passwordChanged: Boolean(nextPassword),
        reason: "auth_sync_failed",
      },
    });

    throw new Error(
      "Profil admin sudah diperbarui, tetapi sinkronisasi akun login gagal. Hubungi tim teknis untuk tindak lanjut manual."
    );
  }

  logAdminAudit(access, {
    action: "admin_user.profile_update",
    target: updatedAdmin.id,
    details: {
      email: updatedAdmin.email,
      passwordChanged: Boolean(nextPassword),
    },
  });

  return updatedAdmin;
}

function buildAdminInviteRedirectUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL belum dikonfigurasi untuk link undangan admin.");
  }

  return `${appUrl.replace(/\/$/, "")}/auth/callback`;
}

function getAdminUserCreationErrorMessage(message?: string) {
  if (!message) {
    return "Gagal membuat akun admin baru.";
  }

  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("already been registered")) {
    return "Email tersebut sudah terdaftar di sistem autentikasi.";
  }

  if (normalizedMessage.includes("password")) {
    return "Password admin tidak memenuhi syarat keamanan.";
  }

  return "Gagal membuat akun admin baru.";
}

function validateAdminPassword(password?: string, confirmPassword?: string) {
  if (!password) {
    return;
  }

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`Password admin minimal ${MIN_ADMIN_PASSWORD_LENGTH} karakter.`);
  }

  if (password !== confirmPassword) {
    throw new Error("Konfirmasi password admin tidak cocok.");
  }
}

function getAdminInsertErrorMessage(message?: string) {
  if (message?.toLowerCase().includes("duplicate key")) {
    return "Email tersebut sudah terdaftar sebagai admin.";
  }

  return "Gagal menyimpan data admin baru.";
}

export async function getAdminUsers(): Promise<Admin[]> {
  await requireAdminPermission(AdminPermission.USERS_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin users:", error);
    return [];
  }

  return data || [];
}

export async function updateAdminUserRole(
  id: string,
  role: AdminRole
): Promise<Admin | null> {
  const access = await requireAdminPermission(AdminPermission.USERS_MANAGE);

  const supabase = getAdminClient();
  const { data: existingAdmin, error: existingAdminError } = await supabase
    .from("admins")
    .select("*")
    .eq("id", id)
    .single();

  if (existingAdminError || !existingAdmin) {
    console.error("Error loading admin user for role update:", existingAdminError);
    return null;
  }

  if (access.userId === id && role !== existingAdmin.role) {
    logAdminLifecycleDenied(access, "admin_user.role_update_denied", id, "self_demotion_blocked");
    return null;
  }

  if (existingAdmin.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
    const superAdminCount = await getSuperAdminCount();

    if (superAdminCount === 1) {
      logAdminLifecycleDenied(
        access,
        "admin_user.role_update_denied",
        id,
        "last_super_admin_must_remain"
      );
      return null;
    }
  }

  if (existingAdmin.role === role) {
    return existingAdmin;
  }

  const { data, error } = await supabase
    .from("admins")
    .update({ role })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating admin user role:", error);
    return null;
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    user_metadata: {
      name: data.name,
      role,
    },
  });

  if (authError) {
    console.error("Error syncing auth user role:", authError);
  }

  logAdminAudit(access, {
    action: "admin_user.role_update",
    target: data.id,
    details: { role: data.role },
  });

  return data;
}

export async function deactivateAdminUser(id: string): Promise<Admin | null> {
  const access = await requireAdminPermission(AdminPermission.USERS_MANAGE);

  const supabase = getAdminClient();

  const { data: existingAdmin, error: existingAdminError } = await supabase
    .from("admins")
    .select("*")
    .eq("id", id)
    .single();

  if (existingAdminError || !existingAdmin) {
    console.error("Error loading admin user for deactivation:", existingAdminError);
    return null;
  }

  if (access.userId === id) {
    logAdminLifecycleDenied(access, "admin_user.deactivate_denied", id, "self_deactivation_blocked");
    return null;
  }

  if (existingAdmin.role === "SUPER_ADMIN") {
    const superAdminCount = await getSuperAdminCount();

    if (superAdminCount === 1) {
      logAdminLifecycleDenied(
        access,
        "admin_user.deactivate_denied",
        id,
        "last_super_admin_must_remain"
      );
      return null;
    }
  }

  const { error } = await supabase
    .from("admins")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deactivating admin user:", error);
    return null;
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(id);

  if (authError) {
    console.error("Error removing auth user during admin deactivation:", authError);
  }

  logAdminAudit(access, {
    action: "admin_user.deactivate",
    target: existingAdmin.id,
    details: { previousRole: existingAdmin.role },
  });

  return existingAdmin;
}
