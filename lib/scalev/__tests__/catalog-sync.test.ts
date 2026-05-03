import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";

const scalevMocks = vi.hoisted(() => ({
  attachProductToScalevStoreMock: vi.fn(),
  createScalevProductMock: vi.fn(),
  getScalevProductMock: vi.fn(),
  listScalevProductsMock: vi.fn(),
  updateScalevProductMock: vi.fn(),
}));

const serviceActionMocks = vi.hoisted(() => ({
  getActiveServicesForScalevSyncMock: vi.fn(),
  updateServiceScalevMappingMock: vi.fn(),
}));

vi.mock("@/lib/scalev/client", () => ({
  attachProductToScalevStore: scalevMocks.attachProductToScalevStoreMock,
  createScalevProduct: scalevMocks.createScalevProductMock,
  getScalevProduct: scalevMocks.getScalevProductMock,
  listScalevProducts: scalevMocks.listScalevProductsMock,
  updateScalevProduct: scalevMocks.updateScalevProductMock,
}));

vi.mock("@/lib/actions/services", () => ({
  getActiveServicesForScalevSync: serviceActionMocks.getActiveServicesForScalevSyncMock,
  updateServiceScalevMapping: serviceActionMocks.updateServiceScalevMappingMock,
}));

import { ensureScalevServiceMapping } from "@/lib/scalev/catalog-sync";

type Service = Database["public"]["Tables"]["services"]["Row"];

const SCALEV_PRODUCT_DESCRIPTION_MAX_LENGTH = 255;

function createService(overrides: Partial<Service> = {}): Service {
  return {
    id: "service-1",
    name: "Balinese Massage",
    description: "Relaxing spa treatment",
    duration: 90,
    price: 450000,
    category: "MASSAGE",
    category_id: null,
    image_url: "https://example.com/service.webp",
    is_active: true,
    scalev_product_id: null,
    scalev_variant_id: null,
    scalev_variant_unique_id: null,
    scalev_sync_status: null,
    scalev_last_synced_at: null,
    created_at: "2026-05-03T00:00:00.000Z",
    updated_at: "2026-05-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("ensureScalevServiceMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    scalevMocks.attachProductToScalevStoreMock.mockResolvedValue(undefined);
    serviceActionMocks.updateServiceScalevMappingMock.mockResolvedValue(undefined);
  });

  it("truncates long descriptions before creating a new Scalev product", async () => {
    const longDescription = "A".repeat(SCALEV_PRODUCT_DESCRIPTION_MAX_LENGTH + 25);

    scalevMocks.listScalevProductsMock.mockResolvedValue([]);
    scalevMocks.createScalevProductMock.mockResolvedValue({
      product: { id: 123 },
      primaryVariant: { id: 456, unique_id: "variant-123" },
    });

    await ensureScalevServiceMapping(
      createService({
        description: longDescription,
      })
    );

    expect(scalevMocks.createScalevProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: longDescription.slice(0, SCALEV_PRODUCT_DESCRIPTION_MAX_LENGTH),
        richDescription: longDescription.slice(0, SCALEV_PRODUCT_DESCRIPTION_MAX_LENGTH),
      })
    );
  });

  it("truncates long descriptions before updating an existing Scalev product", async () => {
    const longDescription = "B".repeat(SCALEV_PRODUCT_DESCRIPTION_MAX_LENGTH + 10);

    scalevMocks.getScalevProductMock.mockResolvedValue({
      id: 321,
      variants: [
        {
          id: 654,
          unique_id: "variant-654",
          name: "Balinese Massage Voucher",
          price: 450000,
          weight: 1,
        },
      ],
    });
    scalevMocks.updateScalevProductMock.mockResolvedValue({
      product: { id: 321 },
      primaryVariant: { id: 654, unique_id: "variant-654" },
    });

    await ensureScalevServiceMapping(
      createService({
        description: longDescription,
        scalev_product_id: 321,
        scalev_variant_id: 654,
      })
    );

    expect(scalevMocks.updateScalevProductMock).toHaveBeenCalledWith(
      321,
      expect.objectContaining({
        description: longDescription.slice(0, SCALEV_PRODUCT_DESCRIPTION_MAX_LENGTH),
        richDescription: longDescription.slice(0, SCALEV_PRODUCT_DESCRIPTION_MAX_LENGTH),
      })
    );
  });
});
