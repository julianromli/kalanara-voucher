import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type AdminPermission,
  canAccessAdminRoute,
  getPermissionsForRole,
  hasPermissionForRole,
  normalizeAdminRole,
  type CanonicalAdminRole,
} from "@/lib/auth/admin-rbac";

export interface AdminAccess {
  userId: string;
  email: string;
  name: string;
  role: CanonicalAdminRole;
  permissions: readonly AdminPermission[];
}

export interface AdminAuditDetails {
  action: string;
  target?: string;
  details?: Record<string, unknown>;
}

interface AuditActor {
  userId?: string;
  email?: string;
  role?: CanonicalAdminRole | null;
}

export class AdminPermissionError extends Error {
  status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AdminPermissionError";
    this.status = status;
  }
}

export function isAdminPermissionError(
  error: unknown
): error is AdminPermissionError {
  return error instanceof AdminPermissionError;
}

function writeAdminAuditLog(actor: AuditActor, entry: AdminAuditDetails) {
  console.info(
    "[Admin Audit]",
    JSON.stringify({
      actorId: actor.userId ?? null,
      actorEmail: actor.email ?? null,
      actorRole: actor.role ?? null,
      action: entry.action,
      target: entry.target,
      details: entry.details,
      timestamp: new Date().toISOString(),
    })
  );
}

export const getCurrentAdminAccess = cache(async (): Promise<AdminAccess | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("id, email, name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = normalizeAdminRole(admin?.role);

  if (adminError || !admin || !role) {
    return null;
  }

  return {
    userId: admin.id,
    email: admin.email || user.email || "",
    name:
      admin.name ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Admin",
    role,
    permissions: getPermissionsForRole(role),
  };
});

export async function requireAdminRouteAccess(pathname: string) {
  const access = await getCurrentAdminAccess();

  if (!access) {
    writeAdminAuditLog({}, {
      action: "admin_route.denied",
      target: pathname,
      details: { reason: "unauthorized" },
    });
    redirect("/admin/login?error=unauthorized");
  }

  if (!canAccessAdminRoute(access.role, pathname)) {
    writeAdminAuditLog(access, {
      action: "admin_route.denied",
      target: pathname,
      details: { reason: "forbidden" },
    });
    redirect("/admin/dashboard");
  }

  return access;
}

export async function requireAdminPermission(permission: AdminPermission) {
  const access = await getCurrentAdminAccess();

  if (!access) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    writeAdminAuditLog(
      {
        userId: user?.id,
        email: user?.email,
        role: null,
      },
      {
        action: "admin_permission.denied",
        target: permission,
        details: { reason: "unauthorized" },
      }
    );
    throw new AdminPermissionError("Unauthorized", 401);
  }

  if (!hasPermissionForRole(access.role, permission)) {
    writeAdminAuditLog(access, {
      action: "admin_permission.denied",
      target: permission,
      details: { reason: "forbidden" },
    });
    throw new AdminPermissionError("Forbidden", 403);
  }

  return access;
}

export function logAdminAudit(
  access: Pick<AdminAccess, "userId" | "email" | "role">,
  entry: AdminAuditDetails
) {
  writeAdminAuditLog(access, entry);
}
