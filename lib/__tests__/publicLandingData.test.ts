import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheLifeMock, cacheTagMock, getAdminClientMock } = vi.hoisted(() => ({
  cacheLifeMock: vi.fn(),
  cacheTagMock: vi.fn(),
  getAdminClientMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

import {
  LANDING_CMS_CACHE_TAG,
  PUBLIC_SERVICES_CACHE_TAG,
} from "@/lib/cache-tags";
import { DEFAULT_LANDING_COPY } from "@/lib/landing-copy";
import { getPublicLandingData } from "@/lib/publicLandingData";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublicLandingData", () => {
  const category = {
    id: "category-1",
    name: "Massage",
    slug: "massage",
    is_active: true,
  };
  const service = {
    id: "service-1",
    name: "Balinese Massage",
    is_active: true,
    category_id: "category-1",
  };
  const testimonials = [
    {
      id: "testimonial-1",
      name: "Ayu",
      is_active: true,
      sort_order: 1,
    },
  ];
  const pgrst200Error = {
    code: "PGRST200",
    message: "relationship unavailable",
  };

  function mockLandingReads({
    serviceResults = [
      {
        data: [{ ...service, category_relation: category }],
        error: null,
      },
    ],
    categoryResult = { data: [category], error: null },
    heroResult = {
      data: [{ key: "hero_image_url", value: "https://example.com/hero.webp" }],
      error: null,
    },
    testimonialResult = { data: testimonials, error: null },
  }: {
    serviceResults?: Array<{ data: unknown; error: unknown }>;
    categoryResult?: { data: unknown; error: unknown };
    heroResult?: { data: unknown; error: unknown };
    testimonialResult?: { data: unknown; error: unknown };
  } = {}) {
    const serviceOrderMock = vi.fn();
    serviceResults.forEach((result) =>
      serviceOrderMock.mockResolvedValueOnce(result)
    );
    const fromMock = vi.fn((table: string) => {
      if (table === "services") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: serviceOrderMock })),
          })),
        };
      }
      if (table === "service_categories") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue(categoryResult),
          })),
        };
      }
      if (table === "site_settings") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue(heroResult),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue(testimonialResult),
            })),
          })),
        })),
      };
    });
    getAdminClientMock.mockReturnValue({ from: fromMock });
    return fromMock;
  }

  it("loads successful service and CMS reads through one cached server loader", async () => {
    const fromMock = mockLandingReads();

    await expect(getPublicLandingData()).resolves.toEqual({
      services: [{ ...service, category_relation: category }],
      heroImageUrl: "https://example.com/hero.webp",
      testimonials,
      landingCopy: DEFAULT_LANDING_COPY,
    });

    expect(cacheLifeMock).toHaveBeenCalledWith("hours");
    expect(cacheTagMock).toHaveBeenCalledWith(
      PUBLIC_SERVICES_CACHE_TAG,
      LANDING_CMS_CACHE_TAG
    );
    expect(fromMock).toHaveBeenCalledWith("services");
    expect(fromMock).toHaveBeenCalledWith("site_settings");
    expect(fromMock).toHaveBeenCalledWith("testimonials");
  });

  it("falls back to default landing copy when stored JSON is invalid", async () => {
    mockLandingReads({
      heroResult: {
        data: [
          { key: "hero_image_url", value: "https://example.com/hero.webp" },
          { key: "landing_hero", value: "{bad-json" },
        ],
        error: null,
      },
    });

    await expect(getPublicLandingData()).resolves.toEqual(
      expect.objectContaining({
        heroImageUrl: "https://example.com/hero.webp",
        landingCopy: DEFAULT_LANDING_COPY,
      })
    );
  });

  it("stitches categories when the joined service relation is unavailable", async () => {
    mockLandingReads({
      serviceResults: [
        { data: null, error: pgrst200Error },
        { data: [service], error: null },
      ],
    });

    await expect(getPublicLandingData()).resolves.toEqual(
      expect.objectContaining({
        services: [{ ...service, category_relation: category }],
      })
    );
  });

  it.each([
    [
      "service",
      {
        serviceResults: [
          { data: null, error: { message: "service read failed" } },
        ],
      },
      "service read failed",
    ],
    [
      "fallback service",
      {
        serviceResults: [
          { data: null, error: pgrst200Error },
          { data: null, error: { message: "fallback read failed" } },
        ],
      },
      "fallback read failed",
    ],
    [
      "fallback category",
      {
        serviceResults: [
          { data: null, error: pgrst200Error },
          { data: [service], error: null },
        ],
        categoryResult: {
          data: null,
          error: { message: "category read failed" },
        },
      },
      "category read failed",
    ],
    [
      "settings",
      {
        heroResult: {
          data: null,
          error: { message: "settings read failed" },
        },
      },
      "settings read failed",
    ],
    [
      "testimonial",
      {
        testimonialResult: {
          data: null,
          error: { message: "testimonial read failed" },
        },
      },
      "testimonial read failed",
    ],
  ])("rejects when the %s database read fails", async (_name, options, message) => {
    mockLandingReads(options);

    await expect(getPublicLandingData()).rejects.toMatchObject({ message });
  });
});
