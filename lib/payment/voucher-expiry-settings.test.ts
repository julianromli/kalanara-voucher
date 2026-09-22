import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VOUCHER_EXPIRATION_DAYS,
  VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
} from "@/lib/payment/voucher-expiry";

const { getAdminClientMock } = vi.hoisted(() => ({
  getAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

import { getVoucherDefaultExpirationDays } from "@/lib/payment/voucher-expiry-settings";

function mockSettingValue(value: string | null, error: unknown = null) {
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: value == null ? null : { value },
    error,
  });
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  getAdminClientMock.mockReturnValue({ from: fromMock });
  return { fromMock, selectMock, eqMock };
}

describe("getVoucherDefaultExpirationDays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the live site setting without caching", async () => {
    const { fromMock, selectMock, eqMock } = mockSettingValue("45");

    await expect(getVoucherDefaultExpirationDays()).resolves.toBe(45);

    expect(fromMock).toHaveBeenCalledWith("site_settings");
    expect(selectMock).toHaveBeenCalledWith("value");
    expect(eqMock).toHaveBeenCalledWith(
      "key",
      VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY
    );
  });

  it("falls back to 90 days when the setting is missing", async () => {
    mockSettingValue(null);

    await expect(getVoucherDefaultExpirationDays()).resolves.toBe(
      DEFAULT_VOUCHER_EXPIRATION_DAYS
    );
  });

  it("falls back to 90 days when the stored value is invalid", async () => {
    mockSettingValue("not-a-number");

    await expect(getVoucherDefaultExpirationDays()).resolves.toBe(90);
  });

  it("falls back to 90 days when the query fails", async () => {
    mockSettingValue(null, { message: "database unavailable" });

    await expect(getVoucherDefaultExpirationDays()).resolves.toBe(90);
  });
});
