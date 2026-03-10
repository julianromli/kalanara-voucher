import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createUserMock,
  inviteUserByEmailMock,
  updateUserByIdMock,
  deleteUserMock,
  maybeSingleMock,
  selectSingleMock,
  insertSingleMock,
  updateSingleMock,
  logAdminAuditMock,
  requireAdminPermissionMock,
} = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  inviteUserByEmailMock: vi.fn(),
  updateUserByIdMock: vi.fn(),
  deleteUserMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  selectSingleMock: vi.fn(),
  insertSingleMock: vi.fn(),
  updateSingleMock: vi.fn(),
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
          single: selectSingleMock,
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: insertSingleMock,
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: updateSingleMock,
          })),
        })),
      })),
    })),
  }),
}));

import { createAdminUser, updateAdminUserProfile } from "../admin-users";

const existingAdmin = {
  id: "admin-id",
  email: "admin@test.com",
  name: "Admin Lama",
  role: "MANAGER",
  created_at: "2026-03-10T00:00:00.000Z",
} as const;

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

describe("updateAdminUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminPermissionMock.mockResolvedValue({
      userId: "super-admin-id",
      email: "owner@kalanaraspa.com",
      role: "SUPER_ADMIN",
    });

    selectSingleMock.mockResolvedValue({ data: existingAdmin, error: null });
    updateSingleMock.mockResolvedValue({
      data: { ...existingAdmin, name: "Admin Baru" },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ error: null });
  });

  test("updates name only and syncs auth metadata", async () => {
    const result = await updateAdminUserProfile({
      id: existingAdmin.id,
      name: "Admin Baru",
    });

    expect(updateUserByIdMock).toHaveBeenCalledWith(existingAdmin.id, {
      user_metadata: {
        name: "Admin Baru",
        role: existingAdmin.role,
      },
    });
    expect(result.name).toBe("Admin Baru");
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "admin_user.profile_update",
        details: expect.objectContaining({ passwordChanged: false }),
      })
    );
  });

  test("updates name and password for emergency reset", async () => {
    await updateAdminUserProfile({
      id: existingAdmin.id,
      name: "Admin Baru",
      password: "Supabase123!",
      confirmPassword: "Supabase123!",
    });

    expect(updateUserByIdMock).toHaveBeenCalledWith(existingAdmin.id, {
      password: "Supabase123!",
      user_metadata: {
        name: "Admin Baru",
        role: existingAdmin.role,
      },
    });
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "admin_user.profile_update",
        details: expect.objectContaining({ passwordChanged: true }),
      })
    );
  });

  test("rejects blank names", async () => {
    await expect(
      updateAdminUserProfile({
        id: existingAdmin.id,
        name: "   ",
      })
    ).rejects.toThrow("Nama admin wajib diisi.");

    expect(updateSingleMock).not.toHaveBeenCalled();
  });

  test("rejects short passwords", async () => {
    await expect(
      updateAdminUserProfile({
        id: existingAdmin.id,
        name: "Admin Baru",
        password: "short",
        confirmPassword: "short",
      })
    ).rejects.toThrow("Password admin minimal 8 karakter.");

    expect(updateSingleMock).not.toHaveBeenCalled();
  });

  test("rejects mismatched confirmation", async () => {
    await expect(
      updateAdminUserProfile({
        id: existingAdmin.id,
        name: "Admin Baru",
        password: "Supabase123!",
        confirmPassword: "Supabase321!",
      })
    ).rejects.toThrow("Konfirmasi password admin tidak cocok.");

    expect(updateSingleMock).not.toHaveBeenCalled();
  });

  test("handles missing target admin", async () => {
    selectSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "row not found" },
    });

    await expect(
      updateAdminUserProfile({
        id: "missing-admin",
        name: "Admin Baru",
      })
    ).rejects.toThrow("Admin tidak ditemukan.");
  });

  test("surfaces auth sync failures as failed results", async () => {
    updateUserByIdMock.mockResolvedValueOnce({
      error: { message: "auth sync failed" },
    });

    await expect(
      updateAdminUserProfile({
        id: existingAdmin.id,
        name: "Admin Baru",
      })
    ).rejects.toThrow(
      "Profil admin sudah diperbarui, tetapi sinkronisasi akun login gagal. Hubungi tim teknis untuk tindak lanjut manual."
    );

    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "admin_user.profile_update_failed",
        details: expect.objectContaining({ passwordChanged: false, reason: "auth_sync_failed" }),
      })
    );
  });
});
