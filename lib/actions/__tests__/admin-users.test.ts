import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createUserMock,
  inviteUserByEmailMock,
  updateUserByIdMock,
  deleteUserMock,
  maybeSingleMock,
  insertSingleMock,
  logAdminAuditMock,
  requireAdminPermissionMock,
} = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  inviteUserByEmailMock: vi.fn(),
  updateUserByIdMock: vi.fn(),
  deleteUserMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  insertSingleMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  logAdminAudit: logAdminAuditMock,
  requireAdminPermission: requireAdminPermissionMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    auth: {
      admin: {
        createUser: createUserMock,
        inviteUserByEmail: inviteUserByEmailMock,
        updateUserById: updateUserByIdMock,
        deleteUser: deleteUserMock,
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: maybeSingleMock,
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: insertSingleMock,
        })),
      })),
    })),
  }),
}));

import { createAdminUser } from "../admin-users";

describe("createAdminUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://voucher.kalanaraspa.com";

    requireAdminPermissionMock.mockResolvedValue({
      userId: "super-admin-id",
      email: "owner@kalanaraspa.com",
      role: "SUPER_ADMIN",
    });

    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    updateUserByIdMock.mockResolvedValue({ error: null });
    deleteUserMock.mockResolvedValue({ error: null });
  });

  test("sends Supabase invite email for invite onboarding", async () => {
    inviteUserByEmailMock.mockResolvedValue({
      data: { user: { id: "auth-user-id" } },
      error: null,
    });
    insertSingleMock.mockResolvedValue({
      data: {
        id: "auth-user-id",
        email: "invite-admin@test.com",
        name: "Invite Admin",
        role: "MANAGER",
        created_at: "2026-03-10T00:00:00.000Z",
      },
      error: null,
    });

    const result = await createAdminUser({
      email: "invite-admin@test.com",
      name: "Invite Admin",
      role: "MANAGER",
      onboardingMode: "invite",
    });

    expect(inviteUserByEmailMock).toHaveBeenCalledWith("invite-admin@test.com", {
      data: {
        name: "Invite Admin",
        role: "MANAGER",
      },
      redirectTo: "https://voucher.kalanaraspa.com/auth/callback",
    });
    expect(createUserMock).not.toHaveBeenCalled();
    expect(result.onboardingMode).toBe("invite");
    expect(result.admin.email).toBe("invite-admin@test.com");
  });

  test("creates a manual password user when manual onboarding is selected", async () => {
    createUserMock.mockResolvedValue({
      data: { user: { id: "manual-auth-user" } },
      error: null,
    });
    insertSingleMock.mockResolvedValue({
      data: {
        id: "manual-auth-user",
        email: "manual-admin@test.com",
        name: "Manual Admin",
        role: "STAFF",
        created_at: "2026-03-10T00:00:00.000Z",
      },
      error: null,
    });

    const result = await createAdminUser({
      email: "manual-admin@test.com",
      name: "Manual Admin",
      role: "STAFF",
      onboardingMode: "manual",
      password: "Supabase123!",
      confirmPassword: "Supabase123!",
    });

    expect(createUserMock).toHaveBeenCalledWith({
      email: "manual-admin@test.com",
      password: "Supabase123!",
      email_confirm: true,
      user_metadata: {
        name: "Manual Admin",
        role: "STAFF",
      },
    });
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(result.onboardingMode).toBe("manual");
  });

  test("rejects duplicate admin emails before creating auth users", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "existing-admin" },
      error: null,
    });

    await expect(
      createAdminUser({
        email: "existing-admin@test.com",
        name: "Existing Admin",
        role: "MANAGER",
        onboardingMode: "invite",
      })
    ).rejects.toThrow("Email tersebut sudah terdaftar sebagai admin.");

    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(createUserMock).not.toHaveBeenCalled();
  });

  test("rejects mismatched manual passwords before hitting Supabase Auth", async () => {
    await expect(
      createAdminUser({
        email: "manual-admin@test.com",
        name: "Manual Admin",
        role: "STAFF",
        onboardingMode: "manual",
        password: "Supabase123!",
        confirmPassword: "Supabase321!",
      })
    ).rejects.toThrow("Konfirmasi password admin tidak cocok.");

    expect(createUserMock).not.toHaveBeenCalled();
  });

  test("cleans up auth user when admin insert fails", async () => {
    createUserMock.mockResolvedValue({
      data: { user: { id: "cleanup-auth-user" } },
      error: null,
    });
    insertSingleMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });

    await expect(
      createAdminUser({
        email: "cleanup-admin@test.com",
        name: "Cleanup Admin",
        role: "MANAGER",
        onboardingMode: "manual",
        password: "Supabase123!",
        confirmPassword: "Supabase123!",
      })
    ).rejects.toThrow("Email tersebut sudah terdaftar sebagai admin.");

    expect(deleteUserMock).toHaveBeenCalledWith("cleanup-auth-user");
  });
});
