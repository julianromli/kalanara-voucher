import { afterEach, describe, expect, test, vi } from "vitest";
import { resolveScalevProviderEventAt } from "@/lib/scalev/provider-event-time";

describe("resolveScalevProviderEventAt", () => {
  afterEach(() => vi.restoreAllMocks());

  test("marks valid provider timestamps as genuine", () => {
    expect(
      resolveScalevProviderEventAt(
        "2026-09-14T11:58:00.000Z",
        "2026-09-14T12:00:00.000Z",
        "webhook"
      )
    ).toEqual({
      timestamp: "2026-09-14T11:58:00.000Z",
      isFallback: false,
    });
  });

  test("marks receipt-time fallback and suppresses noisy production warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");

    expect(
      resolveScalevProviderEventAt(
        "invalid",
        "2026-09-14T12:00:00.000Z",
        "reconciliation"
      )
    ).toEqual({
      timestamp: "2026-09-14T12:00:00.000Z",
      isFallback: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
