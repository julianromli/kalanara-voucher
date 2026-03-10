"use server";

import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Admin, AdminRole } from "@/lib/database.types";

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
  userData: {
    email: string;
    name: string;
    role: AdminRole;
  }
): Promise<Admin | null> {
  const access = await requireAdminPermission(AdminPermission.USERS_MANAGE);

  const supabase = getAdminClient();
  
  // Create auth user first without admin role metadata.
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: generateTempPassword(),
    email_confirm: true,
    user_metadata: {
      name: userData.name,
    },
  });

  if (authError || !authUser.user) {
    console.error("Error creating auth user:", authError);
    return null;
  }

  const { data, error } = await supabase
    .from("admins")
    .insert({
      id: authUser.user.id,
      email: userData.email,
      name: userData.name,
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

    return null;
  }

  const { error: metadataSyncError } = await supabase.auth.admin.updateUserById(
    authUser.user.id,
    {
      user_metadata: {
        name: userData.name,
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
    details: { role: data.role, email: data.email },
  });

  return data;
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
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

  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    user_metadata: {
      name: existingAdmin.name,
      role: null,
    },
  });

  if (authError) {
    console.error("Error syncing deactivated admin role:", authError);
  }

  logAdminAudit(access, {
    action: "admin_user.deactivate",
    target: existingAdmin.id,
    details: { previousRole: existingAdmin.role },
  });

  return existingAdmin;
}
