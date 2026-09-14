import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cacheLifeMock,
  cacheTagMock,
  createClientMock,
  getAdminClientMock,
  requireAdminPermissionMock,
  revalidatePathMock,
  revalidateTagMock,
} = vi.hoisted(() => ({
  cacheLifeMock: vi.fn(),
  cacheTagMock: vi.fn(),
  createClientMock: vi.fn(),
  getAdminClientMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
}));

import {
  createTestimonial,
  deleteSiteSetting,
  deleteTestimonial,
  getAnnouncementSettings,
  updateSiteSetting,
  updateTestimonial,
} from "@/lib/actions/crm";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import { ANNOUNCEMENT_SETTINGS_CACHE_TAG } from "@/lib/cache-tags";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminPermissionMock.mockResolvedValue({
    userId: "admin-1",
    email: "admin@kalanaraspa.com",
    role: "SUPER_ADMIN",
  });
});

describe("crm actions", () => {
  it("fetches and maps all announcement settings with one narrow cached query", async () => {
    const rows = [
      { key: "announcement_countdown_enabled", value: "false" },
      { key: "announcement_text", value: "Promo akhir pekan" },
      {
        key: "announcement_countdown_end_at",
        value: "2026-09-20T10:00:00.000Z",
      },
    ];
    const inMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const selectMock = vi.fn(() => ({ in: inMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getAdminClientMock.mockReturnValue({ from: fromMock });

    await expect(getAnnouncementSettings()).resolves.toEqual({
      announcementText: "Promo akhir pekan",
      countdownEndAt: "2026-09-20T10:00:00.000Z",
      countdownEnabled: "false",
    });

    expect(getAdminClientMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("site_settings");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledWith("key, value");
    expect(inMock).toHaveBeenCalledTimes(1);
    expect(inMock).toHaveBeenCalledWith("key", [
      "announcement_text",
      "announcement_countdown_end_at",
      "announcement_countdown_enabled",
    ]);
    expect(cacheLifeMock).toHaveBeenCalledWith("hours");
    expect(cacheTagMock).toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG
    );
  });

  it("returns empty announcement settings when the narrow query fails", async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });
    getAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ in: inMock })),
      })),
    });

    await expect(getAnnouncementSettings()).resolves.toEqual({});
  });

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
    expect(revalidateTagMock).toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG,
      "max"
    );
  });

  it("upserts the announcement countdown enabled flag", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        key: "announcement_countdown_enabled",
        value: "false",
        description: "Whether the announcement bar shows a countdown timer",
        updated_at: "2026-09-14T08:00:00.000Z",
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ upsert: upsertMock })),
    });

    const result = await updateSiteSetting(
      "announcement_countdown_enabled",
      " false "
    );

    expect(upsertMock).toHaveBeenCalledWith(
      {
        key: "announcement_countdown_enabled",
        value: "false",
        description: "Whether the announcement bar shows a countdown timer",
        updated_at: expect.any(String),
      },
      { onConflict: "key" }
    );
    expect(result.value).toBe("false");
  });

  it("rejects blank site setting values instead of upserting an empty string", async () => {
    await expect(updateSiteSetting("announcement_countdown_end_at", "   ")).rejects.toThrow(
      "Site setting value cannot be blank."
    );

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.CRM_MANAGE
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("deletes a site setting row and revalidates cms paths", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ delete: deleteMock })),
    });

    await expect(
      deleteSiteSetting("announcement_countdown_end_at")
    ).resolves.toBe(true);
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.CRM_MANAGE
    );
    expect(eqMock).toHaveBeenCalledWith("key", "announcement_countdown_end_at");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/crm", "page");
    expect(revalidateTagMock).toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG,
      "max"
    );
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

  it("rejects inherited property names when deleting site settings", async () => {
    await expect(deleteSiteSetting("toString")).rejects.toThrow(
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
