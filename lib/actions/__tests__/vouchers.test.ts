import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdminPermission } from "@/lib/auth/admin-rbac";

const {
  requireAdminPermissionMock,
  logAdminAuditMock,
  revalidateTagMock,
  revalidatePathMock,
  rpcMock,
} = vi.hoisted(() => ({
  requireAdminPermissionMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
  logAdminAudit: logAdminAuditMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    rpc: rpcMock,
  }),
}));

describe("voucher destructive actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminPermissionMock.mockResolvedValue({
      userId: "super-admin-id",
      email: "owner@kalanaraspa.com",
      role: "SUPER_ADMIN",
    });

    rpcMock.mockResolvedValue({
      data: [
        {
          success: true,
          message: "Voucher berhasil dihapus permanen.",
          detached_order_count: 1,
          deleted_review_count: 1,
          deleted_voucher_count: 1,
        },
      ],
      error: null,
    });
  });

  test("deleteVoucher calls transactional RPC, revalidates surfaces, and audits success", async () => {
    const { deleteVoucher } = await import("@/lib/actions/vouchers");

    const result = await deleteVoucher("voucher-1");

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.VOUCHERS_MANAGE
    );
    expect(rpcMock).toHaveBeenCalledWith("hard_delete_voucher", {
      target_voucher_id: "voucher-1",
    });
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "voucher.hard_delete",
        target: "voucher-1",
        details: {
          detachedOrderCount: 1,
          deletedReviewCount: 1,
          deletedVoucherCount: 1,
        },
      })
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("dashboard-stats", "max");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/vouchers", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/purchases", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/review/[id]", "page");
    expect(result).toEqual({
      success: true,
      message: "Voucher berhasil dihapus permanen.",
      detachedOrderCount: 1,
      deletedReviewCount: 1,
      deletedVoucherCount: 1,
    });
  });

  test("returns migration guidance and skips audit when the database function is missing", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message: "Function not found",
      },
    });

    const { deleteVoucher } = await import("@/lib/actions/vouchers");

    const result = await deleteVoucher("voucher-1");

    expect(result).toEqual({
      success: false,
      message:
        "Fungsi penghapusan voucher permanen belum tersedia di database. Jalankan migration terbaru terlebih dahulu.",
      detachedOrderCount: 0,
      deletedReviewCount: 0,
      deletedVoucherCount: 0,
    });
    expect(logAdminAuditMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("returns structured failures from the rpc without auditing", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          success: false,
          message: "Voucher tidak ditemukan.",
          detached_order_count: 0,
          deleted_review_count: 0,
          deleted_voucher_count: 0,
        },
      ],
      error: null,
    });

    const { deleteVoucher } = await import("@/lib/actions/vouchers");

    const result = await deleteVoucher("voucher-404");

    expect(result).toEqual({
      success: false,
      message: "Voucher tidak ditemukan.",
      detachedOrderCount: 0,
      deletedReviewCount: 0,
      deletedVoucherCount: 0,
    });
    expect(logAdminAuditMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
