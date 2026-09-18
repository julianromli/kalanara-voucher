import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireAdminPermissionMock,
  revalidatePathMock,
  updateTagMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireAdminPermissionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  updateTagMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
}));

import {
  createTestimonial,
  deleteSiteSetting,
  deleteTestimonial,
  getLandingCopy,
  getSiteSetting,
  updateLandingCopySection,
  updateSiteSetting,
  updateTestimonial,
} from "@/lib/actions/crm";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  ANNOUNCEMENT_SETTINGS_CACHE_TAG,
  LANDING_CMS_CACHE_TAG,
} from "@/lib/cache-tags";
import { DEFAULT_LANDING_COPY } from "@/lib/landing-copy";

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
    expect(updateTagMock).toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG
    );
    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
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

  it("invalidates only landing CMS data for hero setting updates", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        key: "hero_image_url",
        value: "https://example.com/hero.jpg",
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ upsert: upsertMock })),
    });

    await updateSiteSetting(
      "hero_image_url",
      "https://example.com/hero.jpg"
    );

    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
    expect(updateTagMock).not.toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG
    );
  });

  it("upserts voucher default expiration days and revalidates settings", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        key: "voucher_default_expiration_days",
        value: "120",
        description:
          "Default number of days a newly created voucher remains valid",
        updated_at: "2026-09-22T08:00:00.000Z",
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ upsert: upsertMock })),
    });

    const result = await updateSiteSetting(
      "voucher_default_expiration_days",
      " 120 "
    );

    expect(upsertMock).toHaveBeenCalledWith(
      {
        key: "voucher_default_expiration_days",
        value: "120",
        description:
          "Default number of days a newly created voucher remains valid",
        updated_at: expect.any(String),
      },
      { onConflict: "key" }
    );
    expect(result.value).toBe("120");
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.SETTINGS_MANAGE_SENSITIVE
    );
    expect(requireAdminPermissionMock).not.toHaveBeenCalledWith(
      AdminPermission.CRM_MANAGE
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/settings", "page");
  });

  it("rejects voucher expiration writes without SETTINGS_MANAGE_SENSITIVE", async () => {
    requireAdminPermissionMock.mockImplementation(async (permission) => {
      if (permission === AdminPermission.SETTINGS_MANAGE_SENSITIVE) {
        throw new Error("Forbidden");
      }

      return {
        userId: "manager-1",
        email: "manager@kalanaraspa.com",
        role: "MANAGER",
      };
    });

    await expect(
      updateSiteSetting("voucher_default_expiration_days", "90")
    ).rejects.toThrow("Forbidden");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a missing site setting as null", async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select: selectMock })),
    });

    await expect(
      getSiteSetting("voucher_default_expiration_days")
    ).resolves.toBeNull();
  });

  it("throws when a site setting read fails instead of returning null", async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select: selectMock })),
    });

    await expect(
      getSiteSetting("voucher_default_expiration_days")
    ).rejects.toThrow("Failed to load site setting.");
  });

  it("rejects voucher expiration days outside 1-365", async () => {
    await expect(
      updateSiteSetting("voucher_default_expiration_days", "0")
    ).rejects.toThrow(/whole number between 1 and 365/i);
    await expect(
      updateSiteSetting("voucher_default_expiration_days", "366")
    ).rejects.toThrow(/whole number between 1 and 365/i);

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("invalidates only landing CMS data for hero setting deletion", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqMock }));
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ delete: deleteMock })),
    });

    await expect(deleteSiteSetting("hero_image_url")).resolves.toBe(true);

    expect(eqMock).toHaveBeenCalledWith("key", "hero_image_url");
    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
    expect(updateTagMock).not.toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG
    );
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
    expect(updateTagMock).toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG
    );
    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
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
    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
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
    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
  });

  it("deletes testimonials and revalidates cms paths", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqMock }));

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ delete: deleteMock })),
    });

    await expect(deleteTestimonial("testimonial-3")).resolves.toBe(true);
    expect(eqMock).toHaveBeenCalledWith("id", "testimonial-3");
    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "page");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/crm", "page");
  });

  it("loads landing copy JSON with defaults for missing sections", async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [
        {
          key: "landing_hero",
          value: JSON.stringify({
            ...DEFAULT_LANDING_COPY.hero,
            titleLine1: "Hadiah Baru",
          }),
        },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ in: inMock })),
      })),
    });

    const copy = await getLandingCopy();

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.CRM_MANAGE
    );
    expect(inMock).toHaveBeenCalledWith("key", [
      "landing_hero",
      "landing_me_time",
      "landing_services",
      "landing_testimonials",
      "landing_trust",
      "landing_footer",
    ]);
    expect(copy.hero.titleLine1).toBe("Hadiah Baru");
    expect(copy.services).toEqual(DEFAULT_LANDING_COPY.services);
  });

  it("saves a landing copy section and invalidates landing CMS data", async () => {
    const savedHero = {
      ...DEFAULT_LANDING_COPY.hero,
      titleLine1: "Hadiah Baru",
    };
    const singleMock = vi.fn().mockResolvedValue({
      data: { value: JSON.stringify(savedHero) },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ upsert: upsertMock })),
    });

    const result = await updateLandingCopySection("hero", savedHero);

    expect(upsertMock).toHaveBeenCalledWith(
      {
        key: "landing_hero",
        value: JSON.stringify(savedHero),
        description: "JSON copy for the landing hero section",
        updated_at: expect.any(String),
      },
      { onConflict: "key" }
    );
    expect(result).toMatchObject({ titleLine1: "Hadiah Baru" });
    expect(updateTagMock).toHaveBeenCalledWith(LANDING_CMS_CACHE_TAG);
    expect(updateTagMock).not.toHaveBeenCalledWith(
      ANNOUNCEMENT_SETTINGS_CACHE_TAG
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "page");
  });

  it("rejects unknown landing copy sections before writing", async () => {
    await expect(
      updateLandingCopySection("unknown", DEFAULT_LANDING_COPY.hero)
    ).rejects.toThrow("Unsupported landing copy section.");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects invalid footer URLs before writing", async () => {
    await expect(
      updateLandingCopySection("footer", {
        ...DEFAULT_LANDING_COPY.footer,
        columns: DEFAULT_LANDING_COPY.footer.columns.map((column, index) =>
          index === 0
            ? {
                ...column,
                links: column.links.map((link, linkIndex) =>
                  linkIndex === 0 ? { ...link, href: "notaurl" } : link
                ),
              }
            : column
        ),
      })
    ).rejects.toThrow();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
