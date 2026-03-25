import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  getAdminClientMock,
  requireAdminPermissionMock,
  logAdminAuditMock,
  revalidateTagMock,
  revalidatePathMock,
  servicesSelectMock,
  servicesEqMock,
  servicesSingleMock,
  servicesOrderMock,
  servicesInsertMock,
  servicesUpdateMock,
  servicesUpdateEqMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getAdminClientMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  servicesSelectMock: vi.fn(),
  servicesEqMock: vi.fn(),
  servicesSingleMock: vi.fn(),
  servicesOrderMock: vi.fn(),
  servicesInsertMock: vi.fn(),
  servicesUpdateMock: vi.fn(),
  servicesUpdateEqMock: vi.fn(),
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
  updateService,
} from "@/lib/actions/services";
import { AdminPermission } from "@/lib/auth/admin-rbac";

const joinedSelect = "*, category_relation:service_categories!services_category_id_fkey(*)";

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

function createClientFromSelect() {
  return {
    from: vi.fn(() => ({
      select: servicesSelectMock,
    })),
  };
}

function createAdminClient() {
  return {
    from: vi.fn(() => ({
      select: servicesSelectMock,
      insert: servicesInsertMock,
      update: servicesUpdateMock,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  createReadQueryChain();

  servicesSingleMock.mockResolvedValue({ data: serviceRow, error: null });
  servicesOrderMock.mockResolvedValue({ data: [serviceRow], error: null });

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
    });

    expect(servicesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: "category-1" })
    );
    expect(result?.category_relation).toEqual(categoryRow);
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

  it("soft deactivates services and revalidates", async () => {
    servicesUpdateMock.mockReturnValueOnce({
      eq: servicesUpdateEqMock,
    });
    servicesUpdateEqMock.mockResolvedValueOnce({ error: null });

    const result = await deleteService("service-1");

    expect(result).toBe(true);
    expect(servicesUpdateMock).toHaveBeenCalledWith({ is_active: false });
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "service.deactivate", target: "service-1" })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
  });
});
