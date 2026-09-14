import { describe, expect, it } from "vitest";
import { isAnnouncementCountdownEnabled } from "@/lib/site-settings";

describe("isAnnouncementCountdownEnabled", () => {
  it("defaults to on when the setting is missing or blank", () => {
    expect(isAnnouncementCountdownEnabled(undefined)).toBe(true);
    expect(isAnnouncementCountdownEnabled(null)).toBe(true);
    expect(isAnnouncementCountdownEnabled("")).toBe(true);
    expect(isAnnouncementCountdownEnabled("   ")).toBe(true);
  });

  it("treats only an explicit false value as off", () => {
    expect(isAnnouncementCountdownEnabled("false")).toBe(false);
    expect(isAnnouncementCountdownEnabled("FALSE")).toBe(false);
    expect(isAnnouncementCountdownEnabled(" false ")).toBe(false);
  });

  it("treats true and any other stored value as on", () => {
    expect(isAnnouncementCountdownEnabled("true")).toBe(true);
    expect(isAnnouncementCountdownEnabled("TRUE")).toBe(true);
  });
});
