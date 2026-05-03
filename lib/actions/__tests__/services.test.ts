import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  getAdminClientMock,
  requireAdminPermissionMock,
  logAdminAuditMock,
  revalidateTagMock,
  revalidatePathMock,
  servicesFromMock,
  serviceCategoriesFromMock,
  servicesSelectMock,
  servicesEqMock,
  servicesSingleMock,
  servicesOrderMock,
  servicesInsertMock,
  servicesUpdateMock,
  servicesUpdateEqMock,
  serviceCategoriesSelectMock,
  serviceCategoriesInMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getAdminClientMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  servicesFromMock: vi.fn(),
  serviceCategoriesFromMock: vi.fn(),
  servicesSelectMock: vi.fn(),
  servicesEqMock: vi.fn(),
  servicesSingleMock: vi.fn(),
  servicesOrderMock: vi.fn(),
  servicesInsertMock: vi.fn(),
  servicesUpdateMock: vi.fn(),
  servicesUpdateEqMock: vi.fn(),
  serviceCategoriesSelectMock: vi.fn(),
  serviceCategoriesInMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
  logAdminAudit: logAdminAuditMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

import {
  createService,
  deleteService,
  getActiveServicesForScalevSync,
  getAllServices,
  getServiceById,
  getServices,
  setServiceActiveState,
  updateService,
  updateServiceScalevMapping,
} from "@/lib/actions/services";
import { AdminPermission, hasPermissionForRole } from "@/lib/auth/admin-rbac";

const joinedSelect = "*, category_relation:service_categories!category_id(*)";
const baseSelect = "*";
const pgrst200Error = {
  code: "PGRST200",
  message: "Could not find a relationship between services and service_categories",
};

const categoryRow = {
  id: "category-1",
  slug: "massage",
  name: "Massage",
  sort_order: 1,
  is_active: true,
  created_at: "2026-03-20T00:00:00.000Z",
  updated_at: "2026-03-20T00:00:00.000Z",
} as const;

const serviceRow = {
  id: "service-1",
  name: "Balinese Massage",
  description: "Relaksasi tradisional.",
  duration: 90,
  price: 550000,
  category: "MASSAGE",
  category_id: "category-1",
  image_url: null,
  is_active: true,
  scalev_product_id: null,
  scalev_variant_id: null,
  scalev_variant_unique_id: null,
  scalev_sync_status: null,
  scalev_last_synced_at: null,
  created_at: "2026-03-20T00:00:00.000Z",
  updated_at: "2026-03-20T00:00:00.000Z",
  category_relation: categoryRow,
} as const;

function createReadQueryChain() {
  const query = {
    eq: servicesEqMock,
    order: servicesOrderMock,
    single: servicesSingleMock,
  };

  servicesSelectMock.mockReturnValue(query);
  servicesEqMock.mockReturnValue(query);
  servicesOrderMock.mockReturnValue(query);

  return query;
}

function createCategoryQueryChain() {
  const query = {
    in: serviceCategoriesInMock,
  };

  serviceCategoriesSelectMock.mockReturnValue(query);

  return query;
}

function createClientFromSelect() {
  return {
    from: vi.fn((table: string) => {
      if (table === "services") {
        servicesFromMock(table);

        return {
          select: servicesSelectMock,
        };
      }

      if (table === "service_categories") {
        serviceCategoriesFromMock(table);

        return {
          select: serviceCategoriesSelectMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createAdminClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "services") {
        servicesFromMock(table);

        return {
          select: servicesSelectMock,
          insert: servicesInsertMock,
          update: servicesUpdateMock,
        };
      }

      if (table === "service_categories") {
        serviceCategoriesFromMock(table);

        return {
          select: serviceCategoriesSelectMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  createReadQueryChain();
  createCategoryQueryChain();

  servicesSingleMock.mockResolvedValue({ data: serviceRow, error: null });
  servicesOrderMock.mockResolvedValue({ data: [serviceRow], error: null });
  serviceCategoriesInMock.mockResolvedValue({ data: [categoryRow], error: null });

  servicesInsertMock.mockReturnValue({
    select: vi.fn(() => ({
      single: servicesSingleMock,
    })),
  });

  servicesUpdateEqMock.mockReturnValue({
    select: vi.fn(() => ({
      single: servicesSingleMock,
    })),
  });

  servicesUpdateMock.mockReturnValue({
    eq: servicesUpdateEqMock,
  });

  createClientMock.mockResolvedValue(createClientFromSelect());
  getAdminClientMock.mockReturnValue(createAdminClient());
  requireAdminPermissionMock.mockResolvedValue({
    userId: "admin-1",
    email: "admin@kalanaraspa.com",
    role: "SUPER_ADMIN",
  });
});

describe("service actions", () => {
  it("grants service creation and image permissions only to super admins", () => {
    expect(hasPermissionForRole("SUPER_ADMIN", AdminPermission.SERVICES_CREATE)).toBe(true);
    expect(hasPermissionForRole("SUPER_ADMIN", AdminPermission.SERVICE_IMAGES_MANAGE)).toBe(true);
    expect(hasPermissionForRole("MANAGER", AdminPermission.SERVICES_CREATE)).toBe(false);
    expect(hasPermissionForRole("MANAGER", AdminPermission.SERVICE_IMAGES_MANAGE)).toBe(false);
  });

  it("selects joined category data for public service list reads", async () => {
    const result = await getServices();

    expect(servicesSelectMock).toHaveBeenCalledWith(joinedSelect);
    expect(servicesEqMock).toHaveBeenCalledWith("is_active", true);
    expect(result[0]?.category_relation).toEqual(categoryRow);
  });

  it("requires services manage permission for admin service reads", async () => {
    await getAllServices();

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.SERVICES_MANAGE
    );
    expect(servicesSelectMock).toHaveBeenCalledWith(joinedSelect);
  });

  it("selects joined category data for service detail reads", async () => {
    const result = await getServiceById("service-1");

    expect(servicesSelectMock).toHaveBeenCalledWith(joinedSelect);
    expect(servicesEqMock).toHaveBeenCalledWith("id", "service-1");
    expect(result?.category_relation).toEqual(categoryRow);
  });

  it("keeps inactive linked categories resolvable in service detail reads", async () => {
    servicesSingleMock.mockResolvedValueOnce({
      data: {
        ...serviceRow,
        category_relation: {
          ...categoryRow,
          is_active: false,
        },
      },
      error: null,
    });

    const result = await getServiceById("service-1");

    expect(result?.category_relation?.is_active).toBe(false);
  });

  it("returns joined category data for active Scalev sync reads", async () => {
    const result = await getActiveServicesForScalevSync();

    expect(servicesSelectMock).toHaveBeenCalledWith(joinedSelect);
    expect(servicesEqMock).toHaveBeenCalledWith("is_active", true);
    expect(result[0]?.category_relation?.slug).toBe("massage");
  });

  it("revalidates affected surfaces after service create", async () => {
    const result = await createService({
      name: "Hot Stone Massage",
      description: "Batu hangat.",
      duration: 75,
      price: 650000,
      category: "MASSAGE",
      category_id: "category-1",
      image_url: "https://images.unsplash.com/photo-hot-stone",
    });

    expect(servicesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: "category-1" })
    );
    expect(serviceCategoriesSelectMock).toHaveBeenCalledWith(baseSelect);
    expect(serviceCategoriesInMock).toHaveBeenCalledWith("id", ["category-1"]);
    expect(result?.category_relation).toEqual(categoryRow);
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.SERVICES_CREATE
    );
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "service.create" })
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("dashboard-stats", "max");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/checkout/[id]", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/voucher/[id]", "page");
  });

  it("revalidates affected surfaces after service update", async () => {
    servicesSingleMock.mockResolvedValueOnce({
      data: {
        image_url: "https://images.unsplash.com/photo-existing",
      },
      error: null,
    });

    const result = await updateService("service-1", {
      category_id: "category-2",
      name: "Aromatherapy Massage",
    });

    expect(servicesUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: "category-2" })
    );
    expect(servicesUpdateEqMock).toHaveBeenCalledWith("id", "service-1");
    expect(result?.id).toBe("service-1");
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "service.update" })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
  });

  it("updates Scalev mapping with the admin client without requiring admin session", async () => {
    const result = await updateServiceScalevMapping("service-1", {
      scalev_product_id: 382500,
      scalev_variant_id: 462500,
      scalev_variant_unique_id: "variant-462500",
      scalev_sync_status: "synced",
      scalev_last_synced_at: "2026-05-03T14:00:00.000Z",
    });

    expect(requireAdminPermissionMock).not.toHaveBeenCalled();
    expect(servicesUpdateMock).toHaveBeenCalledWith({
      scalev_product_id: 382500,
      scalev_variant_id: 462500,
      scalev_variant_unique_id: "variant-462500",
      scalev_sync_status: "synced",
      scalev_last_synced_at: "2026-05-03T14:00:00.000Z",
    });
    expect(servicesUpdateEqMock).toHaveBeenCalledWith("id", "service-1");
    expect(result).toEqual(serviceRow);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
  });

  it("falls back to stitched categories for public service list reads on PGRST200", async () => {
    servicesOrderMock
      .mockResolvedValueOnce({ data: null, error: pgrst200Error })
      .mockResolvedValueOnce({
        data: [
          {
            ...serviceRow,
            category_relation: undefined,
          },
        ],
        error: null,
      });

    const result = await getServices();

    expect(servicesSelectMock).toHaveBeenNthCalledWith(1, joinedSelect);
    expect(servicesSelectMock).toHaveBeenNthCalledWith(2, baseSelect);
    expect(serviceCategoriesSelectMock).toHaveBeenCalledWith(baseSelect);
    expect(serviceCategoriesInMock).toHaveBeenCalledWith("id", ["category-1"]);
    expect(result).toEqual([
      expect.objectContaining({
        id: "service-1",
        category_relation: categoryRow,
      }),
    ]);
  });

  it("falls back to stitched category data for service detail reads on PGRST200", async () => {
    servicesSingleMock
      .mockResolvedValueOnce({ data: null, error: pgrst200Error })
      .mockResolvedValueOnce({
        data: {
          ...serviceRow,
          category_relation: undefined,
        },
        error: null,
      });

    const result = await getServiceById("service-1");

    expect(servicesSelectMock).toHaveBeenNthCalledWith(1, joinedSelect);
    expect(servicesSelectMock).toHaveBeenNthCalledWith(2, baseSelect);
    expect(serviceCategoriesInMock).toHaveBeenCalledWith("id", ["category-1"]);
    expect(result?.category_relation).toEqual(categoryRow);
  });

  it("falls back to stitched category data after service update on PGRST200", async () => {
    servicesSingleMock
      .mockResolvedValueOnce({
        data: {
          image_url: "https://images.unsplash.com/photo-before",
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: pgrst200Error });
    servicesUpdateEqMock.mockReturnValueOnce({
      select: vi.fn(() => ({
        single: servicesSingleMock,
      })),
    });
    servicesSingleMock.mockResolvedValueOnce({
      data: {
        ...serviceRow,
        name: "Aromatherapy Massage",
        category_id: "category-1",
        category_relation: undefined,
      },
      error: null,
    });

    const result = await updateService("service-1", {
      category_id: "category-1",
      name: "Aromatherapy Massage",
      image_url: "https://images.unsplash.com/photo-aroma",
    });

    expect(serviceCategoriesInMock).toHaveBeenCalledWith("id", ["category-1"]);
    expect(result).toEqual(
      expect.objectContaining({
        name: "Aromatherapy Massage",
        category_relation: categoryRow,
      })
    );
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "service.update" })
    );
  });

  it("soft deactivates services and revalidates", async () => {
    const result = await deleteService("service-1");

    expect(result).toBe(true);
    expect(servicesUpdateMock).toHaveBeenCalledWith({ is_active: false });
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "service.deactivate",
        target: "service-1",
        details: { name: "Balinese Massage" },
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
  });

  it("requires service image permission when the image URL changes", async () => {
    servicesSingleMock.mockResolvedValueOnce({
      data: {
        image_url: "https://images.unsplash.com/photo-before",
      },
      error: null,
    });

    const result = await updateService("service-1", {
      image_url: "https://app-id.ufs.sh/f/service-image-key.webp",
    });

    expect(requireAdminPermissionMock).toHaveBeenNthCalledWith(
      1,
      AdminPermission.SERVICES_MANAGE
    );
    expect(requireAdminPermissionMock).toHaveBeenNthCalledWith(
      2,
      AdminPermission.SERVICE_IMAGES_MANAGE
    );
    expect(result?.id).toBe("service-1");
  });

  it("does not require service image permission when the image URL stays the same", async () => {
    servicesSingleMock.mockResolvedValueOnce({
      data: {
        image_url: "https://images.unsplash.com/photo-aroma",
      },
      error: null,
    });

    await updateService("service-1", {
      image_url: "https://images.unsplash.com/photo-aroma",
    });

    expect(requireAdminPermissionMock).toHaveBeenCalledTimes(1);
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.SERVICES_MANAGE
    );
  });

  it("reactivates services and revalidates", async () => {
    const result = await setServiceActiveState("service-1", true);

    expect(result?.is_active).toBe(true);
    expect(servicesUpdateMock).toHaveBeenCalledWith({ is_active: true });
    expect(servicesUpdateEqMock).toHaveBeenCalledWith("id", "service-1");
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "service.activate",
        target: "service-1",
        details: { name: "Balinese Massage" },
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
  });

  it("rejects service creation when no image is provided", async () => {
    await expect(
      createService({
        name: "Hot Stone Massage",
        description: "Batu hangat.",
        duration: 75,
        price: 650000,
        category: "MASSAGE",
        category_id: "category-1",
        image_url: null,
      })
    ).rejects.toThrow("Gambar layanan wajib diunggah sebelum layanan disimpan.");

    expect(servicesInsertMock).not.toHaveBeenCalled();
  });

  it("rejects service updates when the resulting record still has no image", async () => {
    servicesSingleMock.mockResolvedValueOnce({
      data: {
        image_url: null,
      },
      error: null,
    });

    await expect(
      updateService("service-1", {
        name: "Aromatherapy Massage",
      })
    ).rejects.toThrow("Gambar layanan wajib diunggah sebelum layanan disimpan.");

    expect(servicesUpdateMock).not.toHaveBeenCalled();
  });
});
