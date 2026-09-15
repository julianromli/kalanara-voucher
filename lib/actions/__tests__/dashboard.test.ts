import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  cacheLifeMock,
  cacheTagMock,
  requireAdminPermissionMock,
  hasPermissionForRoleMock,
  rpcMock,
  fromMock,
} = vi.hoisted(() => ({
  cacheLifeMock: vi.fn(),
  cacheTagMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
  hasPermissionForRoleMock: vi.fn(),
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
}));

vi.mock("@/lib/auth/admin-rbac", () => ({
  AdminPermission: {
    DASHBOARD_VIEW_OPERATIONAL: "dashboard.view_operational",
    DASHBOARD_VIEW_BUSINESS: "dashboard.view_business",
    REVIEWS_MANAGE: "reviews.manage",
  },
  hasPermissionForRole: hasPermissionForRoleMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

function limitedQuery(data: unknown[]) {
  const limit = vi.fn().mockResolvedValue({ data, error: null });
  const secondOrder = vi.fn(() => ({ limit }));
  const firstOrder = vi.fn(() => ({ order: secondOrder }));
  const select = vi.fn(() => ({ order: firstOrder }));
  return { select, firstOrder, secondOrder, limit };
}

describe("getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminPermissionMock.mockResolvedValue({ role: "SUPER_ADMIN" });
    hasPermissionForRoleMock.mockReturnValue(true);

    rpcMock.mockResolvedValue({
      data: Array.from({ length: 7 }, (_, index) => ({
        total_revenue: 450000,
        active_vouchers: 2,
        redeemed_vouchers: 3,
        expired_vouchers: 1,
        total_orders: 8,
        total_vouchers: 6,
        total_reviews: 4,
        average_rating: 4.3,
        bucket_date: `2026-04-0${index + 1}`,
        bucket_revenue: index === 6 ? 450000 : 0,
        bucket_orders: index === 6 ? 1 : 0,
      })),
      error: null,
    });
  });

  test("uses the aggregate RPC, exact head count, and bounded recent payloads", async () => {
    const orders = limitedQuery([
      {
        id: "order-1",
        customer_name: "Ayu",
        total_amount: 450000,
        created_at: "2026-04-07T10:00:00.000Z",
        vouchers: { services: { name: "Balinese Massage" } },
      },
    ]);
    const reviews = limitedQuery([
      {
        id: "review-1",
        rating: 5,
        comment: "Mantap",
        customer_name: "Ayu",
      },
    ]);
    const servicesSelect = vi
      .fn()
      .mockResolvedValue({ data: null, count: 9, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "orders") return { select: orders.select };
      if (table === "reviews") return { select: reviews.select };
      if (table === "services") return { select: servicesSelect };
      throw new Error(`Unexpected broad dashboard table read: ${table}`);
    });

    const { getDashboardStats } = await import("@/lib/actions/dashboard");
    const stats = await getDashboardStats();

    expect(rpcMock).toHaveBeenCalledWith("get_admin_dashboard_aggregates");
    expect(servicesSelect).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(orders.limit).toHaveBeenCalledWith(5);
    expect(reviews.limit).toHaveBeenCalledWith(3);
    expect(orders.secondOrder).toHaveBeenCalledWith("id", {
      ascending: false,
    });
    expect(reviews.secondOrder).toHaveBeenCalledWith("id", {
      ascending: false,
    });
    expect(stats).toMatchObject({
      totalRevenue: 450000,
      totalOrders: 8,
      totalServices: 9,
      totalVouchers: 6,
      totalReviews: 4,
      avgRating: 4.3,
    });
    expect(stats.revenueData).toHaveLength(7);
    expect(stats.recentOrders).toHaveLength(1);
    expect(stats.recentReviews).toHaveLength(1);
  });

  test("preserves restricted-role branches while keeping operational counts", async () => {
    requireAdminPermissionMock.mockResolvedValue({ role: "STAFF" });
    hasPermissionForRoleMock.mockReturnValue(false);

    const orders = limitedQuery([
      {
        id: "order-1",
        customer_name: "Ayu",
        created_at: "2026-04-07T10:00:00.000Z",
        vouchers: { services: { name: "Balinese Massage" } },
      },
    ]);
    fromMock.mockImplementation((table: string) => {
      if (table === "orders") return { select: orders.select };
      throw new Error(`Restricted branch queried ${table}`);
    });

    const { getDashboardStats } = await import("@/lib/actions/dashboard");
    const stats = await getDashboardStats();

    expect(stats).toMatchObject({
      canViewBusinessMetrics: false,
      canManageReviews: false,
      totalRevenue: 0,
      totalOrders: 8,
      totalServices: 0,
      totalVouchers: 6,
      totalReviews: 0,
      avgRating: 0,
      revenueData: [],
      recentReviews: [],
    });
    expect(orders.limit).toHaveBeenCalledWith(5);
    expect(stats.recentOrders[0].totalAmount).toBeNull();
  });
});
