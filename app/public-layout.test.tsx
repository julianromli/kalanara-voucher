import { Children, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAnnouncementSettingsMock } = vi.hoisted(() => ({
  getAnnouncementSettingsMock: vi.fn(),
}));

vi.mock("@/lib/announcementSettings", () => ({
  getAnnouncementSettings: getAnnouncementSettingsMock,
}));

vi.mock("@/components/navbar", () => ({
  default: vi.fn(),
}));

import PublicLayout, { PublicNavbar } from "@/app/(public)/layout";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PublicLayout", () => {
  it("reads announcement settings once and maps them to navbar props", async () => {
    getAnnouncementSettingsMock.mockResolvedValue({
      announcementText: "Promo hari ini",
      countdownEndAt: "2026-09-20T10:00:00.000Z",
      countdownEnabled: "false",
    });

    const navbar = await PublicNavbar();

    expect(getAnnouncementSettingsMock).toHaveBeenCalledTimes(1);
    expect(navbar.props).toMatchObject({
      announcementText: "Promo hari ini",
      announcementCountdownEndAt: "2026-09-20T10:00:00.000Z",
      announcementCountdownEnabled: false,
    });
  });

  it("uses safe navbar defaults when announcement settings are unavailable", async () => {
    const failure = new Error("database unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    getAnnouncementSettingsMock.mockRejectedValue(failure);

    const navbar = await PublicNavbar();

    expect(navbar.props).toMatchObject({
      announcementText: "PROMO 5.5 BERAKHIR DALAM ",
      announcementCountdownEndAt: undefined,
      announcementCountdownEnabled: true,
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Error loading announcement settings:",
      failure
    );
  });

  it("does no settings work while constructing the public layout shell", () => {
    const child = <div>Konten publik</div>;

    const layout = PublicLayout({ children: child });

    expect(getAnnouncementSettingsMock).not.toHaveBeenCalled();
    expect(
      Children.toArray(layout.props.children).some(
        (layoutChild) =>
          isValidElement<{ children: string }>(layoutChild) &&
          layoutChild.props.children === "Konten publik"
      )
    ).toBe(true);
  });
});
