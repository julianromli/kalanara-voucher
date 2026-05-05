import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireAdminPermissionMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
}));

import {
  createTestimonial,
  deleteTestimonial,
  updateSiteSetting,
  updateTestimonial,
} from "@/lib/actions/crm";
import { AdminPermission } from "@/lib/auth/admin-rbac";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminPermissionMock.mockResolvedValue({
    userId: "admin-1",
    email: "admin@kalanaraspa.com",
    role: "SUPER_ADMIN",
  });
});

describe("crm actions", () => {
  it("upserts site settings and revalidates both layout and page surfaces", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        key: "announcement_text",
        value: "Promo baru",
        description: "Text for announcement bar at the top of the page",
        updated_at: "2026-05-05T08:00:00.000Z",
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ upsert: upsertMock })),
    });

    const result = await updateSiteSetting("announcement_text", "  Promo baru  ");

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.CRM_MANAGE
    );
    expect(upsertMock).toHaveBeenCalledWith(
      {
        key: "announcement_text",
        value: "Promo baru",
        description: "Text for announcement bar at the top of the page",
        updated_at: expect.any(String),
      },
      { onConflict: "key" }
    );
    expect(result.value).toBe("Promo baru");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/crm", "page");
  });

  it("rejects inherited property names as unsupported site setting keys", async () => {
    await expect(updateSiteSetting("toString", "bad value")).rejects.toThrow(
      "Unsupported site setting key."
    );

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.CRM_MANAGE
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("normalizes testimonial fields before insert and returns the saved row", async () => {
    const createdRow = {
      id: "testimonial-1",
      for_text: "untuk mama",
      quote: "Mama senang sekali",
      initials: "AR",
      name: "Arika R.",
      location: "Bekasi",
      sort_order: 10,
      is_active: false,
      created_at: "2026-05-05T08:00:00.000Z",
      updated_at: "2026-05-05T08:00:00.000Z",
    };
    const singleMock = vi.fn().mockResolvedValue({ data: createdRow, error: null });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert: insertMock })),
    });

    const result = await createTestimonial({
      for_text: " untuk mama ",
      quote: "  Mama senang sekali  ",
      initials: " ar ",
      name: " Arika R. ",
      location: " Bekasi ",
      sort_order: 10,
      is_active: false,
    });

    expect(insertMock).toHaveBeenCalledWith({
      for_text: "untuk mama",
      quote: "Mama senang sekali",
      initials: "AR",
      name: "Arika R.",
      location: "Bekasi",
      sort_order: 10,
      is_active: false,
    });
    expect(result).toEqual(createdRow);
  });

  it("updates testimonials with normalized fields and filters by id", async () => {
    const updatedRow = {
      id: "testimonial-2",
      for_text: "untuk sahabat",
      quote: "Hadiah paling personal",
      initials: "NW",
      name: "Nadia W.",
      location: "Depok",
      sort_order: 30,
      is_active: true,
      created_at: "2026-05-05T08:00:00.000Z",
      updated_at: "2026-05-05T08:05:00.000Z",
    };
    const singleMock = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update: updateMock })),
    });

    const result = await updateTestimonial("testimonial-2", {
      for_text: " untuk sahabat ",
      quote: "  Hadiah paling personal  ",
      initials: " nw ",
    });

    expect(updateMock).toHaveBeenCalledWith({
      for_text: "untuk sahabat",
      quote: "Hadiah paling personal",
      initials: "NW",
      updated_at: expect.any(String),
    });
    expect(eqMock).toHaveBeenCalledWith("id", "testimonial-2");
    expect(result).toEqual(updatedRow);
  });

  it("deletes testimonials and revalidates cms paths", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ delete: deleteMock })),
    });

    await expect(deleteTestimonial("testimonial-3")).resolves.toBe(true);
    expect(eqMock).toHaveBeenCalledWith("id", "testimonial-3");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/crm", "page");
  });
});
