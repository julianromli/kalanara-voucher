import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  getAdminClientMock,
  requireAdminPermissionMock,
  logAdminAuditMock,
  revalidateTagMock,
  revalidatePathMock,
  selectMock,
  eqMock,
  orderMock,
  maybeSingleMock,
  singleMock,
  ilikeMock,
  insertMock,
  updateMock,
  updateEqMock,
  deleteMock,
  deleteEqMock,
  servicesSelectMock,
  servicesEqMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getAdminClientMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  orderMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  singleMock: vi.fn(),
  ilikeMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  deleteMock: vi.fn(),
  deleteEqMock: vi.fn(),
  servicesSelectMock: vi.fn(),
  servicesEqMock: vi.fn(),
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
  createServiceCategory,
  deleteServiceCategory,
  getAllServiceCategories,
  getServiceCategoriesForAssignment,
  updateServiceCategory,
} from "@/lib/actions/service-categories";
import { AdminPermission } from "@/lib/auth/admin-rbac";

const categoryRow = {
  id: "category-1",
  slug: "body-treatment",
  name: "Body Treatment",
  sort_order: 2,
  is_active: true,
  created_at: "2026-03-20T00:00:00.000Z",
  updated_at: "2026-03-20T00:00:00.000Z",
} as const;

function createCategorySelectChain() {
  let orderCallCount = 0;

  const query = {
    eq: eqMock,
    order: orderMock,
    ilike: ilikeMock,
    maybeSingle: maybeSingleMock,
    single: singleMock,
  };

  selectMock.mockReturnValue(query);
  eqMock.mockReturnValue(query);
  orderMock.mockImplementation(() => {
    orderCallCount += 1;

    if (orderCallCount % 2 === 1) {
      return query;
    }

    return Promise.resolve({ data: [categoryRow], error: null });
  });
  ilikeMock.mockReturnValue(query);

  return query;
}

function createServerClient() {
  return {
    from: vi.fn(() => ({
      select: selectMock,
    })),
  };
}

function createAdminClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "service_categories") {
        return {
          select: selectMock,
          insert: insertMock,
          update: updateMock,
          delete: deleteMock,
        };
      }

      if (table === "services") {
        return {
          select: servicesSelectMock,
        };
      }

      return {
        select: selectMock,
      };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  createCategorySelectChain();

  maybeSingleMock.mockResolvedValue({ data: null, error: null });
  singleMock.mockResolvedValue({ data: categoryRow, error: null });

  insertMock.mockReturnValue({
    select: vi.fn(() => ({
      single: singleMock,
    })),
  });

  updateEqMock.mockReturnValue({
    select: vi.fn(() => ({
      single: singleMock,
    })),
  });

  updateMock.mockReturnValue({
    eq: updateEqMock,
  });

  deleteEqMock.mockResolvedValue({ error: null });
  deleteMock.mockReturnValue({
    eq: deleteEqMock,
  });

  servicesEqMock.mockResolvedValue({ count: 0, error: null });
  servicesSelectMock.mockReturnValue({
    eq: servicesEqMock,
  });

  createClientMock.mockResolvedValue(createServerClient());
  getAdminClientMock.mockReturnValue(createAdminClient());
  requireAdminPermissionMock.mockResolvedValue({
    userId: "admin-1",
    email: "admin@kalanaraspa.com",
    role: "SUPER_ADMIN",
  });
});

describe("service category actions", () => {
  it("requires services manage permission for assignment category reads and filters active rows only", async () => {
    const result = await getServiceCategoriesForAssignment();

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.SERVICES_MANAGE
    );
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(eqMock).toHaveBeenCalledWith("is_active", true);
    expect(result).toEqual([categoryRow]);
  });

  it("returns all categories for admin management without active filtering", async () => {
    await getAllServiceCategories();

    expect(eqMock).not.toHaveBeenCalledWith("is_active", true);
    expect(orderMock).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("creates categories with trimmed names, stable slug seed, and permission guard", async () => {
    const result = await createServiceCategory({
      name: "  Body Treatment  ",
      sortOrder: 2,
    });

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.SERVICES_MANAGE
    );
    expect(ilikeMock).toHaveBeenCalledWith("name", "Body Treatment");
    expect(insertMock).toHaveBeenCalledWith({
      name: "Body Treatment",
      slug: "body-treatment",
      is_active: true,
      sort_order: 2,
    });
    expect(result.slug).toBe("body-treatment");
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "service_category.create" })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
  });

  it("rejects blank category names before hitting Supabase writes", async () => {
    await expect(
      createServiceCategory({
        name: "   ",
      })
    ).rejects.toThrow("Nama kategori layanan wajib diisi.");

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects case-insensitive duplicate category names", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "category-2", name: "massage" },
      error: null,
    });

    await expect(
      createServiceCategory({
        name: "Massage",
      })
    ).rejects.toThrow("Nama kategori layanan sudah digunakan.");

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("updates category names without changing the original slug", async () => {
    singleMock
      .mockResolvedValueOnce({ data: categoryRow, error: null })
      .mockResolvedValueOnce({
        data: {
          ...categoryRow,
          name: "Perawatan Tubuh",
          slug: "body-treatment",
          is_active: false,
        },
        error: null,
      });

    const result = await updateServiceCategory("category-1", {
      name: "  Perawatan Tubuh ",
      isActive: false,
    });

    expect(ilikeMock).toHaveBeenCalledWith("name", "Perawatan Tubuh");
    expect(updateMock).toHaveBeenCalledWith({
      name: "Perawatan Tubuh",
      is_active: false,
      sort_order: categoryRow.sort_order,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "category-1");
    expect(result.slug).toBe("body-treatment");
    expect(result.name).toBe("Perawatan Tubuh");
  });

  it("rejects deleting categories that are still referenced by services", async () => {
    servicesEqMock.mockResolvedValueOnce({
      count: 2,
      error: null,
    });

    await expect(deleteServiceCategory("category-1")).rejects.toThrow(
      "Kategori layanan masih dipakai oleh layanan yang ada."
    );

    expect(servicesSelectMock).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(servicesEqMock).toHaveBeenCalledWith("category_id", "category-1");
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes unreferenced categories and revalidates affected surfaces", async () => {
    const result = await deleteServiceCategory("category-1");

    expect(result).toBe(true);
    expect(deleteEqMock).toHaveBeenCalledWith("id", "category-1");
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "service_category.delete", target: "category-1" })
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("dashboard-stats", "max");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/services", "page");
  });
});
