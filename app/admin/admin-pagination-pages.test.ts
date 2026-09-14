import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getOrdersPageMock,
  getOrdersTotalCountMock,
  getVouchersPageMock,
  getVoucherAdminSummaryMock,
  getAdminReviewsPageMock,
  requireAdminRouteAccessMock,
} = vi.hoisted(() => ({
  getOrdersPageMock: vi.fn(),
  getOrdersTotalCountMock: vi.fn(),
  getVouchersPageMock: vi.fn(),
  getVoucherAdminSummaryMock: vi.fn(),
  getAdminReviewsPageMock: vi.fn(),
  requireAdminRouteAccessMock: vi.fn(),
}));

vi.mock("@/components/admin/purchases-client", () => ({
  PurchasesClient: vi.fn(),
}));
vi.mock("@/components/admin/vouchers-client", () => ({
  VouchersClient: vi.fn(),
}));
vi.mock("@/components/admin/reviews-client", () => ({
  ReviewsClient: vi.fn(),
}));
vi.mock("@/lib/actions/orders", () => ({
  getOrdersPage: getOrdersPageMock,
  getOrdersTotalCount: getOrdersTotalCountMock,
}));
vi.mock("@/lib/actions/vouchers", () => ({
  getVouchersPage: getVouchersPageMock,
  getVoucherAdminSummary: getVoucherAdminSummaryMock,
}));
vi.mock("@/lib/actions/reviews", () => ({
  getAdminReviewsPage: getAdminReviewsPageMock,
}));
vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminRouteAccess: requireAdminRouteAccessMock,
}));

const emptyPage = {
  rows: [],
  page: 1,
  pageSize: 25,
  totalCount: 0,
  totalPages: 1,
};

describe("paginated admin page wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminRouteAccessMock.mockResolvedValue({ role: "SUPER_ADMIN" });
    getOrdersPageMock.mockResolvedValue(emptyPage);
    getOrdersTotalCountMock.mockResolvedValue(41);
    getVouchersPageMock.mockResolvedValue(emptyPage);
    getVoucherAdminSummaryMock.mockResolvedValue({
      active: 3,
      redeemed: 2,
      expired: 1,
    });
    getAdminReviewsPageMock.mockResolvedValue(emptyPage);
  });

  test("passes the purchases action results to the client, including the unfiltered total", async () => {
    const { default: AdminPurchasesPage } = await import(
      "@/app/admin/(protected)/purchases/page"
    );
    const result = (await AdminPurchasesPage({
      searchParams: Promise.resolve({
        page: ["2", "9"],
        query: ["ayu", "ignored"],
        status: ["completed", "PENDING"],
      }),
    })) as ReactElement<Record<string, unknown>>;

    expect(requireAdminRouteAccessMock).toHaveBeenCalledOnce();
    expect(requireAdminRouteAccessMock).toHaveBeenCalledWith("/admin/purchases");
    expect(getOrdersPageMock).toHaveBeenCalledWith({
      page: 2,
      query: "ayu",
      filter: "COMPLETED",
    });
    expect(result.props).toMatchObject({
      initialPage: emptyPage,
      initialTotalCount: 41,
      initialQuery: "ayu",
      initialFilter: "COMPLETED",
    });
  });

  test("passes voucher page and global summary action results to the client", async () => {
    const { default: AdminVouchersPage } = await import(
      "@/app/admin/(protected)/vouchers/page"
    );
    const result = (await AdminVouchersPage({
      searchParams: Promise.resolve({ status: "ACTIVE" }),
    })) as ReactElement<Record<string, unknown>>;

    expect(requireAdminRouteAccessMock).toHaveBeenCalledOnce();
    expect(requireAdminRouteAccessMock).toHaveBeenCalledWith("/admin/vouchers");
    expect(result.props).toMatchObject({
      initialPage: emptyPage,
      initialSummary: { active: 3, redeemed: 2, expired: 1 },
      initialFilter: "ACTIVE",
    });
  });

  test("passes the review action result to the client", async () => {
    const { default: AdminReviewsPage } = await import(
      "@/app/admin/(protected)/reviews/page"
    );
    const result = (await AdminReviewsPage({
      searchParams: Promise.resolve({ rating: "5" }),
    })) as ReactElement<Record<string, unknown>>;

    expect(requireAdminRouteAccessMock).toHaveBeenCalledOnce();
    expect(requireAdminRouteAccessMock).toHaveBeenCalledWith("/admin/reviews");
    expect(result.props).toMatchObject({
      initialPage: emptyPage,
      initialFilter: "5",
    });
  });
});
