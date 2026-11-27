import { describe, expect, test } from "vitest";
import {
  AdminPermission,
  canAccessAdminRoute,
  getRequiredPermissionForAdminRoute,
  hasPermissionForRole,
} from "@/lib/auth/admin-rbac";

describe("membership admin access", () => {
  test("lets staff open the cashier and follow-up routes", () => {
    expect(hasPermissionForRole("STAFF", AdminPermission.MEMBERS_OPERATE)).toBe(
      true,
    );
    expect(
      hasPermissionForRole("STAFF", AdminPermission.MEMBERS_SETTINGS),
    ).toBe(false);
    expect(canAccessAdminRoute("STAFF", "/admin/members")).toBe(true);
    expect(canAccessAdminRoute("STAFF", "/admin/members/follow-up")).toBe(true);
    expect(canAccessAdminRoute("STAFF", "/admin/members/settings")).toBe(false);
  });

  test("lets a manager open member settings", () => {
    expect(canAccessAdminRoute("MANAGER", "/admin/members")).toBe(true);
    expect(canAccessAdminRoute("MANAGER", "/admin/members/follow-up")).toBe(
      true,
    );
    expect(canAccessAdminRoute("MANAGER", "/admin/members/settings")).toBe(true);
    expect(canAccessAdminRoute("MANAGER", "/admin/members/settings/poster")).toBe(
      true,
    );
  });

  test("matches the longer member route first", () => {
    expect(getRequiredPermissionForAdminRoute("/admin/members/settings")).toBe(
      AdminPermission.MEMBERS_SETTINGS,
    );
    expect(getRequiredPermissionForAdminRoute("/admin/members")).toBe(
      AdminPermission.MEMBERS_OPERATE,
    );
  });
});

describe("voucher resend access", () => {
  test.each(["STAFF", "MANAGER", "SUPER_ADMIN", "ADMIN"] as const)(
    "lets %s resend a voucher",
    (role) => {
      expect(hasPermissionForRole(role, AdminPermission.ORDERS_RESEND_VOUCHER)).toBe(true);
    },
  );
});
