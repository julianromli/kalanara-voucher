import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdminPermission } from "@/lib/auth/admin-rbac";

const { requireAdminPermissionMock, getAdminClientMock } = vi.hoisted(() => ({
  requireAdminPermissionMock: vi.fn(),
  getAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
  logAdminAudit: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

function createQueryResult(data: unknown[] = [], count = 0) {
  const calls = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    range: vi.fn(),
  };
  const builder = {
    select: calls.select,
    order: calls.order,
    eq: calls.eq,
    gt: calls.gt,
    lte: calls.lte,
    or: calls.or,
    range: calls.range,
  };

  for (const method of [
    calls.select,
    calls.order,
    calls.eq,
    calls.gt,
    calls.lte,
    calls.or,
  ]) {
    method.mockReturnValue(builder);
  }
  calls.range.mockResolvedValue({ data, count, error: null });

  getAdminClientMock.mockReturnValue({
    from: vi.fn(() => builder),
  });

  return calls;
}

function createHeadCountResult(count: number) {
  const calls = {
    select: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    lte: vi.fn(),
  };
  const builder = Object.assign(
    Promise.resolve({ data: null, count, error: null }),
    calls,
  );

  calls.select.mockReturnValue(builder);
  calls.eq.mockReturnValue(builder);
  calls.gt.mockReturnValue(builder);
  calls.lte.mockReturnValue(builder);

  return { builder, calls };
}

describe("paginated admin list actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue({
      userId: "admin-1",
      email: "admin@example.com",
      role: "SUPER_ADMIN",
    });
  });

  test("orders use a narrow exact-count range with validated filters and escaped search", async () => {
    const calls = createQueryResult([{ id: "order-26" }], 26);
    const { getOrdersPage } = await import("@/lib/actions/orders");

    const result = await getOrdersPage({
      page: 2,
      query: "ayu%,(vip)",
      filter: "COMPLETED",
    });

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.ORDERS_VIEW,
    );
    expect(calls.select).toHaveBeenCalledWith(
      expect.not.stringContaining("*"),
      { count: "exact" },
    );
    expect(calls.order).toHaveBeenNthCalledWith(1, "created_at", {
      ascending: false,
    });
    expect(calls.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
    expect(calls.eq).toHaveBeenCalledWith("payment_status", "COMPLETED");
    expect(calls.or).toHaveBeenCalledWith(
      expect.stringContaining(String.raw`ayu\%\,\(vip\)`),
    );
    expect(calls.range).toHaveBeenCalledWith(25, 49);
    expect(result).toMatchObject({
      rows: [{ id: "order-26" }],
      page: 2,
      pageSize: 25,
      totalCount: 26,
      totalPages: 2,
    });
  });

  test("voucher ACTIVE status is filtered in the database", async () => {
    const calls = createQueryResult([], 0);
    const { getVouchersPage } = await import("@/lib/actions/vouchers");

    await getVouchersPage({
      page: 1,
      query: "",
      filter: "ACTIVE",
    });

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.VOUCHERS_MANAGE,
    );
    expect(calls.select).toHaveBeenCalledWith(
      expect.not.stringContaining("*"),
      { count: "exact" },
    );
    expect(calls.eq).toHaveBeenCalledWith("is_redeemed", false);
    expect(calls.gt).toHaveBeenCalledWith("expiry_date", expect.any(String));
    expect(calls.range).toHaveBeenCalledWith(0, 24);
  });

  test("voucher summary uses three global exact head counts without row payloads", async () => {
    const active = createHeadCountResult(31);
    const redeemed = createHeadCountResult(17);
    const expired = createHeadCountResult(9);
    const builders = [active.builder, redeemed.builder, expired.builder];
    const from = vi.fn(() => {
      const builder = builders.shift();
      if (!builder) {
        throw new Error("Unexpected voucher summary query");
      }
      return builder;
    });
    getAdminClientMock.mockReturnValue({ from });

    const { getVoucherAdminSummary } = await import("@/lib/actions/vouchers");
    const result = await getVoucherAdminSummary();

    expect(result).toEqual({ active: 31, redeemed: 17, expired: 9 });
    expect(from).toHaveBeenCalledTimes(3);
    for (const query of [active, redeemed, expired]) {
      expect(query.calls.select).toHaveBeenCalledWith("id", {
        count: "exact",
        head: true,
      });
    }
    expect(active.calls.eq).toHaveBeenCalledWith("is_redeemed", false);
    expect(active.calls.gt).toHaveBeenCalledWith(
      "expiry_date",
      expect.any(String),
    );
    expect(redeemed.calls.eq).toHaveBeenCalledWith("is_redeemed", true);
    expect(expired.calls.eq).toHaveBeenCalledWith("is_redeemed", false);
    expect(expired.calls.lte).toHaveBeenCalledWith(
      "expiry_date",
      expect.any(String),
    );
  });

  test("reviews validate rating and return an empty clamped page without fallback", async () => {
    const calls = createQueryResult([], 0);
    const { getAdminReviewsPage } = await import("@/lib/actions/reviews");

    const result = await getAdminReviewsPage({
      page: 7,
      query: "",
      filter: "5",
    });

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.REVIEWS_MANAGE,
    );
    expect(calls.select).toHaveBeenCalledWith(
      "id, rating, comment, customer_name",
      { count: "exact" },
    );
    expect(calls.eq).toHaveBeenCalledWith("rating", 5);
    expect(calls.range).toHaveBeenCalledWith(150, 174);
    expect(result).toEqual({
      rows: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 1,
    });
  });

  test("re-ranges to the last valid page when a mutation empties the requested page", async () => {
    const calls = createQueryResult();
    calls.range
      .mockResolvedValueOnce({ data: [], count: 26, error: null })
      .mockResolvedValueOnce({
        data: [{ id: "order-26" }],
        count: 26,
        error: null,
      });
    const { getOrdersPage } = await import("@/lib/actions/orders");

    const result = await getOrdersPage({
      page: 3,
      query: "",
      filter: "ALL",
    });

    expect(calls.range).toHaveBeenNthCalledWith(1, 50, 74);
    expect(calls.range).toHaveBeenNthCalledWith(2, 25, 49);
    expect(result).toMatchObject({
      rows: [{ id: "order-26" }],
      page: 2,
      totalCount: 26,
      totalPages: 2,
    });
  });
});
