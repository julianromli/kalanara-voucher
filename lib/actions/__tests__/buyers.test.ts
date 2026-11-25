import { beforeEach, describe, expect, test, vi } from "vitest";

const { requireAdminPermissionMock, getAdminClientMock } = vi.hoisted(() => ({
  requireAdminPermissionMock: vi.fn(),
  getAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

import { getBuyerOrders, getBuyersPage } from "@/lib/actions/buyers";
import { AdminPermission } from "@/lib/auth/admin-rbac";

const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const access = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "kasir@kalanaraspa.com",
  role: "STAFF" as const,
};

describe("getBuyersPage member match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue(access);
  });

  test("attaches a member link when the normalized phone matches", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          phone: "6281234564471",
          customer_name: "Rina Maharani",
          customer_email: "rina@example.com",
          order_count: 2,
          voucher_count: 2,
          last_order_at: "2026-11-20T04:00:00Z",
          other_names: [],
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "members") {
        return {
          select: vi.fn(() => ({
            order: () => ({
              range: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: MEMBER_ID,
                    phone: "6281234564471",
                    member_code: "7KQ2X9",
                    cycle_start: "2026-01-10",
                    base_tier: 1,
                  },
                ],
                error: null,
              }),
            }),
          })),
        };
      }
      if (table === "member_stamps") {
        return {
          select: vi.fn(() => ({
            order: () => ({
              range: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "55555555-5555-4555-8555-555555555555",
                    member_id: MEMBER_ID,
                    cycle_start: "2026-01-10",
                    visit_date: "2026-02-01",
                    created_at: "2026-02-01T04:00:00Z",
                    voided_at: null,
                  },
                ],
                error: null,
              }),
            }),
          })),
        };
      }
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    getAdminClientMock.mockReturnValue({ rpc, from });

    const page = await getBuyersPage({ page: 1, query: "", filter: "ALL" });
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.ORDERS_VIEW);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.member).toEqual({
      id: MEMBER_ID,
      memberCode: "7KQ2X9",
      effectiveTier: 1,
    });
  });

  test("throws when the member lookup fails instead of hiding every badge", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          phone: "6281234564471",
          customer_name: "Rina Maharani",
          customer_email: "rina@example.com",
          order_count: 1,
          voucher_count: 1,
          last_order_at: "2026-11-20T04:00:00Z",
          other_names: [],
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "members") {
        return {
          select: vi.fn(() => ({
            order: () => ({
              range: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "members unavailable" },
              }),
            }),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          order: () => ({
            range: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })),
      };
    });
    getAdminClientMock.mockReturnValue({ rpc, from });
    await expect(getBuyersPage({ page: 1, query: "", filter: "ALL" })).rejects.toEqual({
      message: "members unavailable",
    });
  });
});

describe("getBuyerOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue(access);
  });

  test("returns no rows when the buyer has not purchased", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    getAdminClientMock.mockReturnValue({ rpc, from: vi.fn() });
    await expect(getBuyerOrders("6281234564471")).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith("list_admin_buyer_orders", {
      buyer_phone: "6281234564471",
    });
  });

  test("returns purchaser orders newest first", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "old-order" }, { id: "new-order" }],
      error: null,
    });
    const inFn = vi.fn().mockResolvedValue({
      data: [
        { id: "old-order", created_at: "2026-10-02T04:00:00Z", total_amount: 1, order_items: [], vouchers: null },
        { id: "new-order", created_at: "2026-11-20T04:00:00Z", total_amount: 2, order_items: [], vouchers: null },
      ],
      error: null,
    });
    getAdminClientMock.mockReturnValue({
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({ in: inFn })),
      })),
    });
    const orders = await getBuyerOrders("081234564471");
    expect(rpc).toHaveBeenCalledWith("list_admin_buyer_orders", {
      buyer_phone: "6281234564471",
    });
    expect(orders.map((order) => order.id)).toEqual(["new-order", "old-order"]);
  });
});
