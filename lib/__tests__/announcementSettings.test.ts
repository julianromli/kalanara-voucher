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

import { getAnnouncementSettings } from "@/lib/announcementSettings";
import { ANNOUNCEMENT_SETTINGS_CACHE_TAG } from "@/lib/cache-tags";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAnnouncementSettings", () => {
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

  it("throws when the cached announcement query fails", async () => {
    const databaseError = { message: "database unavailable" };
    const inMock = vi.fn().mockResolvedValue({
      data: null,
      error: databaseError,
    });
    getAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ in: inMock })),
      })),
    });

    await expect(getAnnouncementSettings()).rejects.toBe(databaseError);
  });
});
