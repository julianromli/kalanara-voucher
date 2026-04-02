import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdminPermission, getPermissionsForRole, hasPermissionForRole } from "@/lib/auth/admin-rbac";

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

vi.mock("@/lib/scalev/mappers", () => ({
  mapScalevPaymentMethodToLocal: vi.fn(() => "BANK_TRANSFER"),
}));

describe("destructive order permissions", () => {
  test("grants hard delete permission only to super admin", () => {
    expect(hasPermissionForRole("SUPER_ADMIN", AdminPermission.ORDERS_DELETE_HARD)).toBe(true);
    expect(hasPermissionForRole("MANAGER", AdminPermission.ORDERS_DELETE_HARD)).toBe(false);
    expect(hasPermissionForRole("STAFF", AdminPermission.ORDERS_DELETE_HARD)).toBe(false);
    expect(getPermissionsForRole("SUPER_ADMIN")).toContain(AdminPermission.ORDERS_DELETE_HARD);
  });
});

describe("destructive order actions", () => {
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
          message: "Pembelian berhasil dihapus permanen.",
          deleted_order_count: 1,
          deleted_voucher_count: 2,
          deleted_review_count: 2,
          deleted_webhook_event_count: 1,
        },
      ],
      error: null,
    });
  });

  test("deleteOrderHard calls transactional RPC and audits success", async () => {
    const { deleteOrderHard } = await import("@/lib/actions/orders");

    const result = await deleteOrderHard("order-1");

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.ORDERS_DELETE_HARD);
    expect(rpcMock).toHaveBeenCalledWith("hard_delete_orders", {
      order_ids: ["order-1"],
    });
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "order.hard_delete",
        target: "order-1",
        details: expect.objectContaining({
          deletedOrderCount: 1,
          deletedVoucherCount: 2,
          deletedReviewCount: 2,
          deletedWebhookEventCount: 1,
        }),
      })
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("dashboard-stats", "max");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/purchases", "page");
    expect(result).toEqual({
      success: true,
      message: "Pembelian berhasil dihapus permanen.",
      deletedOrderCount: 1,
      deletedVoucherCount: 2,
      deletedReviewCount: 2,
      deletedWebhookEventCount: 1,
    });
  });

  test("clearAllOrdersHard calls transactional RPC with null payload and audits success", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          success: true,
          message: "2 pembelian berhasil dihapus permanen.",
          deleted_order_count: 2,
          deleted_voucher_count: 2,
          deleted_review_count: 2,
          deleted_webhook_event_count: 1,
        },
      ],
      error: null,
    });

    const { clearAllOrdersHard } = await import("@/lib/actions/orders");

    const result = await clearAllOrdersHard();

    expect(rpcMock).toHaveBeenCalledWith("hard_delete_orders", {
      order_ids: null,
    });
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "order.hard_delete_all",
        details: expect.objectContaining({
          deletedOrderCount: 2,
          deletedVoucherCount: 2,
          deletedReviewCount: 2,
          deletedWebhookEventCount: 1,
        }),
      })
    );
    expect(result.deletedOrderCount).toBe(2);
  });

  test("returns structured conflict failure and skips audit when rpc rejects single-delete scope", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          success: false,
          message: "Pembelian ini tidak dapat dihapus permanen karena voucher terkait masih dipakai pembelian lain.",
          deleted_order_count: 0,
          deleted_voucher_count: 0,
          deleted_review_count: 0,
          deleted_webhook_event_count: 0,
        },
      ],
      error: null,
    });

    const { deleteOrderHard } = await import("@/lib/actions/orders");

    const result = await deleteOrderHard("order-1");

    expect(result).toEqual({
      success: false,
      message: "Pembelian ini tidak dapat dihapus permanen karena voucher terkait masih dipakai pembelian lain.",
      deletedOrderCount: 0,
      deletedVoucherCount: 0,
      deletedReviewCount: 0,
      deletedWebhookEventCount: 0,
    });
    expect(logAdminAuditMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  test("returns migration guidance when transactional function is missing", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message: "Function not found",
      },
    });

    const { clearAllOrdersHard } = await import("@/lib/actions/orders");

    const result = await clearAllOrdersHard();

    expect(result).toEqual({
      success: false,
      message:
        "Fungsi penghapusan permanen belum tersedia di database. Jalankan migration terbaru terlebih dahulu.",
      deletedOrderCount: 0,
      deletedVoucherCount: 0,
      deletedReviewCount: 0,
      deletedWebhookEventCount: 0,
    });
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });
});
