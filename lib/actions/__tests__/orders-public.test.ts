import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const eqToken = vi.fn(() => ({ single }));
const eqOrderId = vi.fn(() => ({ eq: eqToken }));
const select = vi.fn(() => ({ eq: eqOrderId }));
const from = vi.fn(() => ({ select }));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => ({
    from,
  })),
}));

import { getPublicOrderDetails } from "@/lib/actions/orders";

describe("getPublicOrderDetails", () => {
  beforeEach(() => {
    from.mockClear();
    select.mockClear();
    eqOrderId.mockClear();
    eqToken.mockClear();
    single.mockReset();
    single.mockResolvedValue({ data: null, error: null });
  });

  it("disambiguates the order voucher relationship explicitly", async () => {
    await getPublicOrderDetails("KSP-123", "public-token");

    expect(select).toHaveBeenCalledWith(
      "*, vouchers:vouchers!orders_voucher_id_fkey(*, services(*))"
    );
  });
});
