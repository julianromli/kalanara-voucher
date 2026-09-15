import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  eqMock,
  fromMock,
  getAdminClientMock,
  revalidateServiceCatalogDataMock,
  selectMock,
  singleMock,
  updateMock,
} = vi.hoisted(() => ({
  eqMock: vi.fn(),
  fromMock: vi.fn(),
  getAdminClientMock: vi.fn(),
  revalidateServiceCatalogDataMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/actions/revalidateServiceCatalog", () => ({
  revalidateServiceCatalogData: revalidateServiceCatalogDataMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

import { updateServiceScalevMapping } from "@/lib/scalev/serviceWrites";

const updates = {
  scalev_product_id: 382500,
  scalev_variant_id: 462500,
  scalev_variant_unique_id: "variant-462500",
  scalev_sync_status: "synced",
  scalev_last_synced_at: "2026-05-03T14:00:00.000Z",
};

describe("updateServiceScalevMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    selectMock.mockReturnValue({ single: singleMock });
    eqMock.mockReturnValue({ select: selectMock });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
    getAdminClientMock.mockReturnValue({ from: fromMock });
  });

  it("throws database update errors and skips cache invalidation", async () => {
    const databaseError = new Error("database unavailable");
    singleMock.mockResolvedValue({ data: null, error: databaseError });

    await expect(
      updateServiceScalevMapping("service-1", updates)
    ).rejects.toBe(databaseError);
    expect(revalidateServiceCatalogDataMock).not.toHaveBeenCalled();
  });

  it("returns persisted data when cache invalidation fails", async () => {
    const persistedService = { id: "service-1", ...updates };
    const cacheError = new Error("cache unavailable");
    const consoleErrorMock = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    singleMock.mockResolvedValue({ data: persistedService, error: null });
    revalidateServiceCatalogDataMock.mockImplementation(() => {
      throw cacheError;
    });

    await expect(
      updateServiceScalevMapping("service-1", updates)
    ).resolves.toEqual(persistedService);
    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Error revalidating service catalog after Scalev mapping update:",
      cacheError
    );

    consoleErrorMock.mockRestore();
  });
});
