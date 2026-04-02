import { beforeEach, describe, expect, test, vi } from "vitest";

const revalidateTagMock = vi.fn();
const createClientMock = vi.fn();
const getAdminClientMock = vi.fn();
const requireAdminPermissionMock = vi.fn();
const logAdminAuditMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
  logAdminAudit: logAdminAuditMock,
}));

describe("review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue({
      userId: "admin-1",
      email: "admin@kalanaraspa.com",
      role: "SUPER_ADMIN",
    });
  });

  test("creates public reviews with the regular server client and revalidates only on success", async () => {
    const voucherSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: "voucher-1",
        code: "KSP-2026-ABCDEFGH",
        recipient_name: "Ayu",
        expiry_date: "2026-12-31T00:00:00.000Z",
        is_redeemed: false,
        amount: 450000,
        services: {
          name: "Balinese Massage",
          duration: 90,
          image_url: null,
        },
      },
      error: null,
    });
    const voucherEqMock = vi.fn(() => ({ single: voucherSingleMock }));
    const voucherSelectMock = vi.fn(() => ({ eq: voucherEqMock }));
    const adminFromMock = vi.fn(() => ({ select: voucherSelectMock }));

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const serverFromMock = vi.fn(() => ({ insert: insertMock }));

    getAdminClientMock.mockReturnValue({ from: adminFromMock });
    createClientMock.mockResolvedValue({ from: serverFromMock });

    const { createPublicReview } = await import("@/lib/actions/reviews");

    const result = await createPublicReview("ksp-2026-abcdefgh", {
      rating: 5,
      comment: "Mantap",
      customer_name: "Ayu",
    });

    expect(result).toEqual({ success: true });
    expect(voucherEqMock).toHaveBeenCalledWith("code", "KSP-2026-ABCDEFGH");
    expect(serverFromMock).toHaveBeenCalledWith("reviews");
    expect(insertMock).toHaveBeenCalledWith({
      voucher_id: "voucher-1",
      rating: 5,
      comment: "Mantap",
      customer_name: "Ayu",
    });
    expect(revalidateTagMock).toHaveBeenCalledWith("dashboard-stats", "max");
  });

  test("does not revalidate dashboard stats when public review creation fails", async () => {
    const voucherSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: "voucher-1",
        code: "KSP-2026-ABCDEFGH",
        recipient_name: "Ayu",
        expiry_date: "2026-12-31T00:00:00.000Z",
        is_redeemed: false,
        amount: 450000,
        services: {
          name: "Balinese Massage",
          duration: 90,
          image_url: null,
        },
      },
      error: null,
    });
    const voucherEqMock = vi.fn(() => ({ single: voucherSingleMock }));
    const voucherSelectMock = vi.fn(() => ({ eq: voucherEqMock }));

    getAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({ select: voucherSelectMock })),
    });
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: { message: "blocked" } }),
      })),
    });

    const { createPublicReview } = await import("@/lib/actions/reviews");

    const result = await createPublicReview("KSP-2026-ABCDEFGH", {
      rating: 4,
      comment: null,
      customer_name: "Ayu",
    });

    expect(result).toEqual({
      success: false,
      error: "Gagal mengirim review. Silakan coba lagi.",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  test("revalidates dashboard stats only after successful review deletion", async () => {
    const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

    getAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({ delete: deleteMock })),
    });

    const { deleteReview } = await import("@/lib/actions/reviews");

    await expect(deleteReview("review-1")).resolves.toBe(true);
    expect(revalidateTagMock).toHaveBeenCalledWith("dashboard-stats", "max");
  });

  test("does not revalidate dashboard stats when review deletion fails", async () => {
    const deleteEqMock = vi.fn().mockResolvedValue({ error: { message: "failed" } });
    const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

    getAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({ delete: deleteMock })),
    });

    const { deleteReview } = await import("@/lib/actions/reviews");

    await expect(deleteReview("review-1")).resolves.toBe(false);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
