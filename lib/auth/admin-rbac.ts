import type { AdminRole } from "@/lib/database.types";

export const CANONICAL_ADMIN_ROLES = ["SUPER_ADMIN", "MANAGER", "STAFF"] as const;

export type CanonicalAdminRole = (typeof CANONICAL_ADMIN_ROLES)[number];
export type LegacyAdminRole = CanonicalAdminRole | "ADMIN" | null | undefined;

export const AdminPermission = {
  DASHBOARD_VIEW_OPERATIONAL: "dashboard.view_operational",
  DASHBOARD_VIEW_BUSINESS: "dashboard.view_business",
  ORDERS_VIEW: "orders.view",
  ORDERS_UPDATE_PAYMENT_STATUS: "orders.update_payment_status",
  VOUCHERS_MANAGE: "vouchers.manage",
  SERVICES_MANAGE: "services.manage",
  REVIEWS_MANAGE: "reviews.manage",
  USERS_MANAGE: "users.manage",
  SETTINGS_MANAGE_SENSITIVE: "settings.manage_sensitive",
} as const;

export type AdminPermission =
  (typeof AdminPermission)[keyof typeof AdminPermission];

const ALL_ADMIN_PERMISSIONS = Object.values(AdminPermission);

const ROLE_PERMISSIONS: Record<CanonicalAdminRole, readonly AdminPermission[]> = {
  SUPER_ADMIN: ALL_ADMIN_PERMISSIONS,
  MANAGER: [
    AdminPermission.DASHBOARD_VIEW_OPERATIONAL,
    AdminPermission.DASHBOARD_VIEW_BUSINESS,
    AdminPermission.ORDERS_VIEW,
    AdminPermission.ORDERS_UPDATE_PAYMENT_STATUS,
    AdminPermission.VOUCHERS_MANAGE,
    AdminPermission.SERVICES_MANAGE,
    AdminPermission.REVIEWS_MANAGE,
  ],
  STAFF: [
    AdminPermission.DASHBOARD_VIEW_OPERATIONAL,
    AdminPermission.ORDERS_VIEW,
    AdminPermission.VOUCHERS_MANAGE,
  ],
};

export const ADMIN_ROUTE_PERMISSIONS = {
  "/admin/dashboard": AdminPermission.DASHBOARD_VIEW_OPERATIONAL,
  "/admin/purchases": AdminPermission.ORDERS_VIEW,
  "/admin/vouchers": AdminPermission.VOUCHERS_MANAGE,
  "/admin/services": AdminPermission.SERVICES_MANAGE,
  "/admin/reviews": AdminPermission.REVIEWS_MANAGE,
  "/admin/users": AdminPermission.USERS_MANAGE,
  "/admin/settings": AdminPermission.SETTINGS_MANAGE_SENSITIVE,
  "/admin/help": AdminPermission.DASHBOARD_VIEW_OPERATIONAL,
} as const;

export function normalizeAdminRole(role: LegacyAdminRole): CanonicalAdminRole | null {
  if (!role) {
    return null;
  }

  if (role === "ADMIN") {
    return "MANAGER";
  }

  return CANONICAL_ADMIN_ROLES.includes(role as CanonicalAdminRole)
    ? (role as CanonicalAdminRole)
    : null;
}

export function getPermissionsForRole(
  role: LegacyAdminRole
): readonly AdminPermission[] {
  const normalizedRole = normalizeAdminRole(role);

  return normalizedRole ? ROLE_PERMISSIONS[normalizedRole] : [];
}

export function hasPermissionForRole(
  role: LegacyAdminRole,
  permission: AdminPermission
): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function getRequiredPermissionForAdminRoute(pathname: string) {
  const matchedRoute = Object.keys(ADMIN_ROUTE_PERMISSIONS)
    .sort((left, right) => right.length - left.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  return matchedRoute
    ? ADMIN_ROUTE_PERMISSIONS[
        matchedRoute as keyof typeof ADMIN_ROUTE_PERMISSIONS
      ]
    : null;
}

export function canAccessAdminRoute(
  role: LegacyAdminRole,
  pathname: string
): boolean {
  const requiredPermission = getRequiredPermissionForAdminRoute(pathname);

  return requiredPermission
    ? hasPermissionForRole(role, requiredPermission)
    : false;
}

export function isCanonicalAdminRole(role: string): role is AdminRole {
  return CANONICAL_ADMIN_ROLES.includes(role as CanonicalAdminRole);
}
