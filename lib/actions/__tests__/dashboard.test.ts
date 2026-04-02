import { beforeEach, describe, expect, test, vi } from "vitest";

const cacheLifeMock = vi.fn();
const cacheTagMock = vi.fn();
const requireAdminPermissionMock = vi.fn();
const hasPermissionForRoleMock = vi.fn();

const ordersOrderMock = vi.fn();
const ordersSelectMock = vi.fn(() => ({
  order: ordersOrderMock,
}));

const vouchersSelectMock = vi.fn();
const reviewsOrderMock = vi.fn();
const reviewsSelectMock = vi.fn(() => ({
  order: reviewsOrderMock,
}));
const servicesSelectMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "orders") {
    return { select: ordersSelectMock };
  }

  if (table === "vouchers") {
    return { select: vouchersSelectMock };
  }

  if (table === "reviews") {
    return { select: reviewsSelectMock };
  }

  if (table === "services") {
    return { select: servicesSelectMock };
  }

  throw new Error(`Unexpected table ${table}`);
});

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
  getAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

describe("getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminPermissionMock.mockResolvedValue({ role: "SUPER_ADMIN" });
    hasPermissionForRoleMock.mockImplementation((_role, permission) => permission !== "reviews.manage");

    ordersOrderMock.mockResolvedValue({
      data: [
        {
          id: "order-completed",
          customer_name: "Ayu",
          total_amount: 450000,
          created_at: "2026-04-01T10:00:00.000Z",
          payment_status: "COMPLETED",
          vouchers: { services: { name: "Balinese Massage", duration: 90 } },
        },
        {
          id: "order-pending",
          customer_name: "Bima",
          total_amount: 300000,
          created_at: "2026-04-01T12:00:00.000Z",
          payment_status: "PENDING",
          vouchers: { services: { name: "Facial", duration: 60 } },
        },
      ],
      error: null,
    });

    vouchersSelectMock.mockResolvedValue({ data: [], error: null });
    reviewsOrderMock.mockResolvedValue({ data: [], error: null });
    servicesSelectMock.mockResolvedValue({ data: [], count: 0, error: null });
  });

  test("counts only completed orders for revenue metrics while preserving total orders", async () => {
    const { getDashboardStats } = await import("@/lib/actions/dashboard");

    const stats = await getDashboardStats();

    expect(stats.totalOrders).toBe(2);
    expect(stats.totalRevenue).toBe(450000);
    expect(stats.revenueData.some((entry) => entry.revenue === 450000 && entry.orders === 1)).toBe(
      true
    );
    expect(stats.revenueData.some((entry) => entry.revenue === 300000)).toBe(false);
  });
});
