import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdminPermission } from "@/lib/auth/admin-rbac";

const {
  requireAdminPermissionMock,
  logAdminAuditMock,
  revalidateTagMock,
  revalidatePathMock,
  rpcMock,
  fromMock,
  orderSingleMock,
  orderItemSingleMock,
  existingVoucherSingleMock,
  voucherInsertMock,
  voucherInsertSingleMock,
  linkEqMock,
} = vi.hoisted(() => ({
  requireAdminPermissionMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  orderSingleMock: vi.fn(),
  orderItemSingleMock: vi.fn(),
  existingVoucherSingleMock: vi.fn(),
  voucherInsertMock: vi.fn(),
  voucherInsertSingleMock: vi.fn(),
  linkEqMock: vi.fn(),
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
    from: fromMock,
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
    fromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: orderSingleMock })),
          })),
        };
      }

      if (table === "order_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: orderItemSingleMock })),
          })),
          update: vi.fn(() => ({ eq: linkEqMock })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: existingVoucherSingleMock })),
        })),
        insert: voucherInsertMock,
      };
    });
    voucherInsertMock.mockImplementation(() => ({
          select: vi.fn(() => ({ single: voucherInsertSingleMock })),
    }));
    linkEqMock.mockReturnValue({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "item-1" },
          error: null,
        }),
      })),
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

  test("does not expose unrestricted voucher creation as a Server Action", async () => {
    const voucherActions = await import("@/lib/actions/vouchers");

    expect(voucherActions).not.toHaveProperty("createVoucher");
  });

  test("creates paid-item vouchers only from authoritative completed-order data", async () => {
    orderSingleMock.mockResolvedValue({
      data: {
        id: "order-1",
        payment_status: "COMPLETED",
        customer_name: "Faiz",
        customer_email: "buyer@example.com",
      },
      error: null,
    });
    orderItemSingleMock.mockResolvedValue({
      data: {
        id: "item-1",
        order_id: "order-1",
        service_id: "service-1",
        recipient_name: "Ayu",
        recipient_email: "ayu@example.com",
        sender_message: "Selamat menikmati",
        unit_price: 405000,
        voucher_id: null,
      },
      error: null,
    });
    existingVoucherSingleMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    });
    voucherInsertSingleMock.mockResolvedValue({
      data: { id: "voucher-1", code: "KSP-2026-ABCDEFGH" },
      error: null,
    });
    const { createVoucherForPaidOrderItem } = await import(
      "@/lib/payment/voucher-writes"
    );
    const voucher = await Reflect.apply(createVoucherForPaidOrderItem, null, [
      "order-1",
      "item-1",
      {
        amount: 1,
        payment_status: "PENDING",
        voucher_id: "foreign-voucher",
        service_id: "foreign-service",
      },
    ]);

    expect(voucher).toEqual({
      id: "voucher-1",
      code: "KSP-2026-ABCDEFGH",
    });
    expect(voucherInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source_order_item_id: "item-1",
        service_id: "service-1",
        amount: 405000,
        is_redeemed: false,
      })
    );
  });
});
