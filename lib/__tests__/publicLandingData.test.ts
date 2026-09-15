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
import { getPublicLandingData } from "@/lib/publicLandingData";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublicLandingData", () => {
  it("loads the public catalog and CMS data through one cached server loader", async () => {
    const services = [
      {
        id: "service-1",
        name: "Balinese Massage",
        is_active: true,
        category_id: "category-1",
        category_relation: {
          id: "category-1",
          name: "Massage",
          slug: "massage",
          is_active: true,
        },
      },
    ];
    const testimonials = [
      {
        id: "testimonial-1",
        name: "Ayu",
        is_active: true,
        sort_order: 1,
      },
    ];
    const serviceOrderMock = vi.fn().mockResolvedValue({
      data: services,
      error: null,
    });
    const heroMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { value: "https://example.com/hero.webp" },
      error: null,
    });
    const testimonialFinalOrderMock = vi.fn().mockResolvedValue({
      data: testimonials,
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === "services") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: serviceOrderMock })),
          })),
        };
      }
      if (table === "site_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: heroMaybeSingleMock })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ order: testimonialFinalOrderMock })),
          })),
        })),
      };
    });
    getAdminClientMock.mockReturnValue({ from: fromMock });

    await expect(getPublicLandingData()).resolves.toEqual({
      services,
      heroImageUrl: "https://example.com/hero.webp",
      testimonials,
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

  it("returns safe CMS fallbacks when optional public reads fail", async () => {
    const databaseError = { message: "database unavailable" };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fromMock = vi.fn((table: string) => {
      if (table === "services") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      if (table === "site_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: databaseError,
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: databaseError,
              }),
            })),
          })),
        })),
      };
    });
    getAdminClientMock.mockReturnValue({ from: fromMock });

    await expect(getPublicLandingData()).resolves.toEqual({
      services: [],
      heroImageUrl: undefined,
      testimonials: [],
    });
    expect(consoleError).toHaveBeenCalledTimes(2);
  });
});
